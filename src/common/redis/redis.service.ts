import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';

interface RedisClient {
  on(event: string, handler: (...args: any[]) => void): void;
  connect(): Promise<void>;
  quit(): Promise<void>;
  disconnect(): void;
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<string>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  exists(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  multi(): any;
  options: { keyPrefix?: string };
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private _redisFailed = false;
  private isEnabled = false; // Flag para saber se o Redis deve rodar

  constructor(@Inject('REDIS_CLIENT') private readonly redis: RedisClient) {
    // 1. Verifica se existe configuração de Redis (ex: REDIS_HOST ou REDIS_URL)
    // Se não houver, desativa o Redis para evitar erros de tentativa de conexão.
    const redisHost = process.env.REDIS_HOST || process.env.REDIS_URL;
    
    if (!redisHost) {
      this._redisFailed = true;
      this.isEnabled = false;
      this.logger.warn('⚠️ Nenhuma configuração de Redis encontrada (REDIS_HOST/REDIS_URL ausente). Funcionalidades de cache/rate limit operarão em modo degradado (desativadas).');
      return;
    }

    this.isEnabled = true;

    this.redis.on('connect', () => {
      this._redisFailed = false;
      this.logger.log('✅ Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      if (!this._redisFailed) {
        this._redisFailed = true;
        this.logger.warn(`Redis not available, caching disabled: ${error.message}`);
      }
    });

    this.redis.connect().catch((err) => {
      if (!this._redisFailed) {
        this._redisFailed = true;
        this.logger.warn(`Redis not available, caching disabled: ${err.message}`);
      }
    });
  }

  async onModuleDestroy() {
    if (!this.isEnabled) return;
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  /**
   * Verificar se Redis está conectado
   */
  async isConnected(): Promise<boolean> {
    if (!this.isEnabled || this._redisFailed) return false;
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // ==================== CACHE OPERATIONS ====================

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || this._redisFailed) return null;
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    if (!this.isEnabled || this._redisFailed) return;
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
    } catch (error) {
      // Silencia para não poluir os logs se o Redis cair
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isEnabled || this._redisFailed) return;
    try {
      await this.redis.del(key);
    } catch (error) {}
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isEnabled || this._redisFailed) return;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        const keysWithoutPrefix = keys.map((k) =>
          k.replace(this.redis.options.keyPrefix || '', ''),
        );
        await this.redis.del(...keysWithoutPrefix);
      }
    } catch (error) {}
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled || this._redisFailed) return false;
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async incr(key: string, ttl?: number): Promise<number> {
    if (!this.isEnabled || this._redisFailed) return 0;
    try {
      const value = await this.redis.incr(key);
      if (ttl && value === 1) {
        await this.redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      return 0;
    }
  }

  // ==================== RATE LIMITING ====================

  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    if (!this.isEnabled || this._redisFailed) {
      // Se não há Redis, permite a requisição para não quebrar o app
      return { allowed: true, remaining: maxRequests, resetAt: 0 };
    }

    const key = `ratelimit:${identifier}`;

    try {
      const multi = this.redis.multi();
      const now = Date.now();
      const windowMs = windowSeconds * 1000;

      multi.zremrangebyscore(key, 0, now - windowMs);
      multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, windowSeconds);

      const results = await multi.exec();
      const count = (results?.[2]?.[1] as number) || 0;

      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetAt: Math.ceil((now + windowMs) / 1000),
      };
    } catch (error) {
      return { allowed: true, remaining: maxRequests, resetAt: 0 };
    }
  }

  // ==================== BRUTE FORCE PROTECTION ====================

  async recordFailedLogin(
    email: string,
    maxAttempts: number = 5,
    lockoutMinutes: number = 15,
  ): Promise<{ locked: boolean; attemptsLeft: number }> {
    if (!this.isEnabled || this._redisFailed) {
      return { locked: false, attemptsLeft: maxAttempts };
    }

    const key = `login:fail:${email.toLowerCase()}`;

    try {
      const attempts = await this.redis.incr(key);
      if (attempts === 1) {
        await this.redis.expire(key, lockoutMinutes * 60);
      }

      return {
        locked: attempts >= maxAttempts,
        attemptsLeft: Math.max(0, maxAttempts - attempts),
      };
    } catch (error) {
      return { locked: false, attemptsLeft: maxAttempts };
    }
  }

  async isAccountLocked(
    email: string,
    maxAttempts: number = 5,
  ): Promise<boolean> {
    if (!this.isEnabled || this._redisFailed) return false;
    const key = `login:fail:${email.toLowerCase()}`;

    try {
      const attempts = await this.redis.get(key);
      return attempts ? parseInt(attempts, 10) >= maxAttempts : false;
    } catch {
      return false;
    }
  }

  async clearFailedLogins(email: string): Promise<void> {
    if (!this.isEnabled || this._redisFailed) return;
    const key = `login:fail:${email.toLowerCase()}`;
    try {
      await this.redis.del(key);
    } catch (error) {}
  }

  // ==================== SESSION/BLACKLIST ====================

  async blacklistToken(
    token: string,
    expiresInSeconds: number,
  ): Promise<void> {
    if (!this.isEnabled || this._redisFailed) return;
    try {
      await this.redis.setex(`bl:${token}`, expiresInSeconds, '1');
    } catch (error) {}
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    if (!this.isEnabled || this._redisFailed) return false;
    try {
      const result = await this.redis.get(`bl:${token}`);
      return result === '1';
    } catch {
      return false;
    }
  }
}
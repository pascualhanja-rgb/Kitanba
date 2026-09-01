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

  constructor(@Inject('REDIS_CLIENT') private readonly redis: RedisClient) {
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
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // ==================== CACHE OPERATIONS ====================

  /**
   * Obter valor do cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(`Cache GET error for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Definir valor no cache com TTL
   * @param ttl Tempo de vida em segundos (default: 5 minutos)
   */
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
    } catch (error) {
      this.logger.warn(`Cache SET error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Eliminar valor do cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Cache DEL error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Eliminar múltiplas chaves por padrão
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        // Remover o prefixo para delete
        const keysWithoutPrefix = keys.map((k) =>
          k.replace(this.redis.options.keyPrefix || '', ''),
        );
        await this.redis.del(...keysWithoutPrefix);
      }
    } catch (error) {
      this.logger.warn(`Cache DEL pattern error: ${error.message}`);
    }
  }

  /**
   * Verificar se chave existe
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  /**
   * Incrementar contador
   */
  async incr(key: string, ttl?: number): Promise<number> {
    try {
      const value = await this.redis.incr(key);
      if (ttl && value === 1) {
        await this.redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      this.logger.warn(`Cache INCR error for key ${key}: ${error.message}`);
      return 0;
    }
  }

  // ==================== RATE LIMITING ====================

  /**
   * Verificar e aplicar rate limiting por IP
   */
  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `ratelimit:${identifier}`;

    try {
      const multi = this.redis.multi();
      const now = Date.now();
      const windowMs = windowSeconds * 1000;

      // Usar sorted set para sliding window
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
      this.logger.warn(`Rate limit check failed: ${error.message}`);
      // Em caso de erro, permitir acesso
      return { allowed: true, remaining: maxRequests, resetAt: 0 };
    }
  }

  // ==================== BRUTE FORCE PROTECTION ====================

  /**
   * Registar tentativa de login falhada
   */
  async recordFailedLogin(
    email: string,
    maxAttempts: number = 5,
    lockoutMinutes: number = 15,
  ): Promise<{ locked: boolean; attemptsLeft: number }> {
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
      this.logger.warn(`Failed login record error: ${error.message}`);
      return { locked: false, attemptsLeft: maxAttempts };
    }
  }

  /**
   * Verificar se conta está bloqueada
   */
  async isAccountLocked(
    email: string,
    maxAttempts: number = 5,
  ): Promise<boolean> {
    const key = `login:fail:${email.toLowerCase()}`;

    try {
      const attempts = await this.redis.get(key);
      return attempts ? parseInt(attempts, 10) >= maxAttempts : false;
    } catch {
      return false;
    }
  }

  /**
   * Limpar tentativas falhadas (após login bem-sucedido)
   */
  async clearFailedLogins(email: string): Promise<void> {
    const key = `login:fail:${email.toLowerCase()}`;
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Clear failed logins error: ${error.message}`);
    }
  }

  // ==================== SESSION/BLACKLIST ====================

  /**
   * Adicionar token à blacklist (logout)
   */
  async blacklistToken(
    token: string,
    expiresInSeconds: number,
  ): Promise<void> {
    const key = `blacklist:jwt`;
    try {
      await this.redis.setex(`bl:${token}`, expiresInSeconds, '1');
    } catch (error) {
      this.logger.warn(`Token blacklist error: ${error.message}`);
    }
  }

  /**
   * Verificar se token está na blacklist
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const result = await this.redis.get(`bl:${token}`);
      return result === '1';
    } catch {
      return false;
    }
  }
}

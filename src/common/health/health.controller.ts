import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service.js';

type CheckStatus = 'up' | 'down' | 'disabled';

/**
 * Health check usado pelo Render (healthCheckPath: /health).
 * Rápido (<1s) e sem throttling: verifica BD e Redis.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  async check() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const healthy = database === 'up';
    const body = {
      status: healthy ? (redis === 'up' ? 'ok' : 'degraded') : 'down',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };

    if (!healthy) {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }

  private async checkDatabase(): Promise<CheckStatus> {
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 2500),
        ),
      ]);
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) return 'disabled';
    return (await this.redisService.isConnected()) ? 'up' : 'down';
  }
}

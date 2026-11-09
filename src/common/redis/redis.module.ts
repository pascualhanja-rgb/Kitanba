import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createRequire } from 'node:module';
import { RedisService } from './redis.service.js';

const require = createRequire(import.meta.url);
const Redis = require('ioredis') as typeof import('ioredis').Redis;

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): InstanceType<typeof Redis> => {
        const redisUrl = configService.get<string>('REDIS_URL');
        const options = {
          keyPrefix: configService.get<string>('REDIS_KEY_PREFIX', 'kitanda:'),
          maxRetriesPerRequest: 2,
          connectTimeout: 5_000,
          retryStrategy(times: number) {
            return Math.min(times * 50, 2000);
          },
          lazyConnect: true,
        };

        // Render/Neon-style managed Redis fornece uma connection string
        if (redisUrl) {
          return new Redis(redisUrl, options);
        }

        return new Redis({
          ...options,
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get<number>('REDIS_DB', 0),
        });
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule implements OnModuleDestroy {
  constructor() {}

  async onModuleDestroy() {
    // Cleanup handled by RedisService
  }
}

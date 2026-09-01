import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OtpsService } from './otps.service.js';
import { OtpsController } from './otps.controller.js';
import { UserOtp } from '../users/entities/user-otp.entity.js';
import { CustomerPasswordReset } from '../users/entities/customer-password-reset.entity.js';
import { User } from '../users/entities/user.entity.js';
import { EmailModule } from '../email/email.module.js';
import { RedisModule } from '../common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOtp, CustomerPasswordReset, User]),
    EmailModule,
    RedisModule,
  ],
  controllers: [OtpsController],
  providers: [OtpsService],
  exports: [OtpsService],
})
export class OtpsModule {}

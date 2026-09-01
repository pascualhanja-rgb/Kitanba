import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';

import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { User } from './entities/user.entity.js';
import { UserOtp } from './entities/user-otp.entity.js';
import { CustomerPasswordReset } from './entities/customer-password-reset.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserOtp, CustomerPasswordReset]),
    PassportModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}

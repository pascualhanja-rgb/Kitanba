import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';
import { SellerPlan } from './entities/seller-plan.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([SellerPlan])],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}

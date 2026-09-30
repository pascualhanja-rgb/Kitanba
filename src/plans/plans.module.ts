import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';
import { PlanPermissionsService } from './plan-permissions.service.js';
import { SellerPlan } from './entities/seller-plan.entity.js';
import { Store } from '../stores/entities/store.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([SellerPlan, Store])],
  controllers: [PlansController],
  providers: [PlansService, PlanPermissionsService],
  exports: [PlansService, PlanPermissionsService],
})
export class PlansModule {}

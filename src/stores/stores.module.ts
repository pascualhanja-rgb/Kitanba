import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StoresController } from './stores.controller.js';
import { StoresService } from './stores.service.js';
import { Store } from './entities/store.entity.js';
import { PlanUpgradeRequest } from './entities/plan-upgrade-request.entity.js';
import { SellerPlanChange } from './entities/seller-plan-change.entity.js';
import { StoreStatusLog } from './entities/store-status-log.entity.js';
import { EmailModule } from '../email/email.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { RedisModule } from '../common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Store,
      PlanUpgradeRequest,
      SellerPlanChange,
      StoreStatusLog,
    ]),
    EmailModule,
    PlansModule,
    RedisModule,
  ],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}

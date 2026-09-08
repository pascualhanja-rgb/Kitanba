import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { Store } from '../stores/entities/store.entity.js';
import { StoreSubscriptionPayment } from '../subscriptions/entities/store-subscription-payment.entity.js';
import { SellerPlan } from '../plans/entities/seller-plan.entity.js';
import { Advertisement } from '../advertisements/entities/advertisement.entity.js';
import { AdPayment } from '../advertisements/entities/ad-payment.entity.js';
import { User } from '../users/entities/user.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Store,
      StoreSubscriptionPayment,
      SellerPlan,
      Advertisement,
      AdPayment,
      User,
    ]),
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}

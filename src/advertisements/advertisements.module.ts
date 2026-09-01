import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdvertisementsController } from './advertisements.controller.js';
import { AdvertisementsService } from './advertisements.service.js';
import { Advertisement } from './entities/advertisement.entity.js';
import { AdPricingPlan } from './entities/ad-pricing-plan.entity.js';
import { AdPayment } from './entities/ad-payment.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { RedisModule } from '../common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Advertisement, AdPricingPlan, AdPayment, Store]),
    RedisModule,
  ],
  controllers: [AdvertisementsController],
  providers: [AdvertisementsService],
  exports: [AdvertisementsService],
})
export class AdvertisementsModule {}

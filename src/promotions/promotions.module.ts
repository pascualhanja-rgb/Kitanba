import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';
import { PromotionalCampaign } from './entities/promotional-campaign.entity.js';
import { CampaignProduct } from './entities/campaign-product.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { RedisModule } from '../common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromotionalCampaign,
      CampaignProduct,
      Product,
      Store,
    ]),
    RedisModule,
  ],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}

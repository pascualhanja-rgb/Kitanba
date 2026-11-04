import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RealEstateController } from './real-estate.controller.js';
import { RealEstateService } from './real-estate.service.js';
import { RealEstateDetail } from './entities/real-estate-detail.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { RedisModule } from '../common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([RealEstateDetail, Product, Store]),
    RedisModule,
  ],
  controllers: [RealEstateController],
  providers: [RealEstateService],
  exports: [RealEstateService],
})
export class RealEstateModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductsController } from './products.controller.js';
import { ProductVariantsController } from './variants.controller.js';
import { ProductsService } from './products.service.js';
import { Product } from './entities/product.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductAttributeValue } from './entities/product-attribute-value.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { ServiceDetail } from '../services/entities/service-detail.entity.js';
import { RealEstateDetail } from '../real-estate/entities/real-estate-detail.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { RedisModule } from '../common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductImage,
      ProductAttributeValue,
      ProductVariant,
      ServiceDetail,
      RealEstateDetail,
      Store,
    ]),
    PromotionsModule,
    RedisModule,
  ],
  controllers: [ProductsController, ProductVariantsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}

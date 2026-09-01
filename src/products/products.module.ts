import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { Product } from './entities/product.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductAttributeValue } from './entities/product-attribute-value.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { RedisModule } from '../common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage, ProductAttributeValue, Store]),
    RedisModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}

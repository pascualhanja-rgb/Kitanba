import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { Cart } from './entities/cart.entity.js';
import { CartItem } from './entities/cart-item.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { ProductVariant } from '../products/entities/product-variant.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, Product, ProductVariant])],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}

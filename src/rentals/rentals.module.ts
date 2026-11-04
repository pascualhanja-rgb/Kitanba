import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  RentalAvailabilityController,
  RentalsController,
} from './rentals.controller.js';
import { RentalsService } from './rentals.service.js';
import { Rental } from './entities/rental.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Rental, Product, Store])],
  controllers: [RentalsController, RentalAvailabilityController],
  providers: [RentalsService],
  exports: [RentalsService],
})
export class RentalsModule {}

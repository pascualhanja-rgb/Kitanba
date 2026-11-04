import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { ServiceBooking } from './entities/service-booking.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { ServiceDetail } from '../services/entities/service-detail.entity.js';
import { StoreAffiliate } from '../affiliates/entities/store-affiliate.entity.js';
import { ServicesModule } from '../services/services.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceBooking,
      Product,
      Store,
      ServiceDetail,
      StoreAffiliate,
    ]),
    ServicesModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}

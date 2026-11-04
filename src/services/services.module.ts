import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
import { ServiceDetail } from './entities/service-detail.entity.js';
import { StoreServiceSchedule } from './entities/store-service-schedule.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { ServiceBooking } from '../bookings/entities/service-booking.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceDetail,
      StoreServiceSchedule,
      Product,
      Store,
      ServiceBooking,
    ]),
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}

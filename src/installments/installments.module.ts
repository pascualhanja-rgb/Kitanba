import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InstallmentsController } from './installments.controller.js';
import { InstallmentsService } from './installments.service.js';
import { Installment } from './entities/installment.entity.js';
import { Order } from '../orders/entities/order.entity.js';
import { Rental } from '../rentals/entities/rental.entity.js';
import { Store } from '../stores/entities/store.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Installment, Order, Rental, Store]),
  ],
  controllers: [InstallmentsController],
  providers: [InstallmentsService],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InvoicesController } from './invoices.controller.js';
import { BillingProfileController } from './billing-profile.controller.js';
import { InvoicesService } from './invoices.service.js';
import { Invoice } from './entities/invoice.entity.js';
import { InvoiceItem } from './entities/invoice-item.entity.js';
import { StoreBillingProfile } from './entities/store-billing-profile.entity.js';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { User } from '../users/entities/user.entity.js';
import { OrderItem } from '../orders/entities/order-item.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { RedisModule } from '../common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      StoreBillingProfile,
      Delivery,
      Store,
      User,
      OrderItem,
      Product,
    ]),
    RedisModule,
  ],
  controllers: [InvoicesController, BillingProfileController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}

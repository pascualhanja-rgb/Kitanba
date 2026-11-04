import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CallsController } from './calls.controller.js';
import { CallsService } from './calls.service.js';
import { CallLog } from './entities/call-log.entity.js';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { Order } from '../orders/entities/order.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { User } from '../users/entities/user.entity.js';
import { DeliveriesModule } from '../deliveries/deliveries.module.js';
import { RedisModule } from '../common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallLog, Delivery, Order, Store, User]),
    DeliveriesModule,
    RedisModule,
  ],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}

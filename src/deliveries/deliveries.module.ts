import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveriesController } from './deliveries.controller.js';
import { DeliveriesService } from './deliveries.service.js';
import { Delivery } from './entities/delivery.entity.js';
import { DeliveryTrackingLog } from './entities/delivery-tracking-log.entity.js';
import { Order } from '../orders/entities/order.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { User } from '../users/entities/user.entity.js';
import { TrackingGateway } from './realtime/tracking.gateway.js';
import { RealtimeService } from './realtime/realtime.service.js';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { ChatModule } from '../chat/chat.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, DeliveryTrackingLog, Order, Store, User]),
    InvoicesModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService, TrackingGateway, RealtimeService],
  exports: [RealtimeService],
})
export class DeliveriesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LivesController } from './lives.controller.js';
import { LivesService } from './lives.service.js';
import { LiveStream } from './entities/live-stream.entity.js';
import { LiveComment } from './entities/live-comment.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { SellerPlan } from '../plans/entities/seller-plan.entity.js';
import { User } from '../users/entities/user.entity.js';
import { DeliveriesModule } from '../deliveries/deliveries.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([LiveStream, LiveComment, Store, SellerPlan, User]),
    DeliveriesModule,
  ],
  controllers: [LivesController],
  providers: [LivesService],
  exports: [LivesService],
})
export class LivesModule {}

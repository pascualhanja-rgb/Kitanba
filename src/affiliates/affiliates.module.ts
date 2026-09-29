import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AffiliatesController } from './affiliates.controller.js';
import { AffiliatesService } from './affiliates.service.js';
import { StoreAffiliate } from './entities/store-affiliate.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { SellerPlan } from '../plans/entities/seller-plan.entity.js';
import { User } from '../users/entities/user.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoreAffiliate, Store, SellerPlan, User]),
  ],
  controllers: [AffiliatesController],
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}

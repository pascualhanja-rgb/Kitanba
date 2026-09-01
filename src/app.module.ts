import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { StoresModule } from './stores/stores.module.js';
import { ProductsModule } from './products/products.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { AdvertisementsModule } from './advertisements/advertisements.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { EmailModule } from './email/email.module.js';
import { PlansModule } from './plans/plans.module.js';
import { OtpsModule } from './otps/otps.module.js';
import { ChatModule } from './chat/chat.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { UploadModule } from './common/upload/upload.module.js';

import { ThrottlerGuardImpl } from './common/guards/throttler.guard.js';

// Entities
import { User } from './users/entities/user.entity.js';
import { UserOtp } from './users/entities/user-otp.entity.js';
import { CustomerPasswordReset } from './users/entities/customer-password-reset.entity.js';
import { FailedLoginAttempt } from './users/entities/failed-login-attempt.entity.js';
import { Store } from './stores/entities/store.entity.js';
import { SellerPlan } from './plans/entities/seller-plan.entity.js';
import { PlanUpgradeRequest } from './stores/entities/plan-upgrade-request.entity.js';
import { SellerPlanChange } from './stores/entities/seller-plan-change.entity.js';
import { StoreSubscriptionPayment } from './subscriptions/entities/store-subscription-payment.entity.js';
import { StoreStatusLog } from './stores/entities/store-status-log.entity.js';
import { Category } from './categories/entities/category.entity.js';
import { CategoryAttribute } from './categories/entities/category-attribute.entity.js';
import { Product } from './products/entities/product.entity.js';
import { ProductImage } from './products/entities/product-image.entity.js';
import { ProductAttributeValue } from './products/entities/product-attribute-value.entity.js';
import { AdPricingPlan } from './advertisements/entities/ad-pricing-plan.entity.js';
import { Advertisement } from './advertisements/entities/advertisement.entity.js';
import { AdPayment } from './advertisements/entities/ad-payment.entity.js';
import { ChatRoom } from './chat/entities/chat-room.entity.js';
import { Message } from './chat/entities/message.entity.js';

@Module({
  imports: [
    // Configuração de variáveis de ambiente
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TypeORM - Conexão com PostgreSQL (Neon)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_DATABASE', 'kitanda'),
        ssl: configService.get<string>('DB_HOST', 'localhost') !== 'localhost'
          ? { rejectUnauthorized: false }
          : false,
        entities: [
          User, UserOtp, CustomerPasswordReset, FailedLoginAttempt,
          Store, SellerPlan, PlanUpgradeRequest,
          SellerPlanChange, StoreSubscriptionPayment, StoreStatusLog,
          Category, CategoryAttribute,
          Product, ProductImage, ProductAttributeValue,
          AdPricingPlan, Advertisement, AdPayment,
          ChatRoom, Message,
        ],
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    // Rate Limiting Global
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),

    // Redis Cache
    RedisModule,

    // Módulos
    AuthModule,
    UsersModule,
    StoresModule,
    ProductsModule,
    CategoriesModule,
    AdvertisementsModule,
    SubscriptionsModule,
    EmailModule,
    PlansModule,
    OtpsModule,
    ChatModule,
    UploadModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuardImpl,
    },
  ],
})
export class AppModule {}

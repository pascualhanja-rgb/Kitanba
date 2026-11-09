import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
import { MetricsModule } from './metrics/metrics.module.js';
import { ChatModule } from './chat/chat.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { DeliveriesModule } from './deliveries/deliveries.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { PromotionsModule } from './promotions/promotions.module.js';
import { LivesModule } from './lives/lives.module.js';
import { AffiliatesModule } from './affiliates/affiliates.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { UploadModule } from './common/upload/upload.module.js';
import { HealthModule } from './common/health/health.module.js';

// Fase 3
import { CartModule } from './cart/cart.module.js';
import { RentalsModule } from './rentals/rentals.module.js';
import { ServicesModule } from './services/services.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { RealEstateModule } from './real-estate/real-estate.module.js';
import { InstallmentsModule } from './installments/installments.module.js';
import { CallsModule } from './calls/calls.module.js';

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

// Novas entidades
import { Order } from './orders/entities/order.entity.js';
import { OrderItem } from './orders/entities/order-item.entity.js';
import { Delivery } from './deliveries/entities/delivery.entity.js';
import { DeliveryTrackingLog } from './deliveries/entities/delivery-tracking-log.entity.js';
import { Invoice } from './invoices/entities/invoice.entity.js';
import { InvoiceItem } from './invoices/entities/invoice-item.entity.js';
import { StoreBillingProfile } from './invoices/entities/store-billing-profile.entity.js';
import { PromotionalCampaign } from './promotions/entities/promotional-campaign.entity.js';
import { CampaignProduct } from './promotions/entities/campaign-product.entity.js';
import { LiveStream } from './lives/entities/live-stream.entity.js';
import { LiveComment } from './lives/entities/live-comment.entity.js';
import { StoreAffiliate } from './affiliates/entities/store-affiliate.entity.js';

// Fase 3 — entidades
import { ProductVariant } from './products/entities/product-variant.entity.js';
import { Cart } from './cart/entities/cart.entity.js';
import { CartItem } from './cart/entities/cart-item.entity.js';
import { Rental } from './rentals/entities/rental.entity.js';
import { ServiceDetail } from './services/entities/service-detail.entity.js';
import { StoreServiceSchedule } from './services/entities/store-service-schedule.entity.js';
import { ServiceBooking } from './bookings/entities/service-booking.entity.js';
import { RealEstateDetail } from './real-estate/entities/real-estate-detail.entity.js';
import { Installment } from './installments/entities/installment.entity.js';
import { CallLog } from './calls/entities/call-log.entity.js';

// Novos recursos de serviços profissionais
import { ProfessionalSpecialty } from './professional-specialties/entities/professional-specialty.entity.js';
import { ProviderSpecialty } from './professional-specialties/entities/provider-specialty.entity.js';
import { ProviderPortfolioItem } from './professional-specialties/entities/provider-portfolio-item.entity.js';
import { ServiceQuoteRequest } from './professional-specialties/entities/service-quote-request.entity.js';

// Novos recursos de serviços profissionais — módulos
import { ProfessionalSpecialtiesModule } from './professional-specialties/professional-specialties.module.js';
import { ProfessionalSpecialtiesStoreModule } from './professional-specialties/professional-specialties-store.module.js';
import { ProfessionalSpecialtiesPublicModule } from './professional-specialties/professional-specialties-public.module.js';
import { ServiceQuoteRequestsClientModule } from './professional-specialties/service-quote-requests-client.module.js';
import { ProfessionalSpecialtiesVendorModule } from './professional-specialties/professional-specialties-vendor.module.js';

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
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const host = configService.get<string>('DB_HOST', 'localhost');
        const sslEnabled =
          configService.get<string>('DB_SSL') === 'true' ||
          (!databaseUrl && host !== 'localhost' && host !== '127.0.0.1');

        const poolMax = Number(configService.get<string>('DB_POOL_MAX', '10'));
        const shared = {
          entities: [
          User, UserOtp, CustomerPasswordReset, FailedLoginAttempt,
          Store, SellerPlan, PlanUpgradeRequest,
          SellerPlanChange, StoreSubscriptionPayment, StoreStatusLog,
          Category, CategoryAttribute,
          Product, ProductImage, ProductAttributeValue,
          AdPricingPlan, Advertisement, AdPayment,
          ChatRoom, Message,
          // Novas entidades
          Order, OrderItem,
          Delivery, DeliveryTrackingLog,
          Invoice, InvoiceItem, StoreBillingProfile,
          PromotionalCampaign, CampaignProduct,
          LiveStream, LiveComment,
          StoreAffiliate,
          // Fase 3
          ProductVariant,
          Cart, CartItem,
          Rental,
          ServiceDetail, StoreServiceSchedule,
          ServiceBooking,
          RealEstateDetail,
          Installment,
          CallLog,
          // Serviços profissionais
          ProfessionalSpecialty, ProviderSpecialty,
            ProviderPortfolioItem, ServiceQuoteRequest,
          ],
          synchronize: false,
          logging: configService.get<string>('NODE_ENV') !== 'production',
          ssl: sslEnabled ? { rejectUnauthorized: false } : false,
          // Pool dimensionado por instância. Neon: manter abaixo do limite do plano.
          extra: {
            max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
            min: 2,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            statement_timeout: 30_000,
            application_name: 'kitanda-api',
          },
          // Resiliência no arranque (Neon acorda em cold start)
          retryAttempts: 10,
          retryDelay: 3_000,
        };

        return databaseUrl
          ? { type: 'postgres' as const, url: databaseUrl, ...shared }
          : {
              type: 'postgres' as const,
              host,
              port: configService.get<number>('DB_PORT', 5432),
              username: configService.get<string>('DB_USERNAME', 'postgres'),
              password: configService.get<string>('DB_PASSWORD', ''),
              database: configService.get<string>('DB_DATABASE', 'kitanda'),
              ...shared,
            };
      },
    }),

    // Agendamentos (jobs de overdue de alugueres, parcelas e chamadas)
    ScheduleModule.forRoot(),

    // Rate Limiting Global (por IP real — trust proxy ativo no main.ts)
    // Limite configurável: default 300 req/min por IP, adequado a milhares de
    // utilizadores atrás de NAT móvel. Rotas sensíveis têm limites mais baixos.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl:
            Number(configService.get<string>('THROTTLE_TTL', '60')) * 1000,
          limit: Number(configService.get<string>('THROTTLE_LIMIT', '300')),
        },
      ],
    }),

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
    MetricsModule,
    OtpsModule,
    ChatModule,
    UploadModule,
    HealthModule,
    OrdersModule,
    DeliveriesModule,
    InvoicesModule,
    PromotionsModule,
    LivesModule,
    AffiliatesModule,
    // Fase 3
    CartModule,
    RentalsModule,
    ServicesModule,
    BookingsModule,
    RealEstateModule,
    InstallmentsModule,
    CallsModule,
    // Novos recursos de serviços profissionais
    ProfessionalSpecialtiesModule,
    ProfessionalSpecialtiesStoreModule,
    ProfessionalSpecialtiesPublicModule,
    ServiceQuoteRequestsClientModule,
    ProfessionalSpecialtiesVendorModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuardImpl,
    },
  ],
})
export class AppModule {}

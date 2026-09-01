import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../../auth/auth.module.js';
import { UploadService } from './upload.service.js';
import { UploadController } from './upload.controller.js';
import { UploadPresignedService } from './upload-presigned.service.js';
import { UploadPresignedController } from './upload-presigned.controller.js';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [UploadController, UploadPresignedController],
  providers: [
    {
      provide: 'CLOUDINARY_CONFIG',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
        api_key: configService.get<string>('CLOUDINARY_API_KEY'),
        api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
      }),
    },
    {
      provide: 'R2_CONFIG',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        account_id: configService.get<string>('R2_ACCOUNT_ID'),
        access_key_id: configService.get<string>('R2_ACCESS_KEY_ID'),
        secret_access_key: configService.get<string>('R2_SECRET_ACCESS_KEY'),
        bucket_name: configService.get<string>('R2_BUCKET_NAME'),
        public_domain: configService.get<string>('R2_PUBLIC_DOMAIN'),
      }),
    },
    UploadService,
    UploadPresignedService,
  ],
  exports: [UploadService, UploadPresignedService],
})
export class UploadModule {}

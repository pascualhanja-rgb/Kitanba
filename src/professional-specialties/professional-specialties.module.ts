import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfessionalSpecialtiesController } from './professional-specialties.controller.js';
import { ProfessionalSpecialtiesService } from './professional-specialties.service.js';
import { ProfessionalSpecialty } from './entities/professional-specialty.entity.js';
import { ProviderSpecialty } from './entities/provider-specialty.entity.js';
import { ProviderPortfolioItem } from './entities/provider-portfolio-item.entity.js';
import { ServiceQuoteRequest } from './entities/service-quote-request.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { User } from '../users/entities/user.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProfessionalSpecialty,
      ProviderSpecialty,
      ProviderPortfolioItem,
      ServiceQuoteRequest,
      Store,
      User,
    ]),
  ],
  controllers: [ProfessionalSpecialtiesController],
  providers: [ProfessionalSpecialtiesService],
  exports: [ProfessionalSpecialtiesService],
})
export class ProfessionalSpecialtiesModule {}

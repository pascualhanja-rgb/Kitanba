import { Module } from '@nestjs/common';

import { ServiceQuoteRequestsClientController } from './professional-specialties-client.controller.js';
import { ProfessionalSpecialtiesModule } from './professional-specialties.module.js';

@Module({
  imports: [ProfessionalSpecialtiesModule],
  controllers: [ServiceQuoteRequestsClientController],
})
export class ServiceQuoteRequestsClientModule {}

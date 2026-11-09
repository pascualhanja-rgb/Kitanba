import { Module } from '@nestjs/common';

import { ProfessionalSpecialtiesStoreAdminController } from './professional-specialties-store.controller.js';
import { ProfessionalSpecialtiesModule } from './professional-specialties.module.js';

@Module({
  imports: [ProfessionalSpecialtiesModule],
  controllers: [ProfessionalSpecialtiesStoreAdminController],
})
export class ProfessionalSpecialtiesStoreModule {}

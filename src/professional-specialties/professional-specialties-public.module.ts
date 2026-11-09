import { Module } from '@nestjs/common';

import { ProfessionalSpecialtiesPublicController } from './professional-specialties-public.controller.js';
import { ProfessionalSpecialtiesModule } from './professional-specialties.module.js';

@Module({
  imports: [ProfessionalSpecialtiesModule],
  controllers: [ProfessionalSpecialtiesPublicController],
})
export class ProfessionalSpecialtiesPublicModule {}

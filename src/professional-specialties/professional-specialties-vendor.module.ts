import { Module } from '@nestjs/common';

import { ProfessionalSpecialtiesVendorController } from './professional-specialties-vendor.controller.js';
import { ProfessionalSpecialtiesModule } from './professional-specialties.module.js';

@Module({
  imports: [ProfessionalSpecialtiesModule],
  controllers: [ProfessionalSpecialtiesVendorController],
})
export class ProfessionalSpecialtiesVendorModule {}

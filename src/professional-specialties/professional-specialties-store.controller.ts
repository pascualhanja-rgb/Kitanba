import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { ProfessionalSpecialtiesService } from './professional-specialties.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AssignSpecialtiesDto } from './dto/specialty-assign.dto.js';

@ApiTags('Store Specialties (Admin)')
@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class ProfessionalSpecialtiesStoreAdminController {
  constructor(
    private readonly service: ProfessionalSpecialtiesService,
  ) {}

  @Post(':storeId/specialties')
  @ApiOperation({ summary: 'Atribuir especialidades a uma loja (admin)' })
  @ApiResponse({ status: 200, description: 'Especialidades atribuídas' })
  @ApiResponse({ status: 400, description: 'Especialidades inválidas' })
  async assignSpecialties(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: AssignSpecialtiesDto,
  ) {
    return this.service.assignSpecialtiesToStore(storeId, 'admin-user', dto, false);
  }

  @Delete(':storeId/specialties/:specialtyId')
  @ApiOperation({ summary: 'Remover especialidade de uma loja (admin)' })
  @ApiResponse({ status: 200, description: 'Especialidade removida' })
  @ApiResponse({ status: 404, description: 'Associação não encontrada' })
  async removeSpecialty(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('specialtyId', ParseIntPipe) specialtyId: number,
  ) {
    return this.service.removeSpecialtyFromStore(storeId, 'admin-user', specialtyId, false);
  }
}

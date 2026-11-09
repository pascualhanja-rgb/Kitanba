import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { ProfessionalSpecialtiesService } from './professional-specialties.service.js';
import {
  CreateServiceQuoteRequestDto,
  UpdateServiceQuoteRequestDto,
  AcceptQuoteRequestDto,
  RejectQuoteRequestDto,
  ListQuoteRequestsQueryDto,
} from './dto/create-quote-request.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('Professional Specialties (Public)')
@Controller('professional-specialties')
export class ProfessionalSpecialtiesPublicController {
  constructor(
    private readonly service: ProfessionalSpecialtiesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar especialidades disponíveis (público)' })
  @ApiResponse({ status: 200, description: 'Lista de especialidades' })
  async listSpecialtiesPublic() {
    return this.service.listSpecialties(false);
  }

  @Get(':specialtyId/stores')
  @ApiOperation({
    summary: 'Listar lojas por especialidade (público)',
  })
  @ApiResponse({ status: 200, description: 'Lista de lojas ativas' })
  @ApiResponse({ status: 404, description: 'Especialidade não encontrada' })
  async getStoresBySpecialtyPublic(
    @Param('specialtyId', ParseIntPipe) specialtyId: number,
  ) {
    return this.service.getStoresBySpecialtyId(specialtyId, true);
  }

  @Get('stores/:storeId/portfolio')
  @ApiOperation({ summary: 'Portfólio de uma loja (público)' })
  @ApiResponse({ status: 200, description: 'Itens do portfólio' })
  @ApiResponse({ status: 404, description: 'Loja não encontrada' })
  async getStorePortfolioPublic(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.service.getStorePortfolio(storeId);
  }
}

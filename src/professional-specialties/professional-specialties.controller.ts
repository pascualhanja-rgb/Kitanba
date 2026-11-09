import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { ProfessionalSpecialtiesService } from './professional-specialties.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  CreateProfessionalSpecialtyDto,
  UpdateProfessionalSpecialtyDto,
} from './dto/create-professional-specialty.dto.js';
import { AssignSpecialtiesDto } from './dto/specialty-assign.dto.js';
import {
  CreatePortfolioItemDto,
  UpdatePortfolioItemDto,
} from './dto/create-portfolio-item.dto.js';
import {
  CreateServiceQuoteRequestDto,
  UpdateServiceQuoteRequestDto,
  AcceptQuoteRequestDto,
  RejectQuoteRequestDto,
  ProviderQuoteRequestDto,
  QuoteStateChangeDto,
  ListQuoteRequestsQueryDto,
} from './dto/create-quote-request.dto.js';
import { ListSpecialtiesQueryDto } from './dto/list-specialties-query.dto.js';

@ApiTags('Professional Specialties')
@Controller('professional-specialties')
export class ProfessionalSpecialtiesController {
  constructor(
    private readonly service: ProfessionalSpecialtiesService,
  ) {}

  // -------------------------------------------------------------------------
  // Specialty maintenance (admin)
  // -------------------------------------------------------------------------

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar especialidades profissionais' })
  @ApiResponse({ status: 200, description: 'Lista de especialidades' })
  async listSpecialties(
    @Query() query: ListSpecialtiesQueryDto,
  ) {
    return this.service.listSpecialties(query.include_inactive);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar especialidade profissional' })
  @ApiResponse({ status: 201, description: 'Especialidade criada' })
  @ApiResponse({ status: 400, description: 'Nome já utilizado' })
  async createSpecialty(
    @Body() dto: CreateProfessionalSpecialtyDto,
  ) {
    return this.service.createSpecialty(dto);
  }

  @Put(':id')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar especialidade profissional' })
  @ApiResponse({ status: 200, description: 'Especialidade atualizada' })
  @ApiResponse({ status: 404, description: 'Especialidade não encontrada' })
  async updateSpecialty(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProfessionalSpecialtyDto,
  ) {
    return this.service.updateSpecialty(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar especialidade profissional' })
  @ApiResponse({ status: 200, description: 'Especialidade eliminada' })
  @ApiResponse({ status: 400, description: 'Especialidade em uso por lojas' })
  async deleteSpecialty(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteSpecialty(id);
  }

  // -------------------------------------------------------------------------
  // Stores by specialty (admin + public)
  // -------------------------------------------------------------------------

  @Get(':specialtyId/stores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar lojas por especialidade (admin)',
  })
  @ApiResponse({ status: 200, description: 'Lista de lojas' })
  @ApiResponse({ status: 404, description: 'Especialidade não encontrada' })
  async getStoresBySpecialtyAdmin(
    @Param('specialtyId', ParseIntPipe) specialtyId: number,
  ) {
    return this.service.getStoresBySpecialtyId(specialtyId, true);
  }

  // -------------------------------------------------------------------------
  // Store specialties (admin)
  // -------------------------------------------------------------------------

  @Get('stores/:storeId/specialties')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Especialidades de uma loja (admin)' })
  @ApiResponse({ status: 200, description: 'Lista de especialidades' })
  @ApiResponse({ status: 404, description: 'Loja não encontrada' })
  async getStoreSpecialtiesAdmin(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.service.getStoreSpecialties(storeId);
  }

  @Post('stores/:storeId/specialties')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atribuir especialidades a uma loja (admin)' })
  @ApiResponse({ status: 200, description: 'Especialidades atribuídas' })
  async assignSpecialtiesToStoreAdmin(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: AssignSpecialtiesDto,
  ) {
    // Admin assign uses admin user id as owner check bypass via service
    return this.service.assignSpecialtiesToStore(storeId, 'admin-user', dto);
  }

  @Delete('stores/:storeId/specialties/:specialtyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remover especialidade de uma loja (admin)',
  })
  @ApiResponse({ status: 200, description: 'Especialidade removida' })
  @ApiResponse({ status: 404, description: 'Associação não encontrada' })
  async removeSpecialtyFromStoreAdmin(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('specialtyId', ParseIntPipe) specialtyId: number,
  ) {
    return this.service.removeSpecialtyFromStore(storeId, 'admin-user', specialtyId);
  }

  // -------------------------------------------------------------------------
  // Store portfolio (admin)
  // -------------------------------------------------------------------------

  @Get('stores/:storeId/portfolio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Portfólio de uma loja (admin)' })
  @ApiResponse({ status: 200, description: 'Itens do portfólio' })
  @ApiResponse({ status: 404, description: 'Loja não encontrada' })
  async getStorePortfolioAdmin(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.service.getStorePortfolio(storeId);
  }

  @Post('stores/:storeId/portfolio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adicionar item ao portfólio (admin)' })
  @ApiResponse({ status: 201, description: 'Item criado' })
  async addPortfolioItemAdmin(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreatePortfolioItemDto,
  ) {
    return this.service.addPortfolioItem(storeId, 'admin-user', dto);
  }

  @Put('stores/:storeId/portfolio/:portfolioId')
  @Patch('stores/:storeId/portfolio/:portfolioId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar item do portfólio (admin)' })
  @ApiResponse({ status: 200, description: 'Item atualizado' })
  @ApiResponse({ status: 404, description: 'Item não encontrado' })
  async updatePortfolioItemAdmin(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
    @Body() dto: UpdatePortfolioItemDto,
  ) {
    return this.service.updatePortfolioItem(storeId, 'admin-user', portfolioId, dto);
  }

  @Delete('stores/:storeId/portfolio/:portfolioId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar item do portfólio (admin)' })
  @ApiResponse({ status: 200, description: 'Item eliminado' })
  @ApiResponse({ status: 404, description: 'Item não encontrado' })
  async deletePortfolioItemAdmin(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
  ) {
    return this.service.deletePortfolioItem(storeId, 'admin-user', portfolioId);
  }

  // -------------------------------------------------------------------------
  // Quote requests (admin)
  // -------------------------------------------------------------------------

  @Get('quote-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar pedidos de orçamento (admin)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de orçamentos' })
  async listQuoteRequestsAdmin(
    @Query() query: ListQuoteRequestsQueryDto,
  ) {
    return this.service.listQuoteRequests(query);
  }

  @Get('quote-requests/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detalhes do pedido de orçamento (admin)' })
  @ApiResponse({ status: 200, description: 'Detalhes do orçamento' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  async getQuoteRequestAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getQuoteRequestById(id, user.id);
  }

  @Patch('quote-requests/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar estado e notas do orçamento (admin)' })
  @ApiResponse({ status: 200, description: 'Orçamento atualizado' })
  @ApiResponse({ status: 400, description: 'Transição inválida' })
  async updateQuoteRequestAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceQuoteRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateQuoteRequest(id, user.id, dto);
  }

  @Post('quote-requests/:id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aceitar e agendar orçamento (admin)' })
  @ApiResponse({ status: 200, description: 'Orçamento aceite' })
  @ApiResponse({ status: 400, description: 'Estado inválido para aceite' })
  async acceptQuoteRequestAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptQuoteRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.service.acceptQuoteRequest(id, user.id, dto);
  }

  @Post('quote-requests/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rejeitar orçamento (admin)' })
  @ApiResponse({ status: 200, description: 'Orçamento rejeitado' })
  @ApiResponse({ status: 400, description: 'Pedido já finalizado' })
  async rejectQuoteRequestAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectQuoteRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.service.rejectQuoteRequest(id, user.id, dto);
  }
}

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
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import {
  CreatePortfolioItemDto,
  UpdatePortfolioItemDto,
} from './dto/create-portfolio-item.dto.js';
import { AssignSpecialtiesDto } from './dto/specialty-assign.dto.js';
import {
  AcceptQuoteRequestDto,
  ProviderQuoteRequestDto,
  QuoteStateChangeDto,
  UpdateServiceQuoteRequestDto,
  ListQuoteRequestsQueryDto,
} from './dto/create-quote-request.dto.js';

@ApiTags('Professional Specialties (Vendor)')
@Controller('stores')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfessionalSpecialtiesVendorController {
  constructor(
    private readonly service: ProfessionalSpecialtiesService,
  ) {}

  // -------------------------------------------------------------------------
  // Specialty reference
  // -------------------------------------------------------------------------

  @Get('professional-specialties')
  @ApiOperation({ summary: 'Listar especialidades disponíveis (vendedor)' })
  @ApiResponse({ status: 200, description: 'Lista de especialidades' })
  async listSpecialtiesVendor() {
    return this.service.listSpecialties(false);
  }

  // -------------------------------------------------------------------------
  // Store specialties (own store)
  // -------------------------------------------------------------------------

  @Get(':storeId/specialties')
  @ApiOperation({ summary: 'Especialidades da minha loja' })
  @ApiResponse({ status: 200, description: 'Lista de especialidades da loja' })
  @ApiResponse({ status: 403, description: 'Loja não pertence ao vendedor' })
  @ApiResponse({ status: 404, description: 'Loja não encontrada' })
  async getStoreSpecialtiesVendor(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getStoreSpecialties(storeId);
  }

  @Post(':storeId/specialties')
  @ApiOperation({ summary: 'Atribuir especialidades à minha loja' })
  @ApiResponse({ status: 200, description: 'Especialidades atribuídas' })
  @ApiResponse({ status: 403, description: 'Loja não pertence ao vendedor' })
  async assignSpecialtiesToStoreVendor(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: AssignSpecialtiesDto,
    @CurrentUser() user: User,
  ) {
    return this.service.assignSpecialtiesToStore(storeId, user.id, dto, true);
  }

  @Delete(':storeId/specialties/:specialtyId')
  @ApiOperation({ summary: 'Remover especialidade da minha loja' })
  @ApiResponse({ status: 200, description: 'Especialidade removida' })
  @ApiResponse({ status: 403, description: 'Loja não pertence ao vendedor' })
  @ApiResponse({ status: 404, description: 'Associação não encontrada' })
  async removeSpecialtyFromStoreVendor(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('specialtyId', ParseIntPipe) specialtyId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.removeSpecialtyFromStore(storeId, user.id, specialtyId, true);
  }

  // -------------------------------------------------------------------------
  // Store portfolio (own store)
  // -------------------------------------------------------------------------

  @Get(':storeId/portfolio')
  @ApiOperation({ summary: 'Portfólio da minha loja' })
  @ApiResponse({ status: 200, description: 'Itens do portfólio' })
  @ApiResponse({ status: 403, description: 'Loja não pertence ao vendedor' })
  @ApiResponse({ status: 404, description: 'Loja não encontrada' })
  async getStorePortfolioVendor(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getStorePortfolio(storeId);
  }

  @Post(':storeId/portfolio')
  @ApiOperation({ summary: 'Adicionar item ao portfólio' })
  @ApiResponse({ status: 201, description: 'Item criado' })
  @ApiResponse({ status: 403, description: 'Loja não pertence ao vendedor' })
  async addPortfolioItemVendor(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreatePortfolioItemDto,
    @CurrentUser() user: User,
  ) {
    return this.service.addPortfolioItem(storeId, user.id, dto, true);
  }

  @Put(':storeId/portfolio/:portfolioId')
  @Patch(':storeId/portfolio/:portfolioId')
  @ApiOperation({ summary: 'Atualizar item do portfólio' })
  @ApiResponse({ status: 200, description: 'Item atualizado' })
  @ApiResponse({ status: 403, description: 'Loja não pertence ao vendedor' })
  @ApiResponse({ status: 404, description: 'Item não encontrado' })
  async updatePortfolioItemVendor(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
    @Body() dto: UpdatePortfolioItemDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updatePortfolioItem(storeId, user.id, portfolioId, dto, true);
  }

  @Delete(':storeId/portfolio/:portfolioId')
  @ApiOperation({ summary: 'Remover item do portfólio' })
  @ApiResponse({ status: 200, description: 'Item eliminado' })
  @ApiResponse({ status: 403, description: 'Loja não pertence ao vendedor' })
  @ApiResponse({ status: 404, description: 'Item não encontrado' })
  async deletePortfolioItemVendor(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.deletePortfolioItem(storeId, user.id, portfolioId, true);
  }

  // -------------------------------------------------------------------------
  // Received quote requests (own store)
  // -------------------------------------------------------------------------

  @Get('service-quote-requests/store/:storeId')
  @ApiOperation({ summary: 'Orçamentos recebidos pela loja' })
  @ApiResponse({ status: 200, description: 'Lista paginada de orçamentos' })
  @ApiResponse({ status: 403, description: 'Loja não pertence ao vendedor' })
  @ApiResponse({ status: 404, description: 'Loja não encontrada' })
  async getStoreQuoteRequests(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: ListQuoteRequestsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.service.getQuoteRequestsByStore(storeId, user.id, query);
  }

  @Get('service-quote-requests/:id')
  @ApiOperation({ summary: 'Detalhes do orçamento recebido' })
  @ApiResponse({ status: 200, description: 'Detalhes do orçamento' })
  @ApiResponse({ status: 403, description: 'Pedido não pertence à loja' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  async getQuoteRequestVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getQuoteRequestById(id, user.id);
  }

  @Post('service-quote-requests/:id/quote')
  @ApiOperation({ summary: 'Enviar proposta de orçamento' })
  @ApiResponse({ status: 200, description: 'Proposta enviada' })
  @ApiResponse({ status: 400, description: 'Pedido não está pending' })
  @ApiResponse({ status: 403, description: 'Loja não é a responsável' })
  async providerSubmitQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProviderQuoteRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.service.providerSubmitQuote(id, user.id, dto);
  }

  @Patch('service-quote-requests/:id')
  @ApiOperation({ summary: 'Atualizar estado/agendamento do orçamento' })
  @ApiResponse({ status: 200, description: 'Orçamento atualizado' })
  @ApiResponse({ status: 403, description: 'Loja não é a responsável' })
  async updateQuoteRequestVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceQuoteRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateQuoteRequest(id, user.id, dto);
  }

  @Post('service-quote-requests/:id/state')
  @ApiOperation({ summary: 'Iniciar ou completar orçamento' })
  @ApiResponse({ status: 200, description: 'Estado atualizado' })
  @ApiResponse({ status: 400, description: 'Estado inválido' })
  @ApiResponse({ status: 403, description: 'Loja não é a responsável' })
  async changeQuoteStateVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuoteStateChangeDto,
    @CurrentUser() user: User,
  ) {
    return this.service.changeQuoteState(id, user.id, dto);
  }
}

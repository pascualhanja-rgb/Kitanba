import {
  Controller,
  Get,
  Post,
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
  CreateServiceQuoteRequestDto,
  UpdateServiceQuoteRequestDto,
  AcceptQuoteRequestDto,
  RejectQuoteRequestDto,
  ListQuoteRequestsQueryDto,
} from './dto/create-quote-request.dto.js';

@ApiTags('Service Quote Requests (Client)')
@Controller('service-quote-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ServiceQuoteRequestsClientController {
  constructor(
    private readonly service: ProfessionalSpecialtiesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar solicitação de orçamento / visita técnica' })
  @ApiResponse({ status: 201, description: 'Solicitação criada' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async createQuoteRequest(
    @Body() dto: CreateServiceQuoteRequestDto,
    @CurrentUser() user: User,
  ) {
    const quote = await this.service.createQuoteRequestForCustomer(
      user.id,
      dto,
    );

    return {
      id: quote.id,
      store_id: quote.store_id,
      specialty_id: quote.specialty_id,
      title: quote.title,
      description: quote.description,
      photo_url: quote.photo_url,
      address: quote.address,
      latitude: quote.latitude,
      longitude: quote.longitude,
      status: quote.status,
      created_at: quote.created_at,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Meus pedidos de orçamento' })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  async listMyQuoteRequests(
    @Query() query: ListQuoteRequestsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.service.listQuoteRequests({
      ...query,
      customer_id: user.id,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do pedido de orçamento' })
  @ApiResponse({ status: 200, description: 'Detalhes do orçamento' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  async getQuoteRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getQuoteRequestById(id, user.id);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Aceitar orçamento e agendar visita' })
  @ApiResponse({ status: 200, description: 'Orçamento aceite' })
  @ApiResponse({ status: 400, description: 'Estado inválido para aceite' })
  async acceptQuoteRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptQuoteRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.service.acceptQuoteRequest(id, user.id, dto);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Recusar orçamento' })
  @ApiResponse({ status: 200, description: 'Orçamento recusado' })
  @ApiResponse({ status: 400, description: 'Pedido já finalizado' })
  async rejectQuoteRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectQuoteRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.service.rejectQuoteRequest(id, user.id, dto);
  }
}

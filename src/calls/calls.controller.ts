import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

import { CallsService } from './calls.service.js';
import { InitiateCallDto, UpdateCallStatusDto } from './dto/call.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Calls (VoIP)')
@Controller('calls')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Listar todas as chamadas (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'caller_id', required: false })
  @ApiQuery({ name: 'receiver_id', required: false })
  @ApiQuery({ name: 'delivery_id', required: false })
  @ApiQuery({ name: 'order_id', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('caller_id') callerId?: string,
    @Query('receiver_id') receiverId?: string,
    @Query('delivery_id') deliveryId?: string,
    @Query('order_id') orderId?: string,
  ) {
    return this.callsService.findAll(page ? Number(page) : 1, limit ? Number(limit) : 20, {
      status,
      caller_id: callerId,
      receiver_id: receiverId,
      delivery_id: deliveryId,
      order_id: orderId,
    });
  }

  @Get('my')
  @Roles('customer', 'seller')
  @ApiOperation({ summary: 'Meu histórico de chamadas' })
  async findMine(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.callsService.findMine(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('store')
  @Roles('seller')
  @ApiOperation({ summary: 'Chamadas da minha loja (Vendedor)' })
  async findByStore(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.callsService.findByStore(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('stats')
  @Roles('admin')
  @ApiOperation({ summary: 'Estatísticas de chamadas (Admin)' })
  async stats() {
    return this.callsService.stats();
  }

  @Get('blocked-attempts')
  @Roles('admin')
  @ApiOperation({ summary: 'Tentativas bloqueadas por motivo (Admin)' })
  async blockedAttempts() {
    return this.callsService.blockedAttempts();
  }

  @Get('eligibility')
  @Roles('seller', 'customer')
  @ApiOperation({
    summary: 'Verificar se posso ligar nesta entrega (botão Ligar)',
  })
  @ApiQuery({ name: 'delivery_id', required: true })
  async eligibility(
    @CurrentUser() user: any,
    @Query('delivery_id') deliveryId: string,
  ) {
    return this.callsService.eligibility(deliveryId, user);
  }

  @Get('ice-config')
  @Roles('customer', 'seller')
  @ApiOperation({
    summary: 'Credenciais STUN/TURN efémeras para WebRTC',
  })
  async iceConfig(@CurrentUser() user: any) {
    return this.callsService.iceConfig(user);
  }

  @Post()
  @Roles('seller', 'customer')
  @ApiOperation({
    summary:
      'Iniciar chamada — apenas vendedor/estafeta com entrega out_for_delivery',
  })
  @ApiResponse({ status: 201, description: 'Chamada iniciada' })
  @ApiResponse({ status: 403, description: 'Regra de segurança violada' })
  @ApiResponse({ status: 409, description: 'Já existe chamada ativa' })
  @ApiResponse({ status: 429, description: 'Limite de tentativas' })
  async initiate(@CurrentUser() user: any, @Body() dto: InitiateCallDto) {
    return this.callsService.initiate(dto, user);
  }

  @Patch(':id/status')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Atualizar estado da chamada' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCallStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.callsService.updateStatus(id, dto, user);
  }

  @Get(':id')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Detalhe da chamada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.callsService.findOne(id, user);
  }
}

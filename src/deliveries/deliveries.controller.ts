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
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { DeliveriesService } from './deliveries.service.js';
import {
  UpdateDeliveryStatusDto,
  TrackPositionDto,
} from './dto/update-delivery-status.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Deliveries')
@Controller('deliveries')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Listar todas as entregas da plataforma (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Lista de entregas com paginação' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.deliveriesService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  @Get('available')
  @UseGuards(RolesGuard)
  @Roles('customer', 'seller')
  @ApiOperation({ summary: 'Listar entregas pendentes disponíveis (estafeta/afiliado)' })
  async findAvailable(@CurrentUser() user: any) {
    return this.deliveriesService.findAvailable(user.id);
  }

  @Post(':id/accept')
  @UseGuards(RolesGuard)
  @Roles('customer', 'seller')
  @ApiOperation({ summary: 'Aceitar entrega (estafeta/afiliado)' })
  async accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.deliveriesService.accept(id, user.id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Atualizar status da entrega (picking_up/in_transit/delivered/cancelled)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Entrega atualizada. Se delivered: pedido vai para delivered e fatura é emitida.',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.deliveriesService.updateStatus(
      id,
      dto.status as any,
      user.id,
      user.user_type,
    );
  }

  @Post(':id/track')
  @ApiOperation({
    summary: 'Estafeta envia posição atual (GPS). Emite via WebSocket para o cliente.',
  })
  async track(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TrackPositionDto,
    @CurrentUser() user: any,
  ) {
    return this.deliveriesService.trackPosition(
      id,
      user.id,
      dto.latitude,
      dto.longitude,
      dto.heading,
      dto.speed,
    );
  }

  @Get('my')
  @ApiOperation({ summary: 'Listar entregas onde sou o cliente' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findMy(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.deliveriesService.findByCustomer(user.id, page || 1, limit || 20);
  }

  @Get('store')
  @UseGuards(RolesGuard)
  @Roles('seller')
  @ApiOperation({ summary: 'Listar entregas da minha loja (vendedor)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findByStore(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const storeId = await this.deliveriesService.resolveStoreId(user.id);
    return this.deliveriesService.findByStore(storeId, page || 1, limit || 20);
  }

  @Get(':id/track/latest')
  @ApiOperation({ summary: 'Última posição conhecida do estafeta' })
  async latestPosition(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.deliveriesService.getLatestPosition(id, user.id, user.user_type);
  }

  @Get(':id/track/history')
  @ApiOperation({ summary: 'Histórico completo de posições (rota percorrida)' })
  async trackingHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.deliveriesService.getTrackingHistory(id, user.id, user.user_type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter entrega por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.deliveriesService.findOne(id, user.id, user.user_type);
  }
}

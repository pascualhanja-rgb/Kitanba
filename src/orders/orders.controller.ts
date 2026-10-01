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

import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos os pedidos da plataforma (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Lista de pedidos com paginação' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.ordersService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar pedido (checkout para entrega em casa)' })
  @ApiResponse({ status: 201, description: 'Pedido criado' })
  @ApiResponse({ status: 400, description: 'Estoque insuficiente / produto inválido' })
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: any) {
    return this.ordersService.create(dto, user.id);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar meus pedidos (cliente)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findMy(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.findByCustomer(user.id, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('store')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar pedidos da minha loja (vendedor)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findByStore(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    const storeId = await this.ordersService.resolveStoreId(user.id);
    return this.ordersService.findByStore(storeId, page ? Number(page) : 1, limit ? Number(limit) : 20, status);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar pedido (cria entrega automaticamente)' })
  @ApiResponse({ status: 200, description: 'Pedido confirmado + entrega criada' })
  async confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.ordersService.confirm(id, user.id, user.user_type);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin', 'customer')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualizar status do pedido (preparing/out_for_delivery/delivered/cancelled)',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(id, status as any, user.id, user.user_type);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter pedido por ID (cliente da loja ou dono)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.ordersService.findOne(id, user.id, user.user_type);
  }
}
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
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { RentalsService } from './rentals.service.js';
import {
  CreateRentalDto,
  ExtendRentalDto,
  ForceRentalStatusDto,
  ReturnRentalDto,
} from './dto/rental.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Rentals')
@Controller('rentals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Listar todos os alugueres (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'store_id', required: false })
  @ApiQuery({ name: 'customer_id', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('store_id') storeId?: string,
    @Query('customer_id') customerId?: string,
  ) {
    return this.rentalsService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      { status, store_id: storeId, customer_id: customerId },
    );
  }

  @Get('my')
  @Roles('customer')
  @ApiOperation({ summary: 'Listar os meus alugueres (cliente)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findMine(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.rentalsService.findMine(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  @Get('store')
  @Roles('seller')
  @ApiOperation({ summary: 'Listar alugueres da minha loja (Vendedor)' })
  @ApiQuery({ name: 'store_id', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findByStore(
    @CurrentUser() user: any,
    @Query('store_id') storeId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.rentalsService.findByStore(
      storeId,
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  @Get('calendar')
  @Roles('seller')
  @ApiOperation({ summary: 'Agenda de ocupação do mês (Vendedor)' })
  @ApiQuery({ name: 'store_id' })
  @ApiQuery({ name: 'month', required: false, example: '2026-11' })
  async calendar(
    @CurrentUser() user: any,
    @Query('store_id') storeId: string,
    @Query('month') month?: string,
  ) {
    return this.rentalsService.calendar(storeId, user.id, month);
  }

  @Get('summary')
  @Roles('admin')
  @ApiOperation({ summary: 'Resumo de alugueres e cauções (Admin)' })
  async summary() {
    return this.rentalsService.summary();
  }

  @Post()
  @Roles('customer')
  @ApiOperation({ summary: 'Solicitar aluguer (cliente)' })
  @ApiResponse({ status: 201, description: 'Aluguer criado como pending' })
  @ApiResponse({ status: 409, description: 'Período indisponível' })
  async create(@CurrentUser() user: any, @Body() dto: CreateRentalDto) {
    return this.rentalsService.create(dto, user.id);
  }

  @Post(':id/extend')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Pedir extensão do aluguer' })
  async extend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendRentalDto,
    @CurrentUser() user: any,
  ) {
    return this.rentalsService.extend(id, dto, user.id, user.user_type);
  }

  @Patch(':id/extend')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Estender aluguer (alias PATCH)' })
  async extendPatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendRentalDto,
    @CurrentUser() user: any,
  ) {
    return this.rentalsService.extend(id, dto, user.id, user.user_type);
  }

  @Patch(':id/activate')
  @Roles('seller', 'admin')
  @ApiOperation({ summary: 'Ativar aluguer (Vendedor/Admin)' })
  async activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.rentalsService.activate(id, user.id, user.user_type);
  }

  @Patch(':id/return')
  @Roles('seller', 'admin')
  @ApiOperation({ summary: 'Registar devolução (returned/damaged)' })
  async returnRental(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnRentalDto,
    @CurrentUser() user: any,
  ) {
    return this.rentalsService.returnRental(id, dto, user.id, user.user_type);
  }

  @Patch(':id/cancel')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Cancelar aluguer' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.rentalsService.cancel(id, user.id, user.user_type);
  }

  @Patch(':id/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Forçar estado do aluguer com justificação (Admin)' })
  async forceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ForceRentalStatusDto,
  ) {
    return this.rentalsService.forceStatus(id, dto);
  }

  @Get(':id')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Detalhe do aluguer' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.rentalsService.findOne(id, user.id, user.user_type);
  }
}

/**
 * Disponibilidade pública de um produto de aluguer.
 * GET /products/:id/rental-availability
 */
@ApiTags('Rentals')
@Controller('products')
export class RentalAvailabilityController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get(':id/rental-availability')
  @ApiOperation({ summary: 'Verificar disponibilidade de aluguer (público)' })
  @ApiQuery({ name: 'start_date', required: true })
  @ApiQuery({ name: 'end_date', required: true })
  async availability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    return this.rentalsService.availability(id, startDate, endDate);
  }
}

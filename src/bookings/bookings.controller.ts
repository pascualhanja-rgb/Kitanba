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
} from '@nestjs/swagger';

import { BookingsService } from './bookings.service.js';
import {
  AssignProviderDto,
  CancelBookingDto,
  CreateBookingDto,
  RescheduleBookingDto,
  ServiceQuoteDto,
} from './dto/booking.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Service Bookings')
@Controller('service-bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Listar todos os agendamentos (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'store_id', required: false })
  @ApiQuery({ name: 'customer_id', required: false })
  @ApiQuery({ name: 'provider_id', required: false })
  @ApiQuery({ name: 'date', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('store_id') storeId?: string,
    @Query('customer_id') customerId?: string,
    @Query('provider_id') providerId?: string,
    @Query('date') date?: string,
  ) {
    return this.bookingsService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      {
        status,
        store_id: storeId,
        customer_id: customerId,
        provider_id: providerId,
        date,
      },
    );
  }

  @Get('my')
  @Roles('customer')
  @ApiOperation({ summary: 'Meus agendamentos (cliente)' })
  async findMine(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.bookingsService.findMine(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  @Get('store')
  @Roles('seller')
  @ApiOperation({ summary: 'Agendamentos da minha loja (Vendedor)' })
  @ApiQuery({ name: 'store_id', required: true })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findByStore(
    @CurrentUser() user: any,
    @Query('store_id') storeId: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.bookingsService.findByStore(
      storeId,
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      { date, status },
    );
  }

  @Get('stats')
  @Roles('admin')
  @ApiOperation({ summary: 'Indicadores de agendamentos (Admin)' })
  async stats() {
    return this.bookingsService.stats();
  }

  @Post()
  @Roles('customer')
  @ApiOperation({ summary: 'Criar agendamento de serviço (cliente)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto, user.id);
  }

  @Patch(':id/confirm')
  @Roles('seller', 'admin')
  @ApiOperation({ summary: 'Confirmar agendamento (Vendedor/Admin)' })
  async confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.bookingsService.confirm(id, user);
  }

  @Patch(':id/reschedule')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Reagendar serviço' })
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.reschedule(id, dto, user);
  }

  @Patch(':id/quote')
  @Roles('seller', 'admin')
  @ApiOperation({ summary: 'Enviar orçamento (quote_required)' })
  async quote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ServiceQuoteDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.sendQuote(id, dto, user);
  }

  @Post(':id/accept-quote')
  @Roles('customer')
  @ApiOperation({ summary: 'Aceitar orçamento (cliente)' })
  async acceptQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.acceptQuote(id, user.id);
  }

  @Post(':id/reject-quote')
  @Roles('customer')
  @ApiOperation({ summary: 'Recusar orçamento (cliente)' })
  async rejectQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.rejectQuote(id, user.id);
  }

  @Patch(':id/assign-provider')
  @Roles('seller', 'admin')
  @ApiOperation({ summary: 'Atribuir prestador da equipe' })
  async assignProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignProviderDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.assignProvider(id, dto, user);
  }

  @Patch(':id/start')
  @Roles('seller', 'customer', 'admin')
  @ApiOperation({ summary: 'Iniciar execução do serviço' })
  async start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.bookingsService.start(id, user);
  }

  @Patch(':id/complete')
  @Roles('seller', 'customer', 'admin')
  @ApiOperation({ summary: 'Concluir execução do serviço' })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.complete(id, user);
  }

  @Patch(':id/cancel')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Cancelar agendamento' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.cancel(id, dto, user);
  }

  @Get(':id')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Detalhe do agendamento' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.bookingsService.findOne(id, user);
  }
}

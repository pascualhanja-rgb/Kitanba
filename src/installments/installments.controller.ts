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

import { InstallmentsService } from './installments.service.js';
import {
  CancelInstallmentDto,
  CreateInstallmentPlanDto,
  MarkInstallmentPaidDto,
  PayInstallmentDto,
} from './dto/installment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Installments')
@Controller('installments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Listar todas as parcelas (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'store_id', required: false })
  @ApiQuery({ name: 'customer_id', required: false })
  @ApiQuery({ name: 'due_from', required: false })
  @ApiQuery({ name: 'due_to', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('store_id') storeId?: string,
    @Query('customer_id') customerId?: string,
    @Query('due_from') dueFrom?: string,
    @Query('due_to') dueTo?: string,
  ) {
    return this.installmentsService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      {
        status,
        store_id: storeId,
        customer_id: customerId,
        due_from: dueFrom,
        due_to: dueTo,
      },
    );
  }

  @Get('my')
  @Roles('customer')
  @ApiOperation({ summary: 'Minhas parcelas (cliente)' })
  async findMine(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.installmentsService.findMine(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  @Get('my/summary')
  @Roles('customer')
  @ApiOperation({ summary: 'Resumo financeiro do cliente' })
  async summaryMine(@CurrentUser() user: any) {
    return this.installmentsService.summaryMine(user.id);
  }

  @Get('store')
  @Roles('seller')
  @ApiOperation({ summary: 'Parcelas da minha loja (Vendedor)' })
  @ApiQuery({ name: 'store_id', required: true })
  async findByStore(
    @CurrentUser() user: any,
    @Query('store_id') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('due_from') dueFrom?: string,
    @Query('due_to') dueTo?: string,
  ) {
    return this.installmentsService.findByStore(
      storeId,
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      { status, due_from: dueFrom, due_to: dueTo },
    );
  }

  @Get('store/summary')
  @Roles('seller')
  @ApiOperation({ summary: 'Resumo de parcelas da loja' })
  @ApiQuery({ name: 'store_id', required: true })
  async storeSummary(
    @CurrentUser() user: any,
    @Query('store_id') storeId: string,
  ) {
    return this.installmentsService.storeSummary(storeId, user.id);
  }

  @Get('summary')
  @Roles('admin')
  @ApiOperation({ summary: 'Resumo global de parcelas (Admin)' })
  async summary() {
    return this.installmentsService.summary();
  }

  @Get('overdue-report')
  @Roles('admin')
  @ApiOperation({ summary: 'Relatório de inadimplência (Admin)' })
  @ApiQuery({ name: 'min_days_overdue', required: false, type: Number })
  @ApiQuery({ name: 'group_by', required: false, enum: ['store', 'customer'] })
  async overdueReport(
    @Query('min_days_overdue') minDays?: number,
    @Query('group_by') groupBy?: 'store' | 'customer',
  ) {
    return this.installmentsService.overdueReport(
      minDays ? Number(minDays) : 1,
      groupBy === 'customer' ? 'customer' : 'store',
    );
  }

  @Post()
  @Roles('seller', 'admin')
  @ApiOperation({ summary: 'Criar plano de prestações (Vendedor/Admin)' })
  async createPlan(
    @CurrentUser() user: any,
    @Body() dto: CreateInstallmentPlanDto,
  ) {
    return this.installmentsService.createPlan(dto, user.id, user.user_type);
  }

  @Post(':id/pay')
  @Roles('customer')
  @ApiOperation({ summary: 'Submeter comprovativo (cliente)' })
  async pay(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayInstallmentDto,
    @CurrentUser() user: any,
  ) {
    return this.installmentsService.pay(id, dto, user.id);
  }

  @Patch(':id/paid')
  @Roles('seller', 'admin')
  @ApiOperation({ summary: 'Confirmar pagamento (Vendedor/Admin)' })
  async markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkInstallmentPaidDto,
    @CurrentUser() user: any,
  ) {
    return this.installmentsService.markPaid(id, dto, user.id, user.user_type);
  }

  @Patch(':id/cancel')
  @Roles('seller', 'admin')
  @ApiOperation({ summary: 'Cancelar parcela (Vendedor/Admin)' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelInstallmentDto,
    @CurrentUser() user: any,
  ) {
    return this.installmentsService.cancel(id, dto, user.id, user.user_type);
  }

  @Get(':id')
  @Roles('customer', 'seller', 'admin')
  @ApiOperation({ summary: 'Detalhe da parcela' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.installmentsService.findOne(id, user.id, user.user_type);
  }
}

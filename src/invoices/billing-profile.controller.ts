import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { InvoicesService } from './invoices.service.js';
import {
  CreateBillingProfileDto,
  UpdateBillingProfileDto,
} from './dto/billing-profile.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Billing Profiles')
@Controller('billing-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('seller')
@ApiBearerAuth()
export class BillingProfileController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar perfil fiscal da loja (vendedor)' })
  async create(
    @Body() dto: CreateBillingProfileDto,
    @CurrentUser() user: any,
  ) {
    const storeId = await this.invoicesService.resolveStoreId(user.id);
    return this.invoicesService.createBillingProfile(storeId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Obter perfil fiscal da minha loja (vendedor)' })
  async findOne(@CurrentUser() user: any) {
    const storeId = await this.invoicesService.resolveStoreId(user.id);
    return this.invoicesService.getBillingProfile(storeId);
  }

  @Put()
  @ApiOperation({ summary: 'Atualizar perfil fiscal da minha loja (vendedor)' })
  async update(
    @Body() dto: UpdateBillingProfileDto,
    @CurrentUser() user: any,
  ) {
    const storeId = await this.invoicesService.resolveStoreId(user.id);
    return this.invoicesService.updateBillingProfile(storeId, dto);
  }
}

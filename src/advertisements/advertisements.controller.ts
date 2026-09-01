import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AdvertisementsService } from './advertisements.service.js';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('Advertisements')
@Controller('advertisements')
export class AdvertisementsController {
  constructor(private readonly adsService: AdvertisementsService) {}

  // ==================== PÚBLICO ====================

  @Get('active')
  @ApiOperation({ summary: 'Listar anúncios ativos (público)' })
  async findActive() {
    return this.adsService.findActive();
  }

  @Get('plans')
  @ApiOperation({ summary: 'Listar planos de publicidade disponíveis' })
  async findAdPlans() {
    return this.adsService.findActiveAdPlans();
  }

  // ==================== VENDEDOR ====================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar anúncio (Vendedor) - store_id resolvido automaticamente' })
  async create(
    @Body() dto: CreateAdvertisementDto,
    @CurrentUser() user: User,
  ) {
    // Resolver store_id a partir do vendedor
    const storeId = await this.adsService.resolveStoreId(user.id);
    return this.adsService.create(dto, storeId);
  }

  @Get('my/:storeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar anúncios da minha loja' })
  async findByStore(
    @Param('storeId') storeId: string,
    @CurrentUser() user: User,
  ) {
    // Verificar ownership
    await this.adsService.verifyStoreOwnership(storeId, user.id);
    return this.adsService.findByStore(storeId);
  }

  // ==================== ADMIN ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos os anúncios (Admin)' })
  async findAll(@Query('status') status?: string) {
    return this.adsService.findAll(status);
  }

  @Get('admin/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos os planos de publicidade (Admin)' })
  async findAllAdPlans() {
    return this.adsService.findAllAdPlans();
  }

  @Post('admin/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar plano de publicidade (Admin)' })
  async createAdPlan(@Body() dto: any) {
    return this.adsService.createAdPlan(dto);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprovar anúncio (Admin)' })
  async approve(@Param('id') id: string) {
    return this.adsService.approve(id);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeitar anúncio (Admin)' })
  async reject(@Param('id') id: string) {
    return this.adsService.reject(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar anúncio (Admin)' })
  async remove(@Param('id') id: string) {
    return this.adsService.remove(id);
  }
}

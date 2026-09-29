import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
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

import { PromotionsService } from './promotions.service.js';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
} from './dto/create-campaign.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Promotional Campaigns')
@Controller('campaigns')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // ==================== PÚBLICO ====================

  @Get('active')
  @ApiOperation({ summary: 'Listar campanhas ativas agora (público - "Sextou")' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findActiveNow(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.promotionsService.findActiveNow(page || 1, limit || 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter campanha por ID (público)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.findOne(id);
  }

  // ==================== VENDEDOR ====================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar campanha promocional (vendedor)' })
  async create(@Body() dto: CreateCampaignDto, @CurrentUser() user: any) {
    const storeId = await this.promotionsService.resolveStoreId(user.id);
    return this.promotionsService.create(dto, storeId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar campanhas da minha loja (vendedor)' })
  async findByStore(@CurrentUser() user: any) {
    const storeId = await this.promotionsService.resolveStoreId(user.id);
    return this.promotionsService.findByStore(storeId);
  }

  @Put(':id')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar campanha (vendedor)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: any,
  ) {
    const storeId = await this.promotionsService.resolveStoreId(user.id);
    return this.promotionsService.update(id, dto, storeId);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ativar/desativar campanha (vendedor)' })
  async toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const storeId = await this.promotionsService.resolveStoreId(user.id);
    return this.promotionsService.toggleActive(id, storeId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar campanha (vendedor)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const storeId = await this.promotionsService.resolveStoreId(user.id);
    return this.promotionsService.remove(id, storeId);
  }
}

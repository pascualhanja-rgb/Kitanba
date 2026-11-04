import {
  Controller,
  Get,
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

import { RealEstateService } from './real-estate.service.js';
import {
  SuspendListingDto,
  UpdateRealEstateDto,
} from './dto/real-estate.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Real Estate')
@Controller('real-estate')
export class RealEstateController {
  constructor(private readonly realEstateService: RealEstateService) {}

  @Get()
  @ApiOperation({ summary: 'Listar imóveis (público)' })
  @ApiQuery({ name: 'transaction_type', required: false })
  @ApiQuery({ name: 'property_type', required: false })
  @ApiQuery({ name: 'bedrooms_min', required: false, type: Number })
  @ApiQuery({ name: 'bathrooms_min', required: false, type: Number })
  @ApiQuery({ name: 'area_sqm_min', required: false, type: Number })
  @ApiQuery({ name: 'store_id', required: false })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('transaction_type') transactionType?: string,
    @Query('property_type') propertyType?: string,
    @Query('bedrooms_min') bedroomsMin?: number,
    @Query('bathrooms_min') bathroomsMin?: number,
    @Query('area_sqm_min') areaMin?: number,
    @Query('store_id') storeId?: string,
    @Query('is_active') isActive?: string,
  ) {
    return this.realEstateService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      {
        transaction_type: transactionType,
        property_type: propertyType,
        bedrooms_min: bedroomsMin ? Number(bedroomsMin) : undefined,
        bathrooms_min: bathroomsMin ? Number(bathroomsMin) : undefined,
        area_sqm_min: areaMin ? Number(areaMin) : undefined,
        store_id: storeId,
        is_active:
          isActive === undefined
            ? true
            : isActive === 'true' || isActive === '1',
      },
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Meus imóveis (Vendedor)' })
  async findMine(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.realEstateService.findMine(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estatísticas de imóveis (Admin)' })
  async stats() {
    return this.realEstateService.stats();
  }

  @Put(':productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar imóvel (Vendedor)' })
  async update(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateRealEstateDto,
    @CurrentUser() user: any,
  ) {
    return this.realEstateService.update(productId, dto, user.id);
  }

  @Patch(':productId/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pausar/retomar anúncio (Vendedor)' })
  async toggleActive(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: any,
  ) {
    return this.realEstateService.toggleActive(productId, user.id);
  }

  @Delete(':productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover anúncio (bloqueado com aluguer ativo)' })
  async remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: any,
  ) {
    return this.realEstateService.remove(productId, user.id);
  }

  @Patch(':productId/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suspender anúncio (Admin)' })
  async suspend(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SuspendListingDto,
  ) {
    return this.realEstateService.suspend(productId, dto.reason);
  }

  @Patch(':productId/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reativar anúncio (Admin)' })
  async activate(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.realEstateService.activate(productId);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Detalhe do imóvel (público)' })
  async findOne(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.realEstateService.findOne(productId);
  }
}

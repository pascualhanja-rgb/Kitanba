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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Head,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar produtos (público)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({
    name: 'product_type',
    required: false,
    enum: ['physical', 'rental', 'food', 'service'],
  })
  @ApiQuery({
    name: 'condition_type',
    required: false,
    enum: ['new', 'used', 'refurbished'],
  })
  @ApiQuery({ name: 'rental_period_type', required: false })
  @ApiQuery({ name: 'requires_towing', required: false, type: Boolean })
  @ApiQuery({ name: 'min_price', required: false, type: Number })
  @ApiQuery({ name: 'max_price', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista de produtos' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('categoryId') categoryId?: number,
    @Query('search') search?: string,
    @Query('storeId') storeId?: string,
    @Query('product_type') productType?: string,
    @Query('condition_type') conditionType?: string,
    @Query('rental_period_type') rentalPeriodType?: string,
    @Query('requires_towing') requiresTowing?: string,
    @Query('min_price') minPrice?: number,
    @Query('max_price') maxPrice?: number,
  ) {
    return this.productsService.findAll(page ? Number(page) : 1, limit ? Number(limit) : 20, {
      categoryId: categoryId ? Number(categoryId) : undefined,
      search,
      storeId,
      product_type: productType,
      condition_type: conditionType,
      rental_period_type: rentalPeriodType,
      requires_towing:
        requiresTowing === undefined
          ? undefined
          : requiresTowing === 'true' || requiresTowing === '1',
      min_price: minPrice !== undefined ? Number(minPrice) : undefined,
      max_price: maxPrice !== undefined ? Number(maxPrice) : undefined,
    });
  }

  @Get('admin/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resumo do catálogo por tipo/condição (Admin)' })
  async adminSummary() {
    return this.productsService.catalogSummary();
  }

  @Get('store/:storeId')
  @ApiOperation({ summary: 'Listar produtos de uma loja' })
  async findByStore(
    @Param('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.findByStore(storeId, page || 1, limit || 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter produto por ID' })
  @ApiResponse({ status: 200, description: 'Produto encontrado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar produto (Vendedor) - store_id é resolvido automaticamente' })
  @ApiResponse({ status: 201, description: 'Produto criado' })
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: User,
  ) {
    // Buscar store_id a partir do utilizador vendedor
    const storeId = await this.productsService.resolveStoreId(user.id);
    return this.productsService.create(createProductDto, storeId);
  }

  @Put(':id')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar produto (Vendedor/Admin)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: User,
  ) {
    return this.productsService.update(id, updateProductDto, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar produto (Vendedor/Admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.productsService.remove(id, user.id);
  }

  @Head(':id')
  @ApiOperation({ summary: 'Verificar se produto existe (HEAD)' })
  async checkExists(@Param('id', ParseUUIDPipe) id: string) {
    await this.productsService.findOne(id);
    return {};
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ativar/desativar produto' })
  async toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.productsService.toggleActive(id, user.id);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

import { ProductsService } from './products.service.js';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Product Variants')
@Controller()
export class ProductVariantsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products/:id/variants')
  @ApiOperation({ summary: 'Listar variantes ativas de um produto (público)' })
  async list(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.listVariants(id, true);
  }

  @Post('products/:id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar variante (Vendedor)' })
  @ApiResponse({ status: 201, description: 'Variante criada' })
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVariantDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.addVariant(id, dto, user.id);
  }

  @Patch('product-variants/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar variante (Vendedor/Admin)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.updateVariant(id, dto, user.id);
  }

  @Delete('product-variants/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desativar variante (mantém histórico)' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.productsService.deactivateVariant(id, user.id);
  }
}

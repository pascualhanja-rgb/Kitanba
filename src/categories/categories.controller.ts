import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
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

import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { CreateCategoryAttributeDto } from './dto/create-category-attribute.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar categorias (árvore)' })
  @ApiResponse({ status: 200, description: 'Lista de categorias' })
  async findAll() {
    return this.categoriesService.findAll();
  }

  @Get('flat')
  @ApiOperation({ summary: 'Listar categorias (flat)' })
  @ApiResponse({ status: 200, description: 'Lista de categorias' })
  async findAllFlat() {
    return this.categoriesService.findAllFlat();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter categoria por ID' })
  @ApiResponse({ status: 200, description: 'Categoria encontrada' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  async findOne(@Param('id') id: number) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar categoria (Admin)' })
  @ApiResponse({ status: 201, description: 'Categoria criada' })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Put(':id')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar categoria (Admin)' })
  @ApiResponse({ status: 200, description: 'Categoria atualizada' })
  async update(
    @Param('id') id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar categoria (Admin)' })
  @ApiResponse({ status: 200, description: 'Categoria eliminada' })
  async remove(@Param('id') id: number) {
    return this.categoriesService.remove(id);
  }

  // ==================== ATRIBUTOS ====================

  @Get(':id/attributes')
  @ApiOperation({ summary: 'Listar atributos da categoria' })
  async findAttributes(@Param('id') id: number) {
    return this.categoriesService.findAttributes(id);
  }

  @Post(':id/attributes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar atributo para categoria (Admin)' })
  async createAttribute(
    @Param('id') id: number,
    @Body() dto: CreateCategoryAttributeDto,
  ) {
    return this.categoriesService.createAttribute(id, dto);
  }

  @Delete('attributes/:attributeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar atributo (Admin)' })
  async removeAttribute(@Param('attributeId') attributeId: number) {
    return this.categoriesService.removeAttribute(attributeId);
  }
}

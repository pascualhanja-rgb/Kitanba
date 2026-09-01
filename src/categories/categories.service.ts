import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';

import { Category } from './entities/category.entity.js';
import { CategoryAttribute } from './entities/category-attribute.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { CreateCategoryAttributeDto } from './dto/create-category-attribute.dto.js';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CategoryAttribute)
    private readonly attributeRepository: Repository<CategoryAttribute>,
  ) {}

  /**
   * Gerar slug
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  /**
   * Listar todas as categorias (árvore)
   */
  async findAll() {
    return this.categoryRepository.find({
      relations: ['children', 'attributes'],
      where: { parent_id: IsNull() },
      order: { name: 'ASC' },
    });
  }

  /**
   * Listar todas as categorias (flat)
   */
  async findAllFlat() {
    return this.categoryRepository.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * Obter categoria por ID
   */
  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['children', 'attributes'],
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    return category;
  }

  /**
   * Criar categoria (Admin)
   */
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const slug = this.generateSlug(createCategoryDto.name);

    // Verificar se o slug já existe
    const existing = await this.categoryRepository.findOne({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('Já existe uma categoria com este nome');
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      slug,
    });

    const saved = await this.categoryRepository.save(category);

    this.logger.log(`Nova categoria criada: ${saved.name}`);

    return saved;
  }

  /**
   * Atualizar categoria (Admin)
   */
  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);

    if (updateCategoryDto.name) {
      category.slug = this.generateSlug(updateCategoryDto.name);
    }

    Object.assign(category, updateCategoryDto);
    const saved = await this.categoryRepository.save(category);

    this.logger.log(`Categoria ${id} atualizada`);

    return saved;
  }

  /**
   * Eliminar categoria (Admin)
   */
  async remove(id: number) {
    const category = await this.findOne(id);

    await this.categoryRepository.remove(category);

    this.logger.log(`Categoria ${id} eliminada`);

    return { message: 'Categoria eliminada com sucesso' };
  }

  // ==================== ATRIBUTOS ====================

  /**
   * Listar atributos de uma categoria
   */
  async findAttributes(categoryId: number) {
    return this.attributeRepository.find({
      where: { category_id: categoryId },
    });
  }

  /**
   * Criar atributo para categoria (Admin)
   */
  async createAttribute(
    categoryId: number,
    dto: CreateCategoryAttributeDto,
  ): Promise<CategoryAttribute> {
    // Verificar se a categoria existe
    await this.findOne(categoryId);

    const attribute = this.attributeRepository.create({
      ...dto,
      category_id: categoryId,
    });

    const saved = await this.attributeRepository.save(attribute);

    this.logger.log(`Novo atributo criado para categoria ${categoryId}`);

    return saved;
  }

  /**
   * Eliminar atributo (Admin)
   */
  async removeAttribute(attributeId: number) {
    const attribute = await this.attributeRepository.findOne({
      where: { id: attributeId },
    });

    if (!attribute) {
      throw new NotFoundException('Atributo não encontrado');
    }

    await this.attributeRepository.remove(attribute);

    return { message: 'Atributo eliminado com sucesso' };
  }
}

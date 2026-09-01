import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';

import { Product } from './entities/product.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductAttributeValue } from './entities/product-attribute-value.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { RedisService } from '../common/redis/redis.service.js';
import { sanitizeHtml } from '../common/utils/sanitize.util.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly CACHE_TTL = 300; // 5 minutos

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly imageRepository: Repository<ProductImage>,
    @InjectRepository(ProductAttributeValue)
    private readonly attributeValueRepository: Repository<ProductAttributeValue>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Resolver store_id a partir do user_id (vendedor)
   * Cada vendedor só pode ter uma loja ativa
   */
  async resolveStoreId(userId: string): Promise<string> {
    const cacheKey = `seller:store:${userId}`;

    // Tentar cache
    const cached = await this.redisService.get<string>(cacheKey);
    if (cached) return cached;

    const store = await this.storeRepository.findOne({
      where: { owner_id: userId, status: 'active' },
    });

    if (!store) {
      throw new ForbiddenException(
        'Utilizador não possui uma loja ativa. Crie uma loja primeiro.',
      );
    }

    // Guardar em cache
    await this.redisService.set(cacheKey, store.id, 600);

    return store.id;
  }

  /**
   * Criar produto
   */
  async create(createProductDto: CreateProductDto, storeId: string) {
    // Sanitizar campos de texto (proteção XSS)
    if (createProductDto.title) {
      createProductDto.title = sanitizeHtml(createProductDto.title);
    }
    if (createProductDto.description) {
      createProductDto.description = sanitizeHtml(createProductDto.description);
    }

    const product = this.productRepository.create({
      ...createProductDto,
      store_id: storeId,
    });

    const saved = await this.productRepository.save(product);

    // Salvar imagens se fornecidas
    if (createProductDto.images && createProductDto.images.length > 0) {
      const images = createProductDto.images.map((img, index) =>
        this.imageRepository.create({
          product_id: saved.id,
          url: img.url,
          is_primary: index === 0,
        }),
      );
      await this.imageRepository.save(images);
    }

    // Salvar atributos se fornecidos
    if (
      createProductDto.attribute_values &&
      createProductDto.attribute_values.length > 0
    ) {
      const attrs = createProductDto.attribute_values.map((attr) =>
        this.attributeValueRepository.create({
          product_id: saved.id,
          attribute_id: attr.attribute_id,
          value: sanitizeHtml(attr.value),
        }),
      );
      await this.attributeValueRepository.save(attrs);
    }

    // Invalidar cache
    await this.redisService.delPattern('products:list:*');

    this.logger.log(`Produto criado: ${saved.title} (loja: ${storeId})`);

    return this.findOne(saved.id);
  }

  /**
   * Listar produtos (público) - com cache Redis
   */
  async findAll(
    page = 1,
    limit = 20,
    categoryId?: number,
    search?: string,
    storeId?: string,
  ) {
    const cacheKey = `products:list:${page}:${limit}:${categoryId || ''}:${search || ''}:${storeId || ''}`;

    // Tentar cache
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return cached;

    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.is_active = :isActive', { isActive: true });

    if (categoryId) {
      query.andWhere('product.category_id = :categoryId', { categoryId });
    }

    if (search) {
      query.andWhere('product.title ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (storeId) {
      query.andWhere('product.store_id = :storeId', { storeId });
    }

    query.orderBy('product.created_at', 'DESC');
    query.skip((page - 1) * limit);
    query.take(limit);

    const [data, total] = await query.getManyAndCount();

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Guardar em cache (sem cache se tiver busca por texto)
    if (!search) {
      await this.redisService.set(cacheKey, result, this.CACHE_TTL);
    }

    return result;
  }

  /**
   * Obter produto por ID - com cache Redis
   */
  async findOne(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;

    const cached = await this.redisService.get<Product>(cacheKey);
    if (cached) return cached;

    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['images', 'attribute_values', 'category', 'store'],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    await this.redisService.set(cacheKey, product, this.CACHE_TTL);

    return product;
  }

  /**
   * Atualizar produto (apenas o proprietário da loja)
   */
  async update(id: string, updateProductDto: UpdateProductDto, userId: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['store'],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    // Verificar se o utilizador é o proprietário da loja
    if ((product.store as any).owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para atualizar este produto');
    }

    // Sanitizar campos de texto
    if (updateProductDto.title) {
      updateProductDto.title = sanitizeHtml(updateProductDto.title);
    }
    if (updateProductDto.description) {
      updateProductDto.description = sanitizeHtml(updateProductDto.description);
    }

    // Atualizar campos do produto
    const { images, attribute_values, ...productData } = updateProductDto;
    Object.assign(product, productData);
    await this.productRepository.save(product);

    // Atualizar imagens se fornecidas
    if (images) {
      await this.imageRepository.delete({ product_id: id });
      const newImages = images.map((img, index) =>
        this.imageRepository.create({
          product_id: id,
          url: img.url,
          is_primary: index === 0,
        }),
      );
      await this.imageRepository.save(newImages);
    }

    // Atualizar atributos se fornecidos
    if (attribute_values) {
      await this.attributeValueRepository.delete({ product_id: id });
      const newAttrs = attribute_values.map((attr) =>
        this.attributeValueRepository.create({
          product_id: id,
          attribute_id: attr.attribute_id,
          value: sanitizeHtml(attr.value),
        }),
      );
      await this.attributeValueRepository.save(newAttrs);
    }

    // Invalidar cache
    await this.redisService.del(`product:${id}`);
    await this.redisService.delPattern('products:list:*');

    this.logger.log(`Produto ${id} atualizado`);

    return this.findOne(id);
  }

  /**
   * Eliminar produto (apenas o proprietário da loja)
   */
  async remove(id: string, userId: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['store'],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    if ((product.store as any).owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para eliminar este produto');
    }

    await this.productRepository.remove(product);

    // Invalidar cache
    await this.redisService.del(`product:${id}`);
    await this.redisService.delPattern('products:list:*');

    this.logger.log(`Produto ${id} eliminado`);

    return { message: 'Produto eliminado com sucesso' };
  }

  /**
   * Listar produtos de uma loja específica
   */
  async findByStore(storeId: string, page = 1, limit = 20) {
    const cacheKey = `products:store:${storeId}:${page}:${limit}`;

    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return cached;

    const [data, total] = await this.productRepository.findAndCount({
      where: { store_id: storeId },
      relations: ['images'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redisService.set(cacheKey, result, this.CACHE_TTL);

    return result;
  }

  /**
   * Alternar estado do produto (ativar/desativar)
   */
  async toggleActive(id: string, userId: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['store'],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    if ((product.store as any).owner_id !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    product.is_active = !product.is_active;
    await this.productRepository.save(product);

    // Invalidar cache
    await this.redisService.del(`product:${id}`);
    await this.redisService.delPattern('products:list:*');

    return {
      message: `Produto ${product.is_active ? 'ativado' : 'desativado'}`,
      is_active: product.is_active,
    };
  }
}

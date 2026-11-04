import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from './entities/product.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { ProductAttributeValue } from './entities/product-attribute-value.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { ServiceDetail } from '../services/entities/service-detail.entity.js';
import { RealEstateDetail } from '../real-estate/entities/real-estate-detail.entity.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto.js';
import { RedisService } from '../common/redis/redis.service.js';
import { sanitizeHtml } from '../common/utils/sanitize.util.js';

export interface ProductFilters {
  categoryId?: number;
  search?: string;
  storeId?: string;
  product_type?: string;
  condition_type?: string;
  requires_towing?: boolean;
  rental_period_type?: string;
  min_price?: number;
  max_price?: number;
}

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
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(ServiceDetail)
    private readonly serviceDetailRepository: Repository<ServiceDetail>,
    @InjectRepository(RealEstateDetail)
    private readonly realEstateDetailRepository: Repository<RealEstateDetail>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly promotionsService: PromotionsService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Converte campos decimais/numéricos de string para number para o app mobile
   */
  private formatProduct(product: any) {
    if (!product) return product;

    const formatted: any = {
      ...product,
      price:
        product.price !== null && product.price !== undefined
          ? Number(product.price)
          : null,
      shipping_cost:
        product.shipping_cost !== null && product.shipping_cost !== undefined
          ? Number(product.shipping_cost)
          : null,
      stock_quantity:
        product.stock_quantity !== null && product.stock_quantity !== undefined
          ? Number(product.stock_quantity)
          : 0,
      security_deposit:
        product.security_deposit !== null && product.security_deposit !== undefined
          ? Number(product.security_deposit)
          : 0,
    };

    if (Array.isArray(product.variants)) {
      formatted.variants = product.variants.map((variant: any) => ({
        ...variant,
        additional_price: Number(variant.additional_price ?? 0),
        stock_quantity: Number(variant.stock_quantity ?? 0),
      }));
    }

    if (product.real_estate_details) {
      formatted.real_estate_details = {
        ...product.real_estate_details,
        area_sqm:
          product.real_estate_details.area_sqm !== null
            ? Number(product.real_estate_details.area_sqm)
            : null,
        latitude:
          product.real_estate_details.latitude !== null
            ? Number(product.real_estate_details.latitude)
            : null,
        longitude:
          product.real_estate_details.longitude !== null
            ? Number(product.real_estate_details.longitude)
            : null,
      };
    }

    return formatted;
  }

  /**
   * Resolver store_id a partir do user_id (vendedor)
   */
  async resolveStoreId(userId: string): Promise<string> {
    const cacheKey = `seller:store:${userId}`;

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

    await this.redisService.set(cacheKey, store.id, 600);

    return store.id;
  }

  /**
   * Limite de produtos do plano (max_products = 0 => ilimitado)
   */
  private async assertProductLimit(storeId: string): Promise<void> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      relations: ['plan'],
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    const plan = store.plan as any;

    if (!plan || !plan.is_active) {
      throw new ForbiddenException(
        'Você não tem permissão para usar este plano.',
      );
    }

    const maxProducts = plan?.max_products ?? 0;

    if (maxProducts === 0) return;

    const count = await this.productRepository.count({
      where: { store_id: storeId, is_active: true },
    });

    if (count >= maxProducts) {
      throw new ForbiddenException(
        `Limite de ${maxProducts} produtos atingido para o plano atual. Faça upgrade do plano para adicionar mais produtos.`,
      );
    }
  }

  /**
   * Garante que o produto pertence à loja do vendedor autenticado
   */
  private async getOwnedProduct(productId: string, userId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['store'],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    if ((product.store as any)?.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para este produto');
    }

    return product;
  }

  /**
   * Validações específicas por tipo de produto
   */
  private validateProductType(dto: CreateProductDto): void {
    const type = dto.product_type || 'physical';

    if (type === 'rental') {
      if (!dto.rental_period_type) {
        throw new BadRequestException(
          'Produto do tipo rental exige rental_period_type e security_deposit',
        );
      }
      if (Number(dto.security_deposit ?? 0) < 0) {
        throw new BadRequestException('Caução não pode ser negativa');
      }
    }

    if (type === 'service' && !dto.service_details) {
      throw new BadRequestException(
        'Produto do tipo service exige service_details',
      );
    }

    if (dto.real_estate_details) {
      if (!dto.real_estate_details.location_address) {
        throw new BadRequestException(
          'Imóvel exige property_type, transaction_type e location_address',
        );
      }
      if (
        dto.real_estate_details.transaction_type === 'rent' &&
        type !== 'rental'
      ) {
        throw new BadRequestException(
          'Imóvel para arrendamento deve usar product_type = rental',
        );
      }
    }
  }

  /**
   * Criar produto (físico, aluguer, comida ou serviço)
   */
  async create(createProductDto: CreateProductDto, storeId: string) {
    await this.assertProductLimit(storeId);
    this.validateProductType(createProductDto);

    if (createProductDto.title) {
      createProductDto.title = sanitizeHtml(createProductDto.title);
    }
    if (createProductDto.description) {
      createProductDto.description = sanitizeHtml(createProductDto.description);
    }

    const {
      images,
      attribute_values,
      variants,
      service_details,
      real_estate_details,
      ...productData
    } = createProductDto;

    const product = this.productRepository.create({
      ...productData,
      product_type: productData.product_type || 'physical',
      rental_period_type: productData.rental_period_type || null,
      condition_type: productData.condition_type || null,
      security_deposit: productData.security_deposit ?? 0,
      requires_towing: productData.requires_towing ?? false,
      store_id: storeId,
    });

    const saved = await this.productRepository.save(product);

    if (images && images.length > 0) {
      const newImages = images.map((img, index) =>
        this.imageRepository.create({
          product_id: saved.id,
          url: img.url,
          is_primary: index === 0,
        }),
      );
      await this.imageRepository.save(newImages);
    }

    if (attribute_values && attribute_values.length > 0) {
      const attrs = attribute_values.map((attr) =>
        this.attributeValueRepository.create({
          product_id: saved.id,
          attribute_id: attr.attribute_id,
          value: sanitizeHtml(attr.value),
        }),
      );
      await this.attributeValueRepository.save(attrs);
    }

    if (variants && variants.length > 0) {
      await this.variantRepository.save(
        variants.map((variant) =>
          this.variantRepository.create({
            product_id: saved.id,
            name: sanitizeHtml(variant.name),
            additional_price: variant.additional_price ?? 0,
            stock_quantity: variant.stock_quantity ?? 0,
            is_active: variant.is_active ?? true,
          }),
        ),
      );
    }

    if (service_details) {
      await this.serviceDetailRepository.save(
        this.serviceDetailRepository.create({
          product_id: saved.id,
          pricing_type: service_details.pricing_type,
          estimated_duration_minutes:
            service_details.estimated_duration_minutes ?? 60,
          requires_site_visit: service_details.requires_site_visit ?? false,
        }),
      );
    }

    if (real_estate_details) {
      await this.realEstateDetailRepository.save(
        this.realEstateDetailRepository.create({
          product_id: saved.id,
          ...real_estate_details,
          bedrooms: real_estate_details.bedrooms ?? 0,
          bathrooms: real_estate_details.bathrooms ?? 0,
        }),
      );
    }

    await this.redisService.delPattern('products:list:*');

    this.logger.log(
      `Produto criado: ${saved.title} (tipo: ${saved.product_type}, loja: ${storeId})`,
    );

    return this.findOne(saved.id);
  }

  /**
   * Listar produtos (público) com filtros de tipo/condição/preço
   */
  async findAll(page = 1, limit = 20, filters: ProductFilters = {}) {
    const {
      categoryId,
      search,
      storeId,
      product_type,
      condition_type,
      requires_towing,
      rental_period_type,
      min_price,
      max_price,
    } = filters;

    const cacheKey = [
      'products:list',
      page,
      limit,
      categoryId || '',
      search || '',
      storeId || '',
      product_type || '',
      condition_type || '',
      requires_towing ?? '',
      rental_period_type || '',
      min_price ?? '',
      max_price ?? '',
    ].join(':');

    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      if (cached.data && Array.isArray(cached.data)) {
        cached.data = cached.data.map((p: any) => this.formatProduct(p));
      }
      return cached;
    }

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

    if (product_type) {
      query.andWhere('product.product_type = :productType', {
        productType: product_type,
      });
    }

    if (condition_type) {
      query.andWhere('product.condition_type = :conditionType', {
        conditionType: condition_type,
      });
    }

    if (rental_period_type) {
      query.andWhere('product.rental_period_type = :rentalPeriodType', {
        rentalPeriodType: rental_period_type,
      });
    }

    if (requires_towing !== undefined) {
      query.andWhere('product.requires_towing = :requiresTowing', {
        requiresTowing: requires_towing,
      });
    }

    if (min_price !== undefined) {
      query.andWhere('product.price >= :minPrice', { minPrice: min_price });
    }

    if (max_price !== undefined) {
      query.andWhere('product.price <= :maxPrice', { maxPrice: max_price });
    }

    query.orderBy('product.created_at', 'DESC');
    query.skip((page - 1) * limit);
    query.take(limit);

    const [data, total] = await query.getManyAndCount();

    const dataWithPromos = await this.promotionsService.applyPromotionalPrices(data);
    const formattedData = dataWithPromos.map((p: any) => this.formatProduct(p));

    const result = {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    if (!search) {
      await this.redisService.set(cacheKey, result, this.CACHE_TTL);
    }

    return result;
  }

  /**
   * Obter produto por ID (com variantes e detalhes de serviço/imóvel)
   */
  async findOne(id: string): Promise<any> {
    const cacheKey = `product:${id}`;

    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return this.formatProduct(cached);

    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['images', 'attribute_values', 'category', 'store', 'variants'],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    const [serviceDetails, realEstateDetails] = await Promise.all([
      this.serviceDetailRepository.findOne({ where: { product_id: id } }),
      this.realEstateDetailRepository.findOne({ where: { product_id: id } }),
    ]);

    const formatted = this.formatProduct({
      ...product,
      service_details: serviceDetails ?? null,
      real_estate_details: realEstateDetails ?? null,
      variants: (product as any).variants ?? [],
    });

    await this.redisService.set(cacheKey, formatted, this.CACHE_TTL);

    return formatted;
  }

  /**
   * Atualizar produto (apenas o dono da loja)
   */
  async update(id: string, updateProductDto: UpdateProductDto, userId: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['store'],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    if ((product.store as any).owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para atualizar este produto');
    }

    // Tipo só pode mudar antes de existir transações
    if (
      updateProductDto.product_type &&
      updateProductDto.product_type !== product.product_type
    ) {
      const [{ count: orderItems }] = await this.productRepository.manager.query(
        'SELECT COUNT(*)::int AS count FROM order_items WHERE product_id = $1',
        [id],
      );
      const [{ count: rentals }] = await this.productRepository.manager.query(
        'SELECT COUNT(*)::int AS count FROM rentals WHERE product_id = $1',
        [id],
      );

      if (orderItems > 0 || rentals > 0) {
        throw new BadRequestException(
          'Tipo de produto não pode ser alterado depois de vendido ou alugado',
        );
      }
    }

    if (updateProductDto.title) {
      updateProductDto.title = sanitizeHtml(updateProductDto.title);
    }
    if (updateProductDto.description) {
      updateProductDto.description = sanitizeHtml(updateProductDto.description);
    }

    const {
      images,
      attribute_values,
      variants,
      service_details,
      real_estate_details,
      ...productData
    } = updateProductDto;

    Object.assign(product, productData);
    await this.productRepository.save(product);

    if (images) {
      await this.imageRepository.delete({ product_id: id });
      await this.imageRepository.save(
        images.map((img, index) =>
          this.imageRepository.create({
            product_id: id,
            url: img.url,
            is_primary: index === 0,
          }),
        ),
      );
    }

    if (attribute_values) {
      await this.attributeValueRepository.delete({ product_id: id });
      await this.attributeValueRepository.save(
        attribute_values.map((attr) =>
          this.attributeValueRepository.create({
            product_id: id,
            attribute_id: attr.attribute_id,
            value: sanitizeHtml(attr.value),
          }),
        ),
      );
    }

    if (variants) {
      await this.variantRepository.delete({ product_id: id });
      if (variants.length > 0) {
        await this.variantRepository.save(
          variants.map((variant) =>
            this.variantRepository.create({
              product_id: id,
              name: sanitizeHtml(variant.name),
              additional_price: variant.additional_price ?? 0,
              stock_quantity: variant.stock_quantity ?? 0,
              is_active: variant.is_active ?? true,
            }),
          ),
        );
      }
    }

    if (service_details) {
      await this.serviceDetailRepository.upsert(
        {
          product_id: id,
          pricing_type: service_details.pricing_type,
          estimated_duration_minutes:
            service_details.estimated_duration_minutes ?? 60,
          requires_site_visit: service_details.requires_site_visit ?? false,
        },
        ['product_id'],
      );
    }

    if (real_estate_details) {
      await this.realEstateDetailRepository.upsert(
        {
          product_id: id,
          ...real_estate_details,
          bedrooms: real_estate_details.bedrooms ?? 0,
          bathrooms: real_estate_details.bathrooms ?? 0,
        },
        ['product_id'],
      );
    }

    await this.redisService.del(`product:${id}`);
    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:store:*');
    await this.redisService.delPattern('real-estate:*');

    this.logger.log(`Produto ${id} atualizado`);

    return this.findOne(id);
  }

  /**
   * Eliminar produto (bloqueado com aluguer em curso)
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

    const [{ count: activeRentals }] = await this.productRepository.manager.query(
      "SELECT COUNT(*)::int AS count FROM rentals WHERE product_id = $1 AND status IN ('pending', 'active', 'overdue')",
      [id],
    );

    if (activeRentals > 0) {
      throw new BadRequestException(
        'Produto com aluguer ativo não pode ser eliminado',
      );
    }

    await this.productRepository.remove(product);

    await this.redisService.del(`product:${id}`);
    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:store:*');

    this.logger.log(`Produto ${id} eliminado`);

    return { message: 'Produto eliminado com sucesso' };
  }

  /**
   * Listar produtos de uma loja específica
   */
  async findByStore(storeId: string, page = 1, limit = 20) {
    const cacheKey = `products:store:${storeId}:${page}:${limit}`;

    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      if (cached.data && Array.isArray(cached.data)) {
        cached.data = cached.data.map((p: any) => this.formatProduct(p));
      }
      return cached;
    }

    const [data, total] = await this.productRepository.findAndCount({
      where: { store_id: storeId },
      relations: ['images', 'variants'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    const dataWithPromos = await this.promotionsService.applyPromotionalPrices(data);
    const formattedData = dataWithPromos.map((p: any) => this.formatProduct(p));

    const result = {
      data: formattedData,
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
    const product = await this.getOwnedProduct(id, userId);

    product.is_active = !product.is_active;
    await this.productRepository.save(product);

    await this.redisService.del(`product:${id}`);
    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:store:*');

    return {
      message: `Produto ${product.is_active ? 'ativado' : 'desativado'}`,
      is_active: product.is_active,
    };
  }

  // ---------------------------------------------------------------------------
  // Variantes
  // ---------------------------------------------------------------------------

  async listVariants(productId: string, onlyActive = true) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    const where: any = { product_id: productId };
    if (onlyActive) where.is_active = true;

    const variants = await this.variantRepository.find({
      where,
      order: { created_at: 'ASC' },
    });

    return variants.map((variant) => ({
      ...variant,
      additional_price: Number(variant.additional_price ?? 0),
      stock_quantity: Number(variant.stock_quantity ?? 0),
    }));
  }

  async addVariant(productId: string, dto: CreateVariantDto, userId: string) {
    await this.getOwnedProduct(productId, userId);

    const variant = await this.variantRepository.save(
      this.variantRepository.create({
        product_id: productId,
        name: sanitizeHtml(dto.name),
        additional_price: dto.additional_price ?? 0,
        stock_quantity: dto.stock_quantity ?? 0,
        is_active: true,
      }),
    );

    await this.redisService.del(`product:${productId}`);
    await this.redisService.delPattern('products:list:*');

    return {
      ...variant,
      additional_price: Number(variant.additional_price ?? 0),
      stock_quantity: Number(variant.stock_quantity ?? 0),
    };
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto, userId: string) {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId },
      relations: ['product', 'product.store'],
    });

    if (!variant) {
      throw new NotFoundException('Variante não encontrada');
    }

    if ((variant.product as any)?.store?.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para esta variante');
    }

    if (dto.name !== undefined) variant.name = sanitizeHtml(dto.name);
    if (dto.additional_price !== undefined) {
      variant.additional_price = dto.additional_price;
    }
    if (dto.stock_quantity !== undefined) {
      variant.stock_quantity = dto.stock_quantity;
    }
    if (dto.is_active !== undefined) variant.is_active = dto.is_active;

    const saved = await this.variantRepository.save(variant);

    await this.redisService.del(`product:${variant.product_id}`);
    await this.redisService.delPattern('products:list:*');

    return {
      ...saved,
      additional_price: Number(saved.additional_price ?? 0),
      stock_quantity: Number(saved.stock_quantity ?? 0),
    };
  }

  async deactivateVariant(variantId: string, userId: string) {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId },
      relations: ['product', 'product.store'],
    });

    if (!variant) {
      throw new NotFoundException('Variante não encontrada');
    }

    if ((variant.product as any)?.store?.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para esta variante');
    }

    variant.is_active = false;
    await this.variantRepository.save(variant);

    await this.redisService.del(`product:${variant.product_id}`);
    await this.redisService.delPattern('products:list:*');

    return { message: 'Variante desativada', is_active: false };
  }

  /**
   * Resumo do catálogo por tipo/condição (admin)
   */
  async catalogSummary() {
    const byType = await this.productRepository
      .createQueryBuilder('product')
      .select('product.product_type', 'type')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('product.product_type')
      .getRawMany();

    const byCondition = await this.productRepository
      .createQueryBuilder('product')
      .select('product.condition_type', 'condition')
      .addSelect('COUNT(*)::int', 'count')
      .where('product.condition_type IS NOT NULL')
      .groupBy('product.condition_type')
      .getRawMany();

    const withVariants = await this.variantRepository
      .createQueryBuilder('variant')
      .select('COUNT(DISTINCT variant.product_id)::int', 'count')
      .getRawOne();

    const inactive = await this.productRepository.count({
      where: { is_active: false },
    });

    const total = await this.productRepository.count();

    return {
      total,
      by_type: Object.fromEntries(byType.map((row) => [row.type, Number(row.count)])),
      by_condition: Object.fromEntries(
        byCondition.map((row) => [row.condition, Number(row.count)]),
      ),
      with_variants: Number(withVariants?.count ?? 0),
      inactive,
    };
  }
}

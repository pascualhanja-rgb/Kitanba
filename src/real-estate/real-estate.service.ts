import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { RealEstateDetail } from './entities/real-estate-detail.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { UpdateRealEstateDto } from './dto/real-estate.dto.js';
import { RedisService } from '../common/redis/redis.service.js';

export interface RealEstateFilters {
  transaction_type?: string;
  property_type?: string;
  bedrooms_min?: number;
  bathrooms_min?: number;
  area_sqm_min?: number;
  store_id?: string;
  is_active?: boolean;
}

@Injectable()
export class RealEstateService {
  private readonly logger = new Logger(RealEstateService.name);

  constructor(
    @InjectRepository(RealEstateDetail)
    private readonly detailRepository: Repository<RealEstateDetail>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly redisService: RedisService,
  ) {}

  private format(detail: RealEstateDetail & { product?: any }) {
    return {
      ...detail,
      bedrooms: Number(detail.bedrooms ?? 0),
      bathrooms: Number(detail.bathrooms ?? 0),
      area_sqm: detail.area_sqm !== null ? Number(detail.area_sqm) : null,
      latitude: detail.latitude !== null ? Number(detail.latitude) : null,
      longitude: detail.longitude !== null ? Number(detail.longitude) : null,
      price: detail.product ? Number(detail.product.price) : undefined,
    };
  }

  private async assertProductOwner(productId: string, userId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['store'],
    });

    if (!product) {
      throw new NotFoundException('Imóvel não encontrado');
    }

    if ((product.store as any)?.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para este imóvel');
    }

    return product;
  }

  /**
   * Listagem pública com filtros
   */
  async findAll(page = 1, limit = 20, filters: RealEstateFilters = {}) {
    const cacheKey = `real-estate:list:${page}:${limit}:${JSON.stringify(filters)}`;
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return cached;

    const query = this.detailRepository
      .createQueryBuilder('detail')
      .innerJoinAndSelect('detail.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.store', 'store')
      .where('product.is_active = :isActive', {
        isActive: filters.is_active ?? true,
      });

    if (filters.transaction_type) {
      query.andWhere('detail.transaction_type = :transactionType', {
        transactionType: filters.transaction_type,
      });
    }

    if (filters.property_type) {
      query.andWhere('detail.property_type = :propertyType', {
        propertyType: filters.property_type,
      });
    }

    if (filters.bedrooms_min !== undefined) {
      query.andWhere('detail.bedrooms >= :bedroomsMin', {
        bedroomsMin: filters.bedrooms_min,
      });
    }

    if (filters.bathrooms_min !== undefined) {
      query.andWhere('detail.bathrooms >= :bathroomsMin', {
        bathroomsMin: filters.bathrooms_min,
      });
    }

    if (filters.area_sqm_min !== undefined) {
      query.andWhere('detail.area_sqm >= :areaMin', {
        areaMin: filters.area_sqm_min,
      });
    }

    if (filters.store_id) {
      query.andWhere('product.store_id = :storeId', {
        storeId: filters.store_id,
      });
    }

    query.orderBy('product.created_at', 'DESC');
    query.skip((page - 1) * limit);
    query.take(limit);

    const [details, total] = await query.getManyAndCount();

    const result = {
      data: details.map((detail) => this.format(detail as any)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };

    await this.redisService.set(cacheKey, result, 180);

    return result;
  }

  async findOne(productId: string) {
    const detail = await this.detailRepository.findOne({
      where: { product_id: productId },
      relations: ['product', 'product.images', 'product.store'],
    });

    if (!detail) {
      throw new NotFoundException('Imóvel não encontrado');
    }

    return this.format(detail as any);
  }

  async findMine(userId: string, page = 1, limit = 20) {
    const store = await this.storeRepository.findOne({
      where: { owner_id: userId, status: 'active' },
    });

    if (!store) {
      throw new ForbiddenException(
        'Utilizador não possui uma loja ativa. Crie uma loja primeiro.',
      );
    }

    const [details, total] = await this.detailRepository
      .createQueryBuilder('detail')
      .innerJoinAndSelect('detail.product', 'product')
      .where('product.store_id = :storeId', { storeId: store.id })
      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: details.map((detail) => this.format(detail as any)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(productId: string, dto: UpdateRealEstateDto, userId: string) {
    await this.assertProductOwner(productId, userId);

    const detail = await this.detailRepository.findOne({
      where: { product_id: productId },
    });

    if (!detail) {
      throw new NotFoundException('Imóvel não encontrado');
    }

    Object.assign(detail, dto);
    await this.detailRepository.save(detail);

    await this.redisService.delPattern('real-estate:*');

    return this.findOne(productId);
  }

  async toggleActive(productId: string, userId: string) {
    const product = await this.assertProductOwner(productId, userId);

    product.is_active = !product.is_active;
    await this.productRepository.save(product);

    await this.redisService.delPattern('real-estate:*');

    return {
      product_id: product.id,
      is_active: product.is_active,
      message: `Anúncio ${product.is_active ? 'ativado' : 'desativado'}`,
    };
  }

  async remove(productId: string, userId: string) {
    await this.assertProductOwner(productId, userId);

    const [{ count }] = await this.productRepository.manager.query(
      "SELECT COUNT(*)::int AS count FROM rentals WHERE product_id = $1 AND status IN ('pending', 'active', 'overdue')",
      [productId],
    );

    if (count > 0) {
      throw new BadRequestException(
        'Imóvel com aluguer ativo não pode ser removido',
      );
    }

    await this.productRepository.manager.query(
      'DELETE FROM products WHERE id = $1',
      [productId],
    );

    await this.redisService.delPattern('real-estate:*');

    return { message: 'Anúncio removido' };
  }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  async suspend(productId: string, reason: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Imóvel não encontrado');
    }

    const [{ count }] = await this.productRepository.manager.query(
      "SELECT COUNT(*)::int AS count FROM rentals WHERE product_id = $1 AND status IN ('pending', 'active', 'overdue')",
      [productId],
    );

    if (count > 0) {
      throw new BadRequestException(
        'Imóvel com aluguer ativo não pode ser suspenso',
      );
    }

    product.is_active = false;
    await this.productRepository.save(product);

    this.logger.warn(`Imóvel ${productId} suspenso: ${reason}`);

    await this.redisService.delPattern('real-estate:*');

    return { product_id: productId, is_active: false, reason };
  }

  async activate(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Imóvel não encontrado');
    }

    product.is_active = true;
    await this.productRepository.save(product);

    await this.redisService.delPattern('real-estate:*');

    return { product_id: productId, is_active: true };
  }

  async stats() {
    const rows = await this.detailRepository
      .createQueryBuilder('detail')
      .select('detail.transaction_type', 'transaction')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('detail.transaction_type')
      .getRawMany();

    const suspended = await this.productRepository
      .createQueryBuilder('product')
      .innerJoin('real_estate_details', 'detail', 'detail.product_id = product.id')
      .where('product.is_active = false')
      .getCount();

    const total = await this.detailRepository.count();

    return {
      total,
      by_transaction: Object.fromEntries(
        rows.map((row) => [row.transaction, Number(row.count)]),
      ),
      suspended,
    };
  }
}

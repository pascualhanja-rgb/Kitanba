import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionalCampaign } from './entities/promotional-campaign.entity.js';
import { CampaignProduct } from './entities/campaign-product.entity.js';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
} from './dto/create-campaign.dto.js';
import { Store } from '../stores/entities/store.entity.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    @InjectRepository(PromotionalCampaign)
    private readonly campaignRepository: Repository<PromotionalCampaign>,
    @InjectRepository(CampaignProduct)
    private readonly campaignProductRepository: Repository<CampaignProduct>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Anexar preços promocionais a uma lista de produtos
   * Regra de negócio #5: produto em campanha ativa mostra promotional_price
   */
  async applyPromotionalPrices(products: any[]): Promise<any[]> {
    if (!products || products.length === 0) return products;

    const now = new Date();
    const productIds = products.map((p) => p.id);

    const campaignProducts = await this.campaignProductRepository
      .createQueryBuilder('cp')
      .innerJoin(
        PromotionalCampaign,
        'c',
        'c.id = cp.campaign_id',
      )
      .where('cp.product_id IN (:...productIds)', { productIds })
      .andWhere('c.is_active = :isActive', { isActive: true })
      .andWhere('c.starts_at <= :now', { now })
      .andWhere('c.ends_at >= :now', { now })
      .getMany();

    const promoMap = new Map<string, number>();
    for (const cp of campaignProducts) {
      // CONVERSÃO PARA NUMBER AQUI
      const promoPriceVal = cp.promotional_price !== null && cp.promotional_price !== undefined 
        ? Number(cp.promotional_price) 
        : 0;

      const current = promoMap.get(cp.product_id);
      if (current === undefined || promoPriceVal < current) {
        promoMap.set(cp.product_id, promoPriceVal);
      }
    }

    return products.map((product) => {
      const basePrice = product.price !== null && product.price !== undefined ? Number(product.price) : 0;
      const shippingCost = product.shipping_cost !== null && product.shipping_cost !== undefined ? Number(product.shipping_cost) : null;
      const stockQuantity = product.stock_quantity !== null && product.stock_quantity !== undefined ? Number(product.stock_quantity) : 0;

      const promoPrice = promoMap.get(product.id);

      if (promoPrice !== undefined) {
        return {
          ...product,
          price: basePrice,
          shipping_cost: shippingCost,
          stock_quantity: stockQuantity,
          promotional_price: promoPrice, // Já convertido para number
          has_active_promotion: true,
        };
      }

      return {
        ...product,
        price: basePrice,
        shipping_cost: shippingCost,
        stock_quantity: stockQuantity,
        has_active_promotion: false,
      };
    });
  }

  /**
   * Resolver store_id do vendedor autenticado
   */
  // ==================== CRUD DE CAMPANHAS ====================

  /**
   * Listar campanhas ativas agora (público - "Sextou")
   */
  async findActiveNow(page = 1, limit = 20) {
    const now = new Date();

    const query = this.campaignRepository
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.campaign_products', 'cp')
      .where('campaign.is_active = :isActive', { isActive: true })
      .andWhere('campaign.starts_at <= :now', { now })
      .andWhere('campaign.ends_at >= :now', { now })
      .orderBy('campaign.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['campaign_products'],
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    return campaign;
  }

  async create(dto: CreateCampaignDto, storeId: string) {
    const saved = await this.campaignRepository.save(
      this.campaignRepository.create({
        store_id: storeId,
        title: dto.title,
        campaign_type: dto.campaign_type ?? 'sextou',
        starts_at: new Date(dto.starts_at),
        ends_at: new Date(dto.ends_at),
        is_active: dto.is_active ?? true,
      }),
    );

    await this.campaignProductRepository.insert(
      dto.products.map((p) =>
        this.campaignProductRepository.create({
          campaign_id: saved.id,
          product_id: p.product_id,
          promotional_price: p.promotional_price,
        }),
      ),
    );

    this.logger.log(
      `Campanha "${saved.title}" criada para loja ${storeId} com ${dto.products.length} produto(s).`,
    );

    return this.findOne(saved.id);
  }

  async findByStore(storeId: string) {
    return this.campaignRepository.find({
      where: { store_id: storeId },
      relations: ['campaign_products'],
      order: { created_at: 'DESC' },
    });
  }

  private async findOwnedCampaign(
    id: string,
    storeId: string,
  ): Promise<PromotionalCampaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['campaign_products'],
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    if (campaign.store_id !== storeId) {
      throw new ForbiddenException(
        'Você não tem permissão para modificar esta campanha.',
      );
    }

    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, storeId: string) {
    const campaign = await this.findOwnedCampaign(id, storeId);

    if (dto.title !== undefined) campaign.title = dto.title;
    if (dto.starts_at !== undefined)
      campaign.starts_at = new Date(dto.starts_at);
    if (dto.ends_at !== undefined) campaign.ends_at = new Date(dto.ends_at);
    if (dto.is_active !== undefined) campaign.is_active = dto.is_active;

    await this.campaignRepository.save(campaign);

    // Substituir produtos da campanha, se enviados
    if (dto.products) {
      await this.campaignProductRepository.delete({ campaign_id: id });
      const newProducts = dto.products.map((p) =>
        this.campaignProductRepository.create({
          campaign_id: id,
          product_id: p.product_id,
          promotional_price: p.promotional_price,
        }),
      );
      await this.campaignProductRepository.insert(newProducts);
    }

    return this.findOne(id);
  }

  async toggleActive(id: string, storeId: string) {
    const campaign = await this.findOwnedCampaign(id, storeId);

    campaign.is_active = !campaign.is_active;
    await this.campaignRepository.save(campaign);

    return this.findOne(id);
  }

  async remove(id: string, storeId: string) {
    const campaign = await this.findOwnedCampaign(id, storeId);

    await this.campaignProductRepository.delete({ campaign_id: id });
    await this.campaignRepository.remove(campaign);

    return { deleted: true };
  }

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
}
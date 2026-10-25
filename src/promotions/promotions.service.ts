import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionalCampaign } from './entities/promotional-campaign.entity.js';
import { CampaignProduct } from './entities/campaign-product.entity.js';
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
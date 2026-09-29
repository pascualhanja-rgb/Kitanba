import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';

import { PromotionalCampaign } from './entities/promotional-campaign.entity.js';
import { CampaignProduct } from './entities/campaign-product.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { RedisService } from '../common/redis/redis.service.js';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
} from './dto/create-campaign.dto.js';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);
  private readonly CACHE_TTL = 60; // 1 minuto - campanhas mudam rápido

  constructor(
    @InjectRepository(PromotionalCampaign)
    private readonly campaignRepository: Repository<PromotionalCampaign>,
    @InjectRepository(CampaignProduct)
    private readonly campaignProductRepository: Repository<CampaignProduct>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Verificar se a campanha está ativa (is_active + NOW() entre starts_at e ends_at)
   */
  private isCampaignLiveNow(campaign: PromotionalCampaign): boolean {
    const now = new Date();
    return (
      campaign.is_active &&
      new Date(campaign.starts_at) <= now &&
      new Date(campaign.ends_at) >= now
    );
  }

  /**
   * Criar campanha promocional (vendedor)
   */
  async create(dto: CreateCampaignDto, storeId: string) {
    const { products, ...campaignData } = dto;

    if (new Date(dto.starts_at) >= new Date(dto.ends_at)) {
      throw new BadRequestException('starts_at deve ser antes de ends_at');
    }

    // Validar que os produtos pertencem à loja
    const productIds = products.map((p) => p.product_id);
    const ownedProducts = await this.productRepository.find({
      where: { id: In(productIds), store_id: storeId },
    });

    if (ownedProducts.length !== productIds.length) {
      throw new BadRequestException(
        'Um ou mais produtos não pertencem à sua loja',
      );
    }

    const campaign = this.campaignRepository.create({
      ...campaignData,
      store_id: storeId,
      is_active: dto.is_active ?? true,
    });

    const saved = await this.campaignRepository.save(campaign);

    // Associar produtos com preços promocionais
    const campaignProducts = products.map((p) =>
      this.campaignProductRepository.create({
        campaign_id: saved.id,
        product_id: p.product_id,
        promotional_price: p.promotional_price,
      }),
    );

    await this.campaignProductRepository.save(campaignProducts);

    // Invalidar cache do catálogo (preços mudam)
    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:store:*');

    this.logger.log(`Campanha "${saved.title}" criada na loja ${storeId}`);

    return this.findOne(saved.id, storeId);
  }

  /**
   * Obter campanha por ID
   */
  async findOne(id: string, storeId?: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['campaign_products'],
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    if (storeId && campaign.store_id !== storeId) {
      throw new ForbiddenException('Sem permissão para ver esta campanha');
    }

    return campaign;
  }

  /**
   * Listar campanhas da loja (vendedor)
   */
  async findByStore(storeId: string) {
    return this.campaignRepository.find({
      where: { store_id: storeId },
      relations: ['campaign_products'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Listar campanhas ativas agora (público - "Sextou" na home)
   */
  async findActiveNow(page = 1, limit = 20) {
    const now = new Date();

    const [data, total] = await this.campaignRepository.findAndCount({
      where: {
        is_active: true,
        starts_at: Not(IsNull()),
      },
      relations: ['store', 'campaign_products'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    // Filtrar apenas campanhas dentro da janela de datas
    const active = data.filter((c) => this.isCampaignLiveNow(c));

    return {
      data: active,
      meta: { total: active.length, page, limit, totalPages: Math.ceil(active.length / limit) },
    };
  }

  /**
   * Atualizar campanha
   */
  async update(id: string, dto: UpdateCampaignDto, storeId: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    if (campaign.store_id !== storeId) {
      throw new ForbiddenException('Sem permissão para atualizar esta campanha');
    }

    const { products, ...campaignData } = dto;
    Object.assign(campaign, campaignData);

    await this.campaignRepository.save(campaign);

    // Substituir produtos se fornecidos
    if (products) {
      await this.campaignProductRepository.delete({ campaign_id: id });

      const campaignProducts = products.map((p) =>
        this.campaignProductRepository.create({
          campaign_id: id,
          product_id: p.product_id,
          promotional_price: p.promotional_price,
        }),
      );

      await this.campaignProductRepository.save(campaignProducts);
    }

    // Invalidar cache do catálogo
    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:store:*');

    return this.findOne(id, storeId);
  }

  /**
   * Ativar/desativar campanha
   */
  async toggleActive(id: string, storeId: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    if (campaign.store_id !== storeId) {
      throw new ForbiddenException('Sem permissão');
    }

    campaign.is_active = !campaign.is_active;
    await this.campaignRepository.save(campaign);

    // Invalidar cache do catálogo
    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:store:*');

    return {
      message: `Campanha ${campaign.is_active ? 'ativada' : 'desativada'}`,
      is_active: campaign.is_active,
    };
  }

  /**
   * Eliminar campanha
   */
  async remove(id: string, storeId: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada');
    }

    if (campaign.store_id !== storeId) {
      throw new ForbiddenException('Sem permissão');
    }

    await this.campaignRepository.remove(campaign);

    // Invalidar cache do catálogo
    await this.redisService.delPattern('products:list:*');
    await this.redisService.delPattern('products:store:*');

    return { message: 'Campanha eliminada com sucesso' };
  }

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

    if (campaignProducts.length === 0) return products;

    const promoMap = new Map<string, number>();
    for (const cp of campaignProducts) {
      const current = promoMap.get(cp.product_id);
      if (current === undefined || cp.promotional_price < current) {
        promoMap.set(cp.product_id, cp.promotional_price);
      }
    }

    return products.map((product) => {
      const promoPrice = promoMap.get(product.id);
      if (promoPrice !== undefined) {
        return {
          ...product,
          promotional_price: promoPrice,
          has_active_promotion: true,
        };
      }
      return product;
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

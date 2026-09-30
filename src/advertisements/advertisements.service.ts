import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { Advertisement } from './entities/advertisement.entity.js';
import { AdPricingPlan } from './entities/ad-pricing-plan.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto.js';
import { RedisService } from '../common/redis/redis.service.js';
import { sanitizeHtml, isValidSecureUrl } from '../common/utils/sanitize.util.js';

@Injectable()
export class AdvertisementsService {
  private readonly logger = new Logger(AdvertisementsService.name);
  private readonly CACHE_TTL = 300;

  constructor(
    @InjectRepository(Advertisement)
    private readonly adRepository: Repository<Advertisement>,
    @InjectRepository(AdPricingPlan)
    private readonly adPlanRepository: Repository<AdPricingPlan>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly redisService: RedisService,
  ) {}

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
        'Utilizador não possui uma loja ativa.',
      );
    }

    await this.redisService.set(cacheKey, store.id, 600);

    return store.id;
  }

  /**
   * Verificar se o vendedor é proprietário da loja
   */
  async verifyStoreOwnership(storeId: string, userId: string): Promise<void> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      select: ['owner_id'],
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    if (store.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para aceder anúncios desta loja');
    }
  }

  /**
   * Listar planos de publicidade ativos - com cache
   */
  async findActiveAdPlans() {
    const cacheKey = 'ads:plans:active';

    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return cached;

    const plans = await this.adPlanRepository.find({
      where: { is_active: true },
      order: { price: 'ASC' },
    });

    await this.redisService.set(cacheKey, plans, this.CACHE_TTL);

    return plans;
  }

  /**
   * Listar todos os planos de publicidade (Admin)
   */
  async findAllAdPlans() {
    return this.adPlanRepository.find({
      order: { price: 'ASC' },
    });
  }

  /**
   * Criar plano de publicidade (Admin)
   */
  async createAdPlan(dto: any) {
    const plan = this.adPlanRepository.create(dto);
    const saved = await this.adPlanRepository.save(plan);

    await this.redisService.del('ads:plans:active');

    return saved;
  }

  /**
   * Regra de negócio: validar se o plano da loja permite o tipo de anúncio
   * (allow_flyer_ads / allow_banner_ads / allow_video_ads em seller_plans)
   */
  private async assertPlanAllowsAdType(storeId: string, adType: string): Promise<void> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      relations: ['plan'],
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    const plan = store.plan as any;
    if (!plan) {
      throw new ForbiddenException('Loja sem plano associado');
    }

    if (!plan.is_active) {
      throw new ForbiddenException('Você não tem permissão para usar este plano.');
    }

    const allowedByType: Record<string, boolean> = {
      flyer: !!plan.allow_flyer_ads,
      banner: !!plan.allow_banner_ads,
      video: !!plan.allow_video_ads,
    };

    const allowed = allowedByType[adType];

    if (allowed === undefined) {
      throw new BadRequestException(`Tipo de anúncio inválido: ${adType}`);
    }

    if (!allowed) {
      throw new ForbiddenException(
        `O seu plano não permite anúncios do tipo "${adType}". Faça upgrade do plano para desbloquear.`,
      );
    }
  }

  /**
   * Criar anúncio - usando nomes corretos das colunas SQL
   */
  async create(createAdDto: CreateAdvertisementDto, storeId: string) {
    // Verificar se o plano existe
    const adPlan = await this.adPlanRepository.findOne({
      where: { id: createAdDto.ad_plan_id, is_active: true },
    });

    if (!adPlan) {
      throw new NotFoundException('Plano de publicidade não encontrado');
    }

    // Regra: plano da loja deve permitir o tipo de anúncio (flyer/banner/video)
    await this.assertPlanAllowsAdType(storeId, adPlan.ad_type);

    // Validar media_url
    if (createAdDto.media_url && !isValidSecureUrl(createAdDto.media_url)) {
      throw new BadRequestException('URL de mídia inválida ou insegura');
    }

    // Sanitizar título
    const title = createAdDto.title
      ? sanitizeHtml(createAdDto.title)
      : adPlan.name;

    // Calcular data de término
    // Se o plano não tiver duration_days definido, usa 14 dias por padrão
    const durationDays = adPlan.duration_days || 14;
    const startDate = new Date(createAdDto.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const ad = this.adRepository.create({
      store_id: storeId,
      ad_plan_id: createAdDto.ad_plan_id,
      product_id: createAdDto.product_id || undefined,
      title,
      media_url: createAdDto.media_url || '',
      target_url: createAdDto.target_url || undefined,
      start_date: startDate,
      end_date: endDate,
      status: 'pending_approval',
    } as any);

    const saved = await this.adRepository.save(ad);

    await this.redisService.delPattern('ads:active:*');

    this.logger.log(`Novo anúncio criado para loja ${storeId}`);

    return saved;
  }

  /**
   * Listar anúncios ativos (público) - visível a TODOS os utilizadores
   * 
   * Regra: O anúncio é visível quando:
   *   1. status = 'active'
   *   2. start_date <= agora (já começou)
   *   3. end_date >= agora (ainda não terminou)
   * 
   * Por padrão, um anúncio fica visível por 14 dias após aprovação.
   */
  async findActive() {
    const cacheKey = 'ads:active:all';

    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return cached;

    const now = new Date();

    const ads = await this.adRepository.find({
      where: {
        status: 'active',
        start_date: LessThanOrEqual(now),
        end_date: MoreThanOrEqual(now),
      },
      relations: ['store', 'ad_plan'],
      order: { created_at: 'DESC' },
    });

    await this.redisService.set(cacheKey, ads, 60);

    return ads;
  }

  /**
   * Listar anúncios de uma loja (vendedor)
   * Mostra todos os anúncios da loja (pendentes, ativos, rejeitados)
   */
  async findByStore(storeId: string) {
    return this.adRepository.find({
      where: { store_id: storeId },
      relations: ['ad_plan'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Listar todos os anúncios (Admin)
   */
  async findAll(status?: string) {
    const where = status ? { status } : {};
    return this.adRepository.find({
      where,
      relations: ['store', 'ad_plan'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Verificar se um anúncio está dentro do período de 14 dias
   */
  private isWithinVisibilityPeriod(ad: Advertisement): boolean {
    const now = new Date();
    return ad.start_date <= now && ad.end_date >= now;
  }

  /**
   * Aprovar anúncio (Admin)
   * 
   * Quando aprovado:
   *   - Se start_date é no passado, mantém (já começou)
   *   - Se start_date é no futuro, usa agora (começa imediatamente)
   *   - end_date é recalculado para start_date + duration_days
   *   - O anúncio fica visível por 14 dias (ou duração do plano)
   */
  async approve(id: string) {
    const ad = await this.adRepository.findOne({
      where: { id },
      relations: ['ad_plan'],
    });

    if (!ad) {
      throw new NotFoundException('Anúncio não encontrado');
    }

    const now = new Date();
    const durationDays = ad.ad_plan?.duration_days || 14;

    // Se start_date é no futuro, começa agora
    if (ad.start_date > now) {
      ad.start_date = now;
    }

    // Recalcular end_date baseado no start_date
    const endDate = new Date(ad.start_date);
    endDate.setDate(endDate.getDate() + durationDays);
    ad.end_date = endDate;

    ad.status = 'active';
    await this.adRepository.save(ad);

    await this.redisService.del('ads:active:all');

    this.logger.log(`Anúncio ${id} aprovado. Visível de ${ad.start_date} até ${ad.end_date}`);

    return {
      message: 'Anúncio aprovado',
      id: ad.id,
      status: ad.status,
      start_date: ad.start_date,
      end_date: ad.end_date,
      visible_days: durationDays,
    };
  }

  /**
   * Rejeitar anúncio (Admin)
   */
  async reject(id: string) {
    const ad = await this.adRepository.findOne({ where: { id } });

    if (!ad) {
      throw new NotFoundException('Anúncio não encontrado');
    }

    ad.status = 'rejected';
    await this.adRepository.save(ad);

    this.logger.log(`Anúncio ${id} rejeitado`);

    return { message: 'Anúncio rejeitado' };
  }

  /**
   * Eliminar anúncio (Admin)
   */
  async remove(id: string) {
    const ad = await this.adRepository.findOne({ where: { id } });

    if (!ad) {
      throw new NotFoundException('Anúncio não encontrado');
    }

    await this.adRepository.remove(ad);

    await this.redisService.del('ads:active:all');

    return { message: 'Anúncio eliminado' };
  }
}

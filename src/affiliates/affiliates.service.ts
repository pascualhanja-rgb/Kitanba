import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { StoreAffiliate } from './entities/store-affiliate.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { SellerPlan } from '../plans/entities/seller-plan.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateAffiliateDto, UpdateAffiliateDto } from './dto/create-affiliate.dto.js';

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(
    @InjectRepository(StoreAffiliate)
    private readonly affiliateRepository: Repository<StoreAffiliate>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(SellerPlan)
    private readonly planRepository: Repository<SellerPlan>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Resolver loja do vendedor autenticado
   */
  async resolveStoreOfUser(userId: string): Promise<Store> {
    const store = await this.storeRepository.findOne({
      where: { owner_id: userId, status: 'active' },
    });

    if (!store) {
      throw new ForbiddenException(
        'Utilizador não possui uma loja ativa. Crie uma loja primeiro.',
      );
    }

    return store;
  }

  /**
   * Regra de negócio #1: validar limite de afiliados contra seller_plans.max_affiliates
   * 999999 = ilimitado (Premium)
   */
  private async assertAffiliateLimit(storeId: string): Promise<void> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      relations: ['plan'],
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    const plan = store.plan as SellerPlan;

    if (!plan || !plan.is_active) {
      throw new ForbiddenException('Você não tem permissão para usar este plano.');
    }

    const maxAffiliates = plan?.max_affiliates ?? 0;

    // 999999 = ilimitado
    if (maxAffiliates >= 999999) return;

    const count = await this.affiliateRepository.count({
      where: { store_id: storeId, is_active: true },
    });

    if (count >= maxAffiliates) {
      throw new ForbiddenException('Limite de afiliados atingido para o plano atual.');
    }
  }

  /**
   * Associar afiliado/membro da equipe (vendedor dono da loja)
   */
  async create(dto: CreateAffiliateDto, userId: string) {
    const store = await this.storeRepository.findOne({
      where: { owner_id: userId, status: 'active' },
    });

    if (!store) {
      throw new ForbiddenException(
        'Utilizador não possui uma loja ativa. Crie uma loja primeiro.',
      );
    }

    // Regra: limite do plano
    await this.assertAffiliateLimit(store.id);

    // Utilizador a associar deve existir
    const targetUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!targetUser) {
      throw new NotFoundException(
        'Utilizador não encontrado. O membro da equipe precisa ter conta na plataforma.',
      );
    }

    if (targetUser.id === userId) {
      throw new BadRequestException('Não é possível associar a si mesmo');
    }

    // Já associado? Reativar se estava inativo
    const existing = await this.affiliateRepository.findOne({
      where: { store_id: store.id, user_id: targetUser.id },
    });

    if (existing) {
      if (existing.is_active) {
        throw new BadRequestException('Utilizador já é membro da equipe desta loja');
      }

      await this.assertAffiliateLimit(store.id);
      existing.is_active = true;
      existing.role = dto.role;
      const reactivated = await this.affiliateRepository.save(existing);

      this.logger.log(`Afiliado reativado ${targetUser.id} na loja ${store.id}`);

      return reactivated;
    }

    const affiliate = this.affiliateRepository.create({
      store_id: store.id,
      user_id: targetUser.id,
      role: dto.role,
      is_active: true,
    });

    const saved = await this.affiliateRepository.save(affiliate);

    this.logger.log(`Afiliado ${targetUser.id} associado à loja ${store.id}`);

    return saved;
  }

  /**
   * Listar membros da equipe da loja
   */
  async findByStore(storeId: string) {
    return this.affiliateRepository.find({
      where: { store_id: storeId },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Listar equipes onde o utilizador é membro
   */
  async findByUser(userId: string) {
    return this.affiliateRepository.find({
      where: { user_id: userId },
      relations: ['store'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Atualizar role/status de um membro
   */
  async update(affiliateId: string, dto: UpdateAffiliateDto, userId: string) {
    const affiliate = await this.affiliateRepository.findOne({
      where: { id: affiliateId },
      relations: ['store'],
    });

    if (!affiliate) {
      throw new NotFoundException('Membro não encontrado');
    }

    if ((affiliate.store as any).owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para gerir esta equipe');
    }

    Object.assign(affiliate, dto);
    return this.affiliateRepository.save(affiliate);
  }

  /**
   * Remover membro da equipe
   */
  async remove(affiliateId: string, userId: string) {
    const affiliate = await this.affiliateRepository.findOne({
      where: { id: affiliateId },
      relations: ['store'],
    });

    if (!affiliate) {
      throw new NotFoundException('Membro não encontrado');
    }

    if ((affiliate.store as any).owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para gerir esta equipe');
    }

    await this.affiliateRepository.remove(affiliate);

    return { message: 'Membro removido da equipe' };
  }
}

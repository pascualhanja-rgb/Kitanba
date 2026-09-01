import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Store } from './entities/store.entity.js';
import { PlanUpgradeRequest } from './entities/plan-upgrade-request.entity.js';
import { SellerPlanChange } from './entities/seller-plan-change.entity.js';
import { StoreStatusLog } from './entities/store-status-log.entity.js';
import { CreateStoreDto } from './dto/create-store.dto.js';
import { UpdateStoreDto } from './dto/update-store.dto.js';
import { EmailService } from '../email/email.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { sanitizeHtml } from '../common/utils/sanitize.util.js';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);
  private readonly CACHE_TTL = 600; // 10 minutos

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(PlanUpgradeRequest)
    private readonly upgradeRequestRepository: Repository<PlanUpgradeRequest>,
    @InjectRepository(SellerPlanChange)
    private readonly planChangeRepository: Repository<SellerPlanChange>,
    @InjectRepository(StoreStatusLog)
    private readonly statusLogRepository: Repository<StoreStatusLog>,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Gerar slug a partir do nome
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
   * Criar loja (vendedor) com sanitização
   */
  async create(createStoreDto: CreateStoreDto, userId: string) {
    // Sanitizar campos de texto
    if (createStoreDto.name) {
      createStoreDto.name = sanitizeHtml(createStoreDto.name);
    }
    if (createStoreDto.description) {
      createStoreDto.description = sanitizeHtml(createStoreDto.description);
    }

    // Verificar se já existe loja com o mesmo nome
    const existing = await this.storeRepository.findOne({
      where: { name: createStoreDto.name },
    });

    if (existing) {
      throw new BadRequestException('Já existe uma loja com este nome');
    }

    const slug = this.generateSlug(createStoreDto.name);

    const store = this.storeRepository.create({
      ...createStoreDto,
      owner_id: userId,
      slug,
      status: 'pending_approval',
    });

    const saved = await this.storeRepository.save(store);

    this.logger.log(`Nova loja criada: ${saved.name} por ${userId}`);

    return saved;
  }

  /**
   * Listar lojas do vendedor
   */
  async findByOwner(userId: string, page = 1, limit = 20) {
    const [stores, total] = await this.storeRepository.findAndCount({
      where: { owner_id: userId },
      relations: ['plan'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: stores,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Listar todas as lojas (Admin)
   */
  async findAll(page = 1, limit = 20, status?: string) {
    const where = status ? { status } : {};

    const [stores, total] = await this.storeRepository.findAndCount({
      where,
      relations: ['plan', 'owner'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: stores,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obter loja por ID - com cache
   */
  async findOne(id: string): Promise<Store> {
    const cacheKey = `store:${id}`;

    const cached = await this.redisService.get<Store>(cacheKey);
    if (cached) return cached;

    const store = await this.storeRepository.findOne({
      where: { id },
      relations: ['plan', 'owner'],
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    await this.redisService.set(cacheKey, store, this.CACHE_TTL);

    return store;
  }

  /**
   * Obter loja por slug (público) - com cache
   */
  async findBySlug(slug: string): Promise<Store> {
    const cacheKey = `store:slug:${slug}`;

    const cached = await this.redisService.get<Store>(cacheKey);
    if (cached) return cached;

    const store = await this.storeRepository.findOne({
      where: { slug, status: 'active' },
      relations: ['plan'],
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    await this.redisService.set(cacheKey, store, this.CACHE_TTL);

    return store;
  }

  /**
   * Atualizar loja (apenas o proprietário)
   */
  async update(id: string, updateStoreDto: UpdateStoreDto, userId: string) {
    const store = await this.findOne(id);

    if (store.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para atualizar esta loja');
    }

    // Sanitizar campos
    if (updateStoreDto.name) {
      updateStoreDto.name = sanitizeHtml(updateStoreDto.name);
    }
    if (updateStoreDto.description) {
      updateStoreDto.description = sanitizeHtml(updateStoreDto.description);
    }

    Object.assign(store, updateStoreDto);
    const saved = await this.storeRepository.save(store);

    // Invalidar cache
    await this.redisService.del(`store:${id}`);
    if (store.slug) {
      await this.redisService.del(`store:slug:${store.slug}`);
    }
    await this.redisService.delPattern('seller:store:*');

    this.logger.log(`Loja ${id} atualizada`);

    return saved;
  }

  /**
   * Aprovar loja (Admin)
   */
  async approve(id: string, adminId: string) {
    const store = await this.findOne(id);

    if (store.status !== 'pending_approval') {
      throw new BadRequestException('Loja não está pendente de aprovação');
    }

    store.status = 'active';
    store.approved_at = new Date();
    store.approved_by = adminId;

    // Definir data de expiração da subscrição (30 dias)
    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);
    store.subscription_end_date = subscriptionEnd;

    await this.storeRepository.save(store);

    // Registrar log de status
    await this.logStatusChange(id, adminId, 'pending_approval', 'active', 'Loja aprovada');

    // Enviar email de aprovação
    const owner = await this.storeRepository
      .createQueryBuilder('store')
      .innerJoinAndSelect('store.owner', 'owner')
      .where('store.id = :id', { id })
      .getOne();

    if (owner?.owner) {
      await this.emailService.sendStoreApprovalEmail(
        (owner.owner as any).email,
        store.name,
        (owner.owner as any).name,
        true,
      );
    }

    // Invalidar cache
    await this.redisService.del(`store:${id}`);
    await this.redisService.delPattern('seller:store:*');

    this.logger.log(`Loja ${id} aprovada por admin ${adminId}`);

    return { message: 'Loja aprovada com sucesso' };
  }

  /**
   * Rejeitar loja (Admin)
   */
  async reject(id: string, adminId: string, reason: string) {
    const store = await this.findOne(id);

    if (store.status !== 'pending_approval') {
      throw new BadRequestException('Loja não está pendente de aprovação');
    }

    store.status = 'rejected';
    await this.storeRepository.save(store);

    await this.logStatusChange(id, adminId, 'pending_approval', 'rejected', reason);

    // Invalidar cache
    await this.redisService.del(`store:${id}`);

    this.logger.log(`Loja ${id} rejeitada por admin ${adminId}`);

    return { message: 'Loja rejeitada' };
  }

  /**
   * Bloquear loja por fraude (Admin)
   */
  async suspend(id: string, adminId: string, reason: string) {
    const store = await this.findOne(id);
    const previousStatus = store.status;

    store.status = 'suspended_fraud';
    await this.storeRepository.save(store);

    await this.logStatusChange(id, adminId, previousStatus, 'suspended_fraud', reason);

    // Invalidar cache
    await this.redisService.del(`store:${id}`);
    await this.redisService.delPattern('seller:store:*');

    this.logger.warn(`Loja ${id} suspensa por fraude: ${reason}`);

    return { message: 'Loja suspensa' };
  }

  /**
   * Solicitar upgrade de plano
   */
  async requestPlanUpgrade(
    storeId: string,
    requestedPlanId: number,
    userId: string,
    paymentProofUrl?: string,
  ) {
    const store = await this.findOne(storeId);

    if (store.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    if (store.status !== 'active') {
      throw new BadRequestException('Loja precisa estar ativa');
    }

    const request = this.upgradeRequestRepository.create({
      store_id: storeId,
      requested_plan_id: requestedPlanId,
      payment_proof_url: paymentProofUrl,
    });

    const saved = await this.upgradeRequestRepository.save(request);

    this.logger.log(`Upgrade solicitado para loja ${storeId}`);

    return saved;
  }

  /**
   * Listar solicitações de upgrade pendentes (Admin)
   */
  async findAllUpgradeRequests(status = 'pending') {
    return this.upgradeRequestRepository.find({
      where: { status },
      relations: ['store', 'requested_plan'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Responder solicitação de upgrade (Admin)
   */
  async respondToUpgradeRequest(
    requestId: string,
    status: 'approved' | 'rejected',
    adminId: string,
    adminNotes?: string,
  ) {
    const request = await this.upgradeRequestRepository.findOne({
      where: { id: requestId },
      relations: ['store'],
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    request.status = status;
    request.admin_notes = adminNotes || null;
    await this.upgradeRequestRepository.save(request);

    if (status === 'approved') {
      const store = request.store as Store;
      const oldPlanId = store.plan_id;

      store.plan_id = request.requested_plan_id;
      await this.storeRepository.save(store);

      // Registrar mudança de plano
      const planChange = this.planChangeRepository.create({
        store_id: store.id,
        admin_id: adminId,
        old_plan_id: oldPlanId,
        new_plan_id: request.requested_plan_id,
        reason: adminNotes || 'Upgrade aprovado',
      });
      await this.planChangeRepository.save(planChange);

      // Invalidar cache
      await this.redisService.del(`store:${store.id}`);
    }

    return { message: `Solicitação ${status}` };
  }

  /**
   * Registrar mudança de status
   */
  private async logStatusChange(
    storeId: string,
    adminId: string,
    previousStatus: string,
    newStatus: string,
    reason: string,
  ) {
    const log = this.statusLogRepository.create({
      store_id: storeId,
      admin_id: adminId,
      previous_status: previousStatus,
      new_status: newStatus,
      reason,
    });

    await this.statusLogRepository.save(log);
  }
}

import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SellerPlan } from './entities/seller-plan.entity.js';
import { Store } from '../stores/entities/store.entity.js';

/** Hierarquia rigorosa: Normal < Black < Premium */
const TIER_RANK: Record<string, number> = {
  normal: 1,
  black: 2,
  premium: 3,
};

/**
 * Serviço centralizado de permissões de planos.
 *
 * Regra rigorosa: um vendedor só pode usar o plano que lhe pertence.
 * - Não pode criar loja com plano igual/superior ao que já possui (deve pagar upgrade via admin).
 * - Só pode solicitar upgrade para um plano ESTRITAMENTE superior ao atual.
 * - Um plano só acede ao que a sua linha da matriz permite (Normal < Black < Premium).
 */
@Injectable()
export class PlanPermissionsService {
  private readonly logger = new Logger(PlanPermissionsService.name);

  constructor(
    @InjectRepository(SellerPlan)
    private readonly planRepository: Repository<SellerPlan>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  /**
   * Obter plano ativo por ID (reutilizável, com cache simples em memória).
   */
  async getActivePlan(planId: number): Promise<SellerPlan> {
    const plan = await this.planRepository.findOne({
      where: { id: planId, is_active: true },
    });

    if (!plan) {
      throw new ForbiddenException('Você não tem permissão para usar este plano.');
    }

    return plan;
  }

  /**
   * Obter a loja ativa do vendedor com o plano carregado.
   */
  async getStoreOfUser(userId: string): Promise<Store> {
    const store = await this.storeRepository.findOne({
      where: { owner_id: userId, status: 'active' },
      relations: ['plan'],
    });

    if (!store) {
      throw new ForbiddenException(
        'Utilizador não possui uma loja ativa. Crie uma loja primeiro.',
      );
    }

    return store;
  }

  /**
   * Validar que o plano solicitado existe e é ativo, e que o vendedor
   * tem permissão para usá-lo:
   * - Primeira loja: apenas planos ativos (o plano escolhido será o dele, mediante aprovação/pagamento).
   * - Vendedor que já possui loja: só pode reutilizar o MESMO plano; plano diferente
   *   exige solicitação de upgrade aprovada pelo admin (nunca direto no create/update).
   */
  async assertCanUsePlan(planId: number, userId: string): Promise<SellerPlan> {
    const plan = await this.getActivePlan(planId);

    const existingStore = await this.storeRepository.findOne({
      where: { owner_id: userId, status: 'active' },
      relations: ['plan'],
    });

    if (existingStore) {
      const currentPlan = existingStore.plan as SellerPlan | undefined;

      // Vendedor tenta apontar a loja para um plano que não lhe pertence
      // (ex: normal → premium/black sem pagar upgrade)
      if (!currentPlan || currentPlan.id !== plan.id) {
        throw new ForbiddenException(
          'Você não tem permissão para usar este plano. Solicite um upgrade ao administrador.',
        );
      }
    }

    return plan;
  }

  /**
   * Validar solicitação de upgrade:
   * - O plano solicitado deve existir e estar ativo.
   * - Deve ser ESTRITAMENTE superior ao plano atual da loja.
   *   (Normal → Black/Premium ok; Black → Premium ok; Normal → Normal ou Premium → qualquer = erro)
   */
  async assertValidUpgradeRequest(
    storeId: string,
    requestedPlanId: number,
  ): Promise<{ store: Store; currentPlan: SellerPlan; requestedPlan: SellerPlan }> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      relations: ['plan'],
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    const currentPlan = store.plan as SellerPlan | undefined;

    if (!currentPlan) {
      throw new ForbiddenException('Loja sem plano associado');
    }

    const requestedPlan = await this.planRepository.findOne({
      where: { id: requestedPlanId, is_active: true },
    });

    if (!requestedPlan) {
      throw new ForbiddenException('Você não tem permissão para usar este plano.');
    }

    if (requestedPlan.id === currentPlan.id) {
      throw new BadRequestException(
        `A loja já possui o plano ${currentPlan.name}. Escolha um plano superior para fazer upgrade.`,
      );
    }

    const currentRank = TIER_RANK[currentPlan.tier] ?? 0;
    const requestedRank = TIER_RANK[requestedPlan.tier] ?? 0;

    // Downgrade ou plano de outro tier não permitido via upgrade
    if (requestedRank <= currentRank) {
      throw new ForbiddenException(
        'Você não tem permissão para usar este plano. O upgrade só é permitido para um plano superior.',
      );
    }

    return { store, currentPlan, requestedPlan };
  }

  /**
   * Aplicar mudança de plano (após aprovação do admin), garantindo que
   * o novo plano é superior ao atual e registrando a transição.
   */
  async applyPlanChange(
    storeId: string,
    newPlanId: number,
    adminId: string,
    reason: string,
  ): Promise<void> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      relations: ['plan'],
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    const currentPlan = store.plan as SellerPlan | undefined;
    const newPlan = await this.planRepository.findOne({
      where: { id: newPlanId },
    });

    if (!newPlan || !currentPlan) {
      throw new ForbiddenException('Você não tem permissão para usar este plano.');
    }

    const currentRank = TIER_RANK[currentPlan.tier] ?? 0;
    const newRank = TIER_RANK[newPlan.tier] ?? 0;

    // Hierarquia rigorosa: só é possível subir (Normal < Black < Premium)
    if (newRank <= currentRank) {
      throw new ForbiddenException(
        'Você não tem permissão para usar este plano. A mudança só é permitida para um plano superior.',
      );
    }

    const oldPlanId = store.plan_id;
    store.plan_id = newPlanId;
    await this.storeRepository.save(store);

    // (O registro de seller_plan_changes é feito pelo chamador)
    this.logger.log(
      `Plano da loja ${storeId} alterado de ${currentPlan.name} para ${newPlan.name} por admin ${adminId}: ${reason}`,
    );
    void oldPlanId;
  }
}

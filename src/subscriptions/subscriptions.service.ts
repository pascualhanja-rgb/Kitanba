import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StoreSubscriptionPayment } from './entities/store-subscription-payment.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(StoreSubscriptionPayment)
    private readonly paymentRepository: Repository<StoreSubscriptionPayment>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly redisService: RedisService,
  ) {}

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
      throw new ForbiddenException(
        'Sem permissão para aceder pagamentos desta loja',
      );
    }
  }

  /**
   * Listar pagamentos de uma loja
   */
  async findByStore(storeId: string) {
    return this.paymentRepository.find({
      where: { store_id: storeId },
      relations: ['plan'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Listar todos os pagamentos (Admin)
   */
  async findAll(status?: string) {
    const where = status ? { status } : {};
    return this.paymentRepository.find({
      where,
      relations: ['store', 'plan'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Registrar pagamento
   */
  async createPayment(dto: {
    store_id: string;
    plan_id: number;
    amount: number;
    payment_method: string;
  }) {
    const payment = this.paymentRepository.create({
      ...dto,
      status: 'pending',
    });

    const saved = await this.paymentRepository.save(payment);

    this.logger.log(`Pagamento registrado para loja ${dto.store_id}`);

    return saved;
  }

  /**
   * Aprovar pagamento (Admin)
   */
  async approvePayment(id: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    payment.status = 'approved';
    payment.paid_at = new Date();
    await this.paymentRepository.save(payment);

    this.logger.log(`Pagamento ${id} aprovado`);

    return { message: 'Pagamento aprovado' };
  }

  /**
   * Rejeitar pagamento (Admin)
   */
  async rejectPayment(id: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    payment.status = 'failed';
    await this.paymentRepository.save(payment);

    return { message: 'Pagamento rejeitado' };
  }
}

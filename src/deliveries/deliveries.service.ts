import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { Delivery } from './entities/delivery.entity.js';
import { DeliveryTrackingLog } from './entities/delivery-tracking-log.entity.js';
import { Order } from '../orders/entities/order.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { RealtimeService } from './realtime/realtime.service.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { User } from '../users/entities/user.entity.js';

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepository: Repository<Delivery>,
    @InjectRepository(DeliveryTrackingLog)
    private readonly trackingLogRepository: Repository<DeliveryTrackingLog>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly realtimeService: RealtimeService,
    private readonly invoicesService: InvoicesService,
  ) {}

  /**
   * Listar todas as entregas da plataforma (supervisão admin)
   */
  async findAll(page = 1, limit = 20, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await this.deliveryRepository.findAndCount({
      where,
      relations: ['store', 'courier', 'customer'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Listar entregas disponíveis (estafeta procurar trabalho)
   */
  async findAvailable(courierUserId: string) {
    // Estafeta precisa ser afiliado (role courier) de pelo menos uma loja
    const affiliations = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('store_affiliates', 'sa', 'sa.user_id = user.id')
      .where('user.id = :userId', { userId: courierUserId })
      .andWhere('sa.is_active = :isActive', { isActive: true })
      .andWhere('sa.role IN (:...roles)', { roles: ['courier', 'manager'] })
      .select('sa.store_id', 'store_id')
      .getRawMany();

    const storeIds = affiliations.map((a) => a.store_id);

    const where: any = { status: 'pending' };
    if (storeIds.length > 0) {
      where.store_id = In(storeIds);
    } else {
      return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }

    const [data, total] = await this.deliveryRepository.findAndCount({
      where,
      relations: ['store'],
      order: { created_at: 'ASC' },
    });

    return {
      data,
      meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) },
    };
  }

  /**
   * Estafeta aceitar entrega
   */
  async accept(deliveryId: string, courierUserId: string) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId, status: 'pending' },
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada ou já aceite');
    }

    delivery.courier_id = courierUserId;
    delivery.status = 'accepted';
    delivery.started_at = new Date();

    const saved = await this.deliveryRepository.save(delivery);

    // Emitir atualização em tempo real para o cliente acompanhar
    this.realtimeService.emitDeliveryUpdate(saved);

    this.logger.log(`Entrega ${deliveryId} aceite por estafeta ${courierUserId}`);

    return saved;
  }

  /**
   * Atualizar status da entrega (picking_up, in_transit, delivered, cancelled)
   */
  async updateStatus(
    deliveryId: string,
    status: 'picking_up' | 'in_transit' | 'delivered' | 'cancelled',
    userId: string,
    userType: string,
  ) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['store'],
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    const isCourier = delivery.courier_id === userId;
    const isStoreOwner = (delivery.store as any).owner_id === userId;

    if (!isCourier && !isStoreOwner && userType !== 'admin') {
      throw new ForbiddenException('Sem permissão para atualizar esta entrega');
    }

    delivery.status = status;

    if (status === 'delivered') {
      delivery.completed_at = new Date();

      // Conclusão da entrega -> atualizar pedido para 'delivered' e emitir fatura
      if (delivery.order_id) {
        await this.orderRepository.update(
          { id: delivery.order_id },
          { status: 'delivered' },
        );
      }

      try {
        await this.invoicesService.issueInvoiceForDelivery(delivery.id);
      } catch (error) {
        // Fatura não deve bloquear a conclusão da entrega
        this.logger.error(`Falha ao emitir fatura para entrega ${deliveryId}: ${error.message}`);
      }
    }

    const saved = await this.deliveryRepository.save(delivery);

    // Notificar cliente em tempo real
    this.realtimeService.emitDeliveryUpdate(saved);

    this.logger.log(`Entrega ${deliveryId} -> ${status} (por ${userId})`);

    return saved;
  }

  /**
   * Registrar posição do estafeta (rastreamento em tempo real)
   * Insere log + emite via WebSocket para o cliente desenhar a seta no mapa
   */
  async trackPosition(
    deliveryId: string,
    courierUserId: string,
    latitude: number,
    longitude: number,
    heading?: number,
    speed?: number,
  ) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    if (delivery.courier_id !== courierUserId) {
      throw new ForbiddenException('Sem permissão para rastrear esta entrega');
    }

    const log = this.trackingLogRepository.create({
      delivery_id: deliveryId,
      latitude,
      longitude,
      heading: heading ?? null,
      speed: speed ?? null,
    });

    await this.trackingLogRepository.save(log);

    // Emitir para a sala da entrega (cliente/loja acompanham a seta no mapa)
    this.realtimeService.emitTrackingUpdate(deliveryId, {
      delivery_id: deliveryId,
      latitude,
      longitude,
      heading,
      speed,
      created_at: log.created_at,
    });

    return {
      message: 'Posição registada',
      delivery_id: deliveryId,
      latitude,
      longitude,
    };
  }

  /**
   * Última posição conhecida (para reidratar mapa ao abrir a app)
   */
  async getLatestPosition(deliveryId: string, userId: string, userType: string) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['store'],
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    const isCourier = delivery.courier_id === userId;
    const isStoreOwner = (delivery.store as any).owner_id === userId;
    const isCustomer = delivery.customer_id === userId;

    if (!isCourier && !isStoreOwner && !isCustomer && userType !== 'admin') {
      throw new ForbiddenException('Sem permissão para ver esta entrega');
    }

    const latest = await this.trackingLogRepository.findOne({
      where: { delivery_id: deliveryId },
      order: { created_at: 'DESC' },
    });

    return {
      delivery_id: deliveryId,
      status: delivery.status,
      courier_id: delivery.courier_id,
      position: latest,
    };
  }

  /**
   * Histórico completo de posições (rota percorrida)
   */
  async getTrackingHistory(deliveryId: string, userId: string, userType: string) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['store'],
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    const isCourier = delivery.courier_id === userId;
    const isStoreOwner = (delivery.store as any).owner_id === userId;
    const isCustomer = delivery.customer_id === userId;

    if (!isCourier && !isStoreOwner && !isCustomer && userType !== 'admin') {
      throw new ForbiddenException('Sem permissão para ver esta entrega');
    }

    const logs = await this.trackingLogRepository.find({
      where: { delivery_id: deliveryId },
      order: { created_at: 'ASC' },
    });

    return { data: logs };
  }

  /**
   * Listar entregas do cliente (para acompanhar no mapa)
   */
  async findByCustomer(customerId: string, page = 1, limit = 20) {
    const [data, total] = await this.deliveryRepository.findAndCount({
      where: { customer_id: customerId },
      relations: ['store', 'courier'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Listar entregas da loja (vendedor)
   */
  async findByStore(storeId: string, page = 1, limit = 20) {
    const [data, total] = await this.deliveryRepository.findAndCount({
      where: { store_id: storeId },
      relations: ['courier'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Obter entrega por ID com validação de acesso
   */
  async findOne(deliveryId: string, userId: string, userType: string) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['store', 'courier', 'order'],
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    const isCourier = delivery.courier_id === userId;
    const isStoreOwner = (delivery.store as any).owner_id === userId;
    const isCustomer = delivery.customer_id === userId;

    if (!isCourier && !isStoreOwner && !isCustomer && userType !== 'admin') {
      throw new ForbiddenException('Sem permissão para ver esta entrega');
    }

    return delivery;
  }

  /**
   * Resolver store_id do vendedor autenticado
   */
  async resolveStoreId(userId: string): Promise<string> {
    const store = await this.storeRepository.findOne({
      where: { owner_id: userId, status: 'active' },
    });

    if (!store) {
      throw new ForbiddenException(
        'Utilizador não possui uma loja ativa. Crie uma loja primeiro.',
      );
    }

    return store.id;
  }
}

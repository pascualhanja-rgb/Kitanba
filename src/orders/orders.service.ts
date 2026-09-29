import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';

import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { CampaignProduct } from '../promotions/entities/campaign-product.entity.js';
import { PromotionalCampaign } from '../promotions/entities/promotional-campaign.entity.js';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { RedisService } from '../common/redis/redis.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(CampaignProduct)
    private readonly campaignProductRepository: Repository<CampaignProduct>,
    @InjectRepository(Delivery)
    private readonly deliveryRepository: Repository<Delivery>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Gerar número do pedido sequencial: PED-2026-0001
   */
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();

    const result = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.order_number LIKE :pattern', { pattern: `PED-${year}-%` })
      .withDeleted()
      .orderBy('order.order_number', 'DESC')
      .limit(1)
      .getOne();

    const lastNumber = result
      ? parseInt(result.order_number.split('-')[2], 10)
      : 0;

    const next = (lastNumber + 1).toString().padStart(4, '0');
    return `PED-${year}-${next}`;
  }

  /**
   * Buscar preço promocional ativo para um produto (campanha ativa agora)
   */
  private async getActivePromotionalPrice(
    productIds: string[],
  ): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();

    const now = new Date();
    const campaignProducts = await this.campaignProductRepository
      .createQueryBuilder('cp')
      .innerJoin(
        PromotionalCampaign,
        'campaign',
        'campaign.id = cp.campaign_id',
      )
      .where('cp.product_id IN (:...productIds)', { productIds })
      .andWhere('campaign.is_active = :isActive', { isActive: true })
      .andWhere('campaign.starts_at <= :now', { now })
      .andWhere('campaign.ends_at >= :now', { now })
      .getMany();

    const priceMap = new Map<string, number>();
    for (const cp of campaignProducts) {
      // Menor preço promocional vence em caso de múltiplas campanhas
      const current = priceMap.get(cp.product_id);
      if (current === undefined || cp.promotional_price < current) {
        priceMap.set(cp.product_id, cp.promotional_price);
      }
    }

    return priceMap;
  }

  /**
   * Criar pedido (checkout do cliente para entrega em casa)
   * - Preços calculados no servidor (nunca confiar no cliente)
   * - Aplica preço promocional se houver campanha ativa ("Sextou")
   * - Valida estoque
   */
  async create(createOrderDto: CreateOrderDto, customerId: string) {
    const { store_id, items, delivery_address, delivery_latitude, delivery_longitude, delivery_notes } =
      createOrderDto;

    // 1. Validar loja ativa
    const store = await this.storeRepository.findOne({
      where: { id: store_id, status: 'active' },
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada ou não está ativa');
    }

    // 2. Carregar produtos e validar
    const productIds = items.map((i) => i.product_id);
    const products = await this.productRepository.find({
      where: { id: In(productIds), store_id, is_active: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'Um ou mais produtos não existem, estão inativos ou não pertencem a esta loja',
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Preços promocionais ativos
    const promoPrices = await this.getActivePromotionalPrice(productIds);

    // 4. Calcular valores e validar estoque (transação)
    return this.dataSource.transaction(async (manager) => {
      let subtotal = 0;
      const orderItems: OrderItem[] = [];

      for (const item of items) {
        const product = productMap.get(item.product_id)!;

        if (product.stock_quantity < item.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente para o produto: ${product.title}`,
          );
        }

        // Preço promocional tem prioridade sobre o preço normal
        const unitPrice = promoPrices.get(product.id) ?? Number(product.price);

        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        orderItems.push(
          this.orderItemRepository.create({
            product_id: product.id,
            quantity: item.quantity,
            unit_price: unitPrice,
            total_price: totalPrice,
          }),
        );

        // Baixar estoque
        await manager
          .createQueryBuilder()
          .update(Product)
          .set({ stock_quantity: () => `stock_quantity - ${item.quantity}` })
          .where('id = :id', { id: product.id })
          .execute();
      }

      // Frete: usa shipping_cost do produto quando 'paid'
      let shippingCost = 0;
      for (const item of items) {
        const product = productMap.get(item.product_id)!;
        if (product.shipping_type === 'paid') {
          shippingCost = Math.max(shippingCost, Number(product.shipping_cost));
        }
      }

      const orderNumber = await this.generateOrderNumber();

      const order = this.orderRepository.create({
        order_number: orderNumber,
        customer_id: customerId,
        store_id,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        delivery_notes: delivery_notes || null,
        subtotal: Number(subtotal.toFixed(2)),
        shipping_cost: shippingCost,
        total_amount: Number((subtotal + shippingCost).toFixed(2)),
        status: 'pending',
      });

      const savedOrder = await manager.save(Order, order);

      for (const item of orderItems) {
        item.order_id = savedOrder.id;
      }
      await manager.save(OrderItem, orderItems);

      this.logger.log(`Pedido ${savedOrder.order_number} criado por ${customerId}`);

      return {
        ...savedOrder,
        items: orderItems,
      };
    });
  }

  /**
   * Confirmar pedido (vendedor) - cria automaticamente a entrega
   */
  async confirm(orderId: string, userId: string, userType: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['store'],
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    // Apenas a loja do pedido (ou admin) pode confirmar
    const isStoreOwner = (order.store as any).owner_id === userId;
    if (!isStoreOwner && userType !== 'admin') {
      throw new ForbiddenException('Sem permissão para confirmar este pedido');
    }

    if (order.status !== 'pending') {
      throw new BadRequestException(
        `Pedido não pode ser confirmado no estado atual: ${order.status}`,
      );
    }

    const store = order.store as Store;

    if (!store.address || store.latitude == null || store.longitude == null) {
      throw new BadRequestException(
        'Loja não possui endereço/coordenadas de pickup configurados',
      );
    }

    order.status = 'confirmed';
    await this.orderRepository.save(order);

    // Despacho para entrega: criar registro em deliveries com dados da loja (pickup)
    const delivery = this.deliveryRepository.create({
      store_id: order.store_id,
      customer_id: order.customer_id,
      order_id: order.id,
      pickup_address: store.address,
      pickup_latitude: store.latitude,
      pickup_longitude: store.longitude,
      delivery_address: order.delivery_address,
      delivery_latitude: order.delivery_latitude,
      delivery_longitude: order.delivery_longitude,
      status: 'pending',
      fee: Number(order.shipping_cost),
    });

    const savedDelivery = await this.deliveryRepository.save(delivery);

    this.logger.log(`Pedido ${order.order_number} confirmado - entrega ${savedDelivery.id} criada`);

    return {
      message: 'Pedido confirmado. Entrega criada com sucesso.',
      order,
      delivery: savedDelivery,
    };
  }

  /**
   * Atualizar status do pedido
   */
  async updateStatus(
    orderId: string,
    status: 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled',
    userId: string,
    userType: string,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['store'],
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const isStoreOwner = (order.store as any).owner_id === userId;
    const isCustomer = order.customer_id === userId;

    // Cliente só pode cancelar; loja/admin pode tudo
    if (!isStoreOwner && userType !== 'admin' && !(isCustomer && status === 'cancelled')) {
      throw new ForbiddenException('Sem permissão para alterar este pedido');
    }

    if (isCustomer && status === 'cancelled' && order.status !== 'pending') {
      throw new BadRequestException(
        'Pedido só pode ser cancelado pelo cliente enquanto estiver pendente',
      );
    }

    order.status = status;
    await this.orderRepository.save(order);

    // Se cancelado e já existia entrega, cancelar entrega também
    if (status === 'cancelled') {
      await this.deliveryRepository.update(
        { order_id: order.id, status: 'pending' },
        { status: 'cancelled' },
      );
    }

    this.logger.log(`Pedido ${order.order_number} -> ${status} (por ${userId})`);

    return order;
  }

  /**
   * Listar pedidos do cliente autenticado
   */
  async findByCustomer(customerId: string, page = 1, limit = 20) {
    const [data, total] = await this.orderRepository.findAndCount({
      where: { customer_id: customerId },
      relations: ['items', 'store'],
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
   * Listar pedidos de uma loja (vendedor)
   */
  async findByStore(storeId: string, page = 1, limit = 20, status?: string) {
    const where: any = { store_id: storeId };
    if (status) where.status = status;

    const [data, total] = await this.orderRepository.findAndCount({
      where,
      relations: ['items', 'customer'],
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
   * Listar todos os pedidos (Admin)
   */
  async findAll(page = 1, limit = 20, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await this.orderRepository.findAndCount({
      where,
      relations: ['items', 'store', 'customer'],
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
   * Obter pedido por ID com validação de acesso
   */
  async findOne(orderId: string, userId: string, userType: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'store', 'customer'],
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const isOwner = (order.store as any).owner_id === userId;
    const isCustomer = order.customer_id === userId;

    if (!isOwner && !isCustomer && userType !== 'admin') {
      throw new ForbiddenException('Sem permissão para ver este pedido');
    }

    return order;
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

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { Invoice } from './entities/invoice.entity.js';
import { InvoiceItem } from './entities/invoice-item.entity.js';
import { StoreBillingProfile } from './entities/store-billing-profile.entity.js';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { User } from '../users/entities/user.entity.js';
import { OrderItem } from '../orders/entities/order-item.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { RedisService } from '../common/redis/redis.service.js';
import {
  CreateBillingProfileDto,
  UpdateBillingProfileDto,
} from './dto/billing-profile.dto.js';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(StoreBillingProfile)
    private readonly billingProfileRepository: Repository<StoreBillingProfile>,
    @InjectRepository(Delivery)
    private readonly deliveryRepository: Repository<Delivery>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Gerar número da fatura sequencial: FT 2026/0001
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();

    const result = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.invoice_number LIKE :pattern', { pattern: `FT ${year}/%` })
      .orderBy('invoice.invoice_number', 'DESC')
      .limit(1)
      .getOne();

    const lastNumber = result
      ? parseInt(result.invoice_number.split('/')[1], 10)
      : 0;

    const next = (lastNumber + 1).toString().padStart(4, '0');
    return `FT ${year}/${next}`;
  }

  /**
   * Regra de negócio #4: Emissão de fatura quando entrega fica 'delivered'
   * - Usa perfil fiscal da loja; se não existir, usa dados do vendedor individual (users)
   * - Cria fatura + itens + download_token único (hash criptográfico)
   */
  async issueInvoiceForDelivery(deliveryId: string) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['order', 'order.items', 'store', 'customer'],
    });

    if (!delivery) {
      throw new NotFoundException('Entrega não encontrada');
    }

    // Se já existe fatura para esta entrega, não duplicar
    const existing = await this.invoiceRepository.findOne({
      where: { delivery_id: delivery.id },
    });

    if (existing) {
      return existing;
    }

    const store = delivery.store as Store;
    const order = delivery.order as any;

    if (!order) {
      throw new BadRequestException('Entrega não está associada a um pedido');
    }

    // 1. Perfil fiscal da loja ou fallback para dados do vendedor individual
    const billingProfile = await this.billingProfileRepository.findOne({
      where: { store_id: store.id },
    });

    let issuerName: string;
    let issuerNif: string | null;
    let entityType: string;

    if (billingProfile) {
      issuerName =
        billingProfile.entity_type === 'company'
          ? billingProfile.company_name || store.name
          : store.name;
      issuerNif = billingProfile.nif;
      entityType = billingProfile.entity_type;
    } else {
      // Fallback: dados do vendedor individual
      const owner = await this.userRepository.findOne({
        where: { id: store.owner_id },
      });

      issuerName = owner?.name || store.name;
      issuerNif = null;
      entityType = 'individual';
    }

    // 2. Valores
    const subtotal = Number(order.subtotal ?? order.total_amount);
    const total = Number(order.total_amount);

    // 3. Download token único
    const downloadToken = crypto.randomBytes(24).toString('hex');
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = this.invoiceRepository.create({
      invoice_number: invoiceNumber,
      store_id: store.id,
      delivery_id: delivery.id,
      customer_id: delivery.customer_id,
      issuer_name: issuerName,
      issuer_nif: issuerNif,
      entity_type: entityType,
      subtotal,
      tax_amount: 0,
      total_amount: total,
      download_token: downloadToken,
      status: 'issued',
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // 4. Itens da fatura (a partir dos itens do pedido, com descrição real do produto)
    const orderItems = (order.items || []) as OrderItem[];

    if (orderItems.length > 0) {
      const productIds = orderItems
        .map((i) => i.product_id)
        .filter((id): id is string => !!id);

      const products = productIds.length
        ? await this.productRepository.find({ where: productIds.map((id) => ({ id })) })
        : [];

      const productMap = new Map(products.map((p) => [p.id, p.title]));

      const items = orderItems.map((item) =>
        this.invoiceItemRepository.create({
          invoice_id: savedInvoice.id,
          product_id: item.product_id,
          description: productMap.get(item.product_id || '') || `Produto ${item.product_id}`,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
        }),
      );

      await this.invoiceItemRepository.save(items);
    }

    this.logger.log(`Fatura ${invoiceNumber} emitida para entrega ${deliveryId}`);

    return savedInvoice;
  }

  // ==================== PERFIL FISCAL ====================

  /**
   * Criar perfil fiscal da loja (vendedor)
   */
  async createBillingProfile(storeId: string, dto: CreateBillingProfileDto) {
    const existing = await this.billingProfileRepository.findOne({
      where: { store_id: storeId },
    });

    if (existing) {
      throw new BadRequestException('Loja já possui perfil fiscal');
    }

    const profile = this.billingProfileRepository.create({
      ...dto,
      store_id: storeId,
    });

    const saved = await this.billingProfileRepository.save(profile);

    this.logger.log(`Perfil fiscal criado para loja ${storeId}`);

    return saved;
  }

  /**
   * Atualizar perfil fiscal da loja
   */
  async updateBillingProfile(storeId: string, dto: UpdateBillingProfileDto) {
    const profile = await this.billingProfileRepository.findOne({
      where: { store_id: storeId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil fiscal não encontrado');
    }

    Object.assign(profile, dto);
    return this.billingProfileRepository.save(profile);
  }

  /**
   * Obter perfil fiscal da loja
   */
  async getBillingProfile(storeId: string) {
    const profile = await this.billingProfileRepository.findOne({
      where: { store_id: storeId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil fiscal não encontrado');
    }

    return profile;
  }

  // ==================== FATURAS ====================

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

  /**
   * Listar faturas da loja (vendedor)
   */
  async findByStore(storeId: string, page = 1, limit = 20) {
    const [data, total] = await this.invoiceRepository.findAndCount({
      where: { store_id: storeId },
      relations: ['items', 'customer'],
      skip: (page - 1) * limit,
      take: limit,
      order: { issued_at: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Listar faturas do cliente
   */
  async findByCustomer(customerId: string, page = 1, limit = 20) {
    const [data, total] = await this.invoiceRepository.findAndCount({
      where: { customer_id: customerId },
      relations: ['items', 'store'],
      skip: (page - 1) * limit,
      take: limit,
      order: { issued_at: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Listar todas as faturas (Admin)
   */
  async findAll(page = 1, limit = 20, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await this.invoiceRepository.findAndCount({
      where,
      relations: ['items', 'store', 'customer'],
      skip: (page - 1) * limit,
      take: limit,
      order: { issued_at: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Obter fatura por ID com validação de acesso
   */
  async findOne(invoiceId: string, userId: string, userType: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['items', 'store', 'customer'],
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    const isCustomer = invoice.customer_id === userId;
    const isStoreOwner = (invoice.store as any)?.owner_id === userId;

    if (!isCustomer && !isStoreOwner && userType !== 'admin') {
      throw new ForbiddenException('Sem permissão para ver esta fatura');
    }

    return invoice;
  }

  /**
   * Regra de negócio #4: Download da fatura pelo cliente via token
   */
  async getByDownloadToken(token: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { download_token: token },
      relations: ['items', 'store', 'customer'],
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    if (invoice.status === 'cancelled') {
      throw new BadRequestException('Fatura cancelada');
    }

    return invoice;
  }

  /**
   * Cancelar fatura (Admin ou loja dona)
   */
  async cancel(invoiceId: string, userId: string, userType: string) {
    const invoice = await this.findOne(invoiceId, userId, userType);

    if (invoice.status === 'cancelled') {
      throw new BadRequestException('Fatura já está cancelada');
    }

    invoice.status = 'cancelled';
    await this.invoiceRepository.save(invoice);

    this.logger.log(`Fatura ${invoice.invoice_number} cancelada por ${userId}`);

    return invoice;
  }

  /**
   * Marcar fatura como paga (loja ou admin)
   */
  async markAsPaid(invoiceId: string, userId: string, userType: string) {
    const invoice = await this.findOne(invoiceId, userId, userType);

    invoice.status = 'paid';
    await this.invoiceRepository.save(invoice);

    return invoice;
  }

  /**
   * Gerar PDF da fatura com pdfkit
   */
  async generatePdf(invoice: Invoice): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Cabeçalho
    doc.fontSize(20).text('FATURA', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(invoice.invoice_number, { align: 'right' });
    doc.fontSize(10).text(
      `Emitida em: ${new Date(invoice.issued_at).toLocaleDateString('pt-PT')}`,
      { align: 'right' },
    );
    doc.moveDown();

    // Emissor
    doc.fontSize(14).text(invoice.issuer_name);
    if (invoice.issuer_nif) {
      doc.fontSize(10).text(`NIF: ${invoice.issuer_nif}`);
    }
    doc.moveDown();

    // Cliente
    doc.fontSize(12).text('Faturado a:');
    doc.fontSize(10).text((invoice.customer as any)?.name || invoice.customer_id);
    doc.moveDown();

    // Itens
    doc.moveDown();
    doc.fontSize(11).text('Itens');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

    for (const item of invoice.items || []) {
      const y = doc.y;
      doc.fontSize(10).text(`${item.quantity}x`, 50, y);
      doc.text(item.description, 90, y, { width: 280 });
      doc.text(`${Number(item.unit_price).toFixed(2)}`, 380, y, { width: 70, align: 'right' });
      doc.text(`${Number(item.total_price).toFixed(2)}`, 460, y, { width: 85, align: 'right' });
      doc.moveDown(0.5);
    }

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Totais
    doc.fontSize(11).text(`Subtotal: ${Number(invoice.subtotal).toFixed(2)}`, {
      align: 'right',
    });
    doc.text(`Impostos: ${Number(invoice.tax_amount).toFixed(2)}`, { align: 'right' });
    doc.fontSize(13).text(`Total: ${Number(invoice.total_amount).toFixed(2)}`, {
      align: 'right',
    });

    doc.end();

    return done;
  }
}

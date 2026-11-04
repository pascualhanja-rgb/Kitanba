import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ServiceBooking } from './entities/service-booking.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { ServiceDetail } from '../services/entities/service-detail.entity.js';
import { StoreAffiliate } from '../affiliates/entities/store-affiliate.entity.js';
import { ServicesService } from '../services/services.service.js';
import {
  AssignProviderDto,
  CancelBookingDto,
  CreateBookingDto,
  RescheduleBookingDto,
  ServiceQuoteDto,
} from './dto/booking.dto.js';
import { sanitizeHtml } from '../common/utils/sanitize.util.js';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(ServiceBooking)
    private readonly bookingRepository: Repository<ServiceBooking>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(ServiceDetail)
    private readonly serviceDetailRepository: Repository<ServiceDetail>,
    @InjectRepository(StoreAffiliate)
    private readonly affiliateRepository: Repository<StoreAffiliate>,
    private readonly servicesService: ServicesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatBooking(booking: ServiceBooking) {
    return {
      ...booking,
      total_amount: Number(booking.total_amount ?? 0),
      service_latitude:
        booking.service_latitude !== null
          ? Number(booking.service_latitude)
          : null,
      service_longitude:
        booking.service_longitude !== null
          ? Number(booking.service_longitude)
          : null,
      scheduled_time: ServicesService.toHHmm(booking.scheduled_time),
    };
  }

  private async loadBooking(id: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['product', 'store', 'customer', 'provider'],
    });

    if (!booking) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    return booking;
  }

  private async resolveStoreId(userId: string): Promise<string> {
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

  private async isStoreOwner(storeId: string, userId: string) {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
    });
    return store?.owner_id === userId;
  }

  private async assertCanManage(
    booking: ServiceBooking,
    user: any,
    allowProvider = false,
  ) {
    if (user.user_type === 'admin') return;

    if (user.user_type === 'seller') {
      const owner = await this.isStoreOwner(booking.store_id, user.id);
      if (owner) return;
    }

    if (allowProvider && booking.provider_id === user.id) return;

    throw new ForbiddenException('Sem permissão para gerir este agendamento');
  }

  private async assertCustomer(booking: ServiceBooking, userId: string) {
    if (booking.customer_id !== userId) {
      throw new ForbiddenException('Sem permissão para este agendamento');
    }
  }

  private calcTotal(
    pricingType: string,
    price: number,
    durationMinutes: number,
    areaSqm?: number,
  ): number {
    switch (pricingType) {
      case 'per_hour':
        return Number((price * (durationMinutes / 60)).toFixed(2));
      case 'per_sqm':
        if (areaSqm === undefined || areaSqm === null) {
          throw new BadRequestException(
            'Área (m²) é obrigatória para serviços cobrados por metro quadrado',
          );
        }
        return Number((price * areaSqm).toFixed(2));
      case 'quote_required':
        return 0;
      case 'fixed':
      default:
        return Number(price.toFixed(2));
    }
  }

  private assertNotPast(date: string) {
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      throw new BadRequestException('Data no passado');
    }
  }

  // ---------------------------------------------------------------------------
  // Cliente
  // ---------------------------------------------------------------------------

  async create(dto: CreateBookingDto, customerId: string) {
    const product = await this.productRepository.findOne({
      where: { id: dto.product_id, is_active: true },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    if (product.product_type !== 'service') {
      throw new BadRequestException('Produto não é do tipo service');
    }

    const store = await this.storeRepository.findOne({
      where: { id: product.store_id, status: 'active' },
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada ou não está ativa');
    }

    const details = await this.serviceDetailRepository.findOne({
      where: { product_id: product.id },
    });

    if (!details) {
      throw new BadRequestException(
        'Loja sem horários de atendimento configurados',
      );
    }

    this.assertNotPast(dto.scheduled_date);

    const duration = Number(details.estimated_duration_minutes ?? 60);
    const available = await this.servicesService.isSlotAvailable(
      product.store_id,
      dto.scheduled_date,
      dto.scheduled_time,
      duration,
      product.id,
    );

    if (!available) {
      throw new BadRequestException('Horário indisponível para esta loja');
    }

    const total = this.calcTotal(
      details.pricing_type,
      Number(product.price),
      duration,
      dto.area_sqm,
    );

    const booking = await this.bookingRepository.save(
      this.bookingRepository.create({
        customer_id: customerId,
        store_id: product.store_id,
        product_id: product.id,
        scheduled_date: dto.scheduled_date,
        scheduled_time: `${dto.scheduled_time}:00`,
        service_address: sanitizeHtml(dto.service_address),
        service_latitude: dto.service_latitude ?? null,
        service_longitude: dto.service_longitude ?? null,
        status: 'pending',
        total_amount: total,
        notes_from_customer: dto.notes_from_customer
          ? sanitizeHtml(dto.notes_from_customer)
          : null,
      }),
    );

    this.logger.log(
      `Agendamento ${booking.id} criado (cliente ${customerId}, serviço ${product.id})`,
    );

    return {
      ...this.formatBooking(booking),
      pricing_type: details.pricing_type,
      requires_quote: details.pricing_type === 'quote_required',
    };
  }

  async findMine(customerId: string, page = 1, limit = 20, status?: string) {
    const where: any = { customer_id: customerId };
    if (status) where.status = status;

    const [data, total] = await this.bookingRepository.findAndCount({
      where,
      relations: ['product', 'store', 'provider'],
      skip: (page - 1) * limit,
      take: limit,
      order: { scheduled_date: 'DESC' },
    });

    return {
      data: data.map((booking) => this.formatBooking(booking)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: any) {
    const booking = await this.loadBooking(id);

    const allowed =
      user.user_type === 'admin' ||
      booking.customer_id === user.id ||
      booking.provider_id === user.id ||
      (await this.isStoreOwner(booking.store_id, user.id));

    if (!allowed) {
      throw new ForbiddenException('Sem permissão para ver este agendamento');
    }

    return this.formatBooking(booking);
  }

  async cancel(id: string, dto: CancelBookingDto, user: any) {
    const booking = await this.loadBooking(id);

    if (user.user_type === 'customer') {
      await this.assertCustomer(booking, user.id);
    } else {
      await this.assertCanManage(booking, user);
    }

    if (['in_progress', 'completed', 'cancelled'].includes(booking.status)) {
      throw new BadRequestException(
        'Não é possível cancelar um serviço já iniciado',
      );
    }

    booking.status = 'cancelled';

    if (dto.reason) {
      const note = `[cancelamento] ${sanitizeHtml(dto.reason)}`;
      booking.notes_from_customer = booking.notes_from_customer
        ? `${booking.notes_from_customer}\n${note}`
        : note;
    }

    await this.bookingRepository.save(booking);

    return this.formatBooking(booking);
  }

  async reschedule(id: string, dto: RescheduleBookingDto, user: any) {
    const booking = await this.loadBooking(id);

    if (user.user_type === 'customer') {
      await this.assertCustomer(booking, user.id);
    } else {
      await this.assertCanManage(booking, user);
    }

    if (!['pending', 'confirmed', 'rescheduled'].includes(booking.status)) {
      throw new BadRequestException(
        'Agendamento não pode ser reagendado no estado atual',
      );
    }

    this.assertNotPast(dto.scheduled_date);

    const details = await this.serviceDetailRepository.findOne({
      where: { product_id: booking.product_id },
    });
    const duration = Number(details?.estimated_duration_minutes ?? 60);

    const available = await this.servicesService.isSlotAvailable(
      booking.store_id,
      dto.scheduled_date,
      dto.scheduled_time,
      duration,
      booking.product_id,
      booking.id,
    );

    if (!available) {
      throw new BadRequestException('Horário indisponível para esta loja');
    }

    booking.scheduled_date = dto.scheduled_date;
    booking.scheduled_time = `${dto.scheduled_time}:00`;
    booking.status = 'rescheduled';

    if (dto.notes) {
      const note = `[reagendado] ${sanitizeHtml(dto.notes)}`;
      booking.notes_from_customer = booking.notes_from_customer
        ? `${booking.notes_from_customer}\n${note}`
        : note;
    }

    await this.bookingRepository.save(booking);

    return this.formatBooking(booking);
  }

  async acceptQuote(id: string, customerId: string) {
    const booking = await this.loadBooking(id);
    await this.assertCustomer(booking, customerId);

    if (!['pending', 'rescheduled'].includes(booking.status)) {
      throw new BadRequestException(
        'Orçamento não pode ser aceite no estado atual',
      );
    }

    if (Number(booking.total_amount) <= 0) {
      throw new BadRequestException('Orçamento ainda não enviado');
    }

    booking.status = 'confirmed';
    await this.bookingRepository.save(booking);

    return this.formatBooking(booking);
  }

  async rejectQuote(id: string, customerId: string) {
    const booking = await this.loadBooking(id);
    await this.assertCustomer(booking, customerId);

    booking.status = 'cancelled';
    await this.bookingRepository.save(booking);

    return this.formatBooking(booking);
  }

  // ---------------------------------------------------------------------------
  // Vendedor
  // ---------------------------------------------------------------------------

  async findByStore(
    storeId: string | undefined,
    userId: string,
    page = 1,
    limit = 20,
    filters: { date?: string; status?: string } = {},
  ) {
    const resolvedStoreId = storeId ?? (await this.resolveStoreId(userId));

    if (!(await this.isStoreOwner(resolvedStoreId, userId))) {
      throw new ForbiddenException('Sem permissão para gerir esta loja');
    }

    const where: any = { store_id: resolvedStoreId };
    if (filters.status) where.status = filters.status;

    if (filters.date) {
      where.scheduled_date = filters.date;
    }

    const [data, total] = await this.bookingRepository.findAndCount({
      where,
      relations: ['product', 'customer', 'provider'],
      skip: (page - 1) * limit,
      take: limit,
      order: { scheduled_date: 'ASC' },
    });

    return {
      data: data.map((booking) => this.formatBooking(booking)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async confirm(id: string, user: any) {
    const booking = await this.loadBooking(id);
    await this.assertCanManage(booking, user);

    if (!['pending', 'rescheduled'].includes(booking.status)) {
      throw new BadRequestException('Agendamento não pode ser confirmado');
    }

    const details = await this.serviceDetailRepository.findOne({
      where: { product_id: booking.product_id },
    });
    const duration = Number(details?.estimated_duration_minutes ?? 60);

    const available = await this.servicesService.isSlotAvailable(
      booking.store_id,
      booking.scheduled_date,
      ServicesService.toHHmm(booking.scheduled_time),
      duration,
      booking.product_id,
      booking.id,
    );

    if (!available) {
      throw new BadRequestException('Horário já não está disponível');
    }

    booking.status = 'confirmed';
    await this.bookingRepository.save(booking);

    return this.formatBooking(booking);
  }

  async sendQuote(id: string, dto: ServiceQuoteDto, user: any) {
    const booking = await this.loadBooking(id);
    await this.assertCanManage(booking, user);

    const details = await this.serviceDetailRepository.findOne({
      where: { product_id: booking.product_id },
    });

    if (details?.pricing_type !== 'quote_required') {
      throw new BadRequestException(
        'Orçamento não é aplicável a este tipo de preço',
      );
    }

    booking.total_amount = dto.total_amount;

    if (dto.notes) {
      const note = `[orçamento] ${sanitizeHtml(dto.notes)}`;
      booking.notes_from_customer = booking.notes_from_customer
        ? `${booking.notes_from_customer}\n${note}`
        : note;
    }

    await this.bookingRepository.save(booking);

    return this.formatBooking(booking);
  }

  async assignProvider(id: string, dto: AssignProviderDto, user: any) {
    const booking = await this.loadBooking(id);
    await this.assertCanManage(booking, user);

    const affiliate = await this.affiliateRepository.findOne({
      where: {
        store_id: booking.store_id,
        user_id: dto.provider_id,
        is_active: true,
      },
    });

    if (!affiliate) {
      throw new BadRequestException(
        'Prestador não pertence à equipe desta loja',
      );
    }

    booking.provider_id = dto.provider_id;
    await this.bookingRepository.save(booking);

    return this.formatBooking(booking);
  }

  async start(id: string, user: any) {
    const booking = await this.loadBooking(id);
    await this.assertCanManage(booking, user, true);

    if (!['confirmed', 'rescheduled'].includes(booking.status)) {
      throw new BadRequestException('Transição de estado inválida');
    }

    booking.status = 'in_progress';
    booking.started_at = new Date();
    await this.bookingRepository.save(booking);

    return this.formatBooking(booking);
  }

  async complete(id: string, user: any) {
    const booking = await this.loadBooking(id);
    await this.assertCanManage(booking, user, true);

    if (booking.status !== 'in_progress') {
      throw new BadRequestException('Transição de estado inválida');
    }

    booking.status = 'completed';
    booking.completed_at = new Date();
    await this.bookingRepository.save(booking);

    return this.formatBooking(booking);
  }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  async findAll(
    page = 1,
    limit = 20,
    filters: {
      status?: string;
      store_id?: string;
      customer_id?: string;
      provider_id?: string;
      date?: string;
    } = {},
  ) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.store_id) where.store_id = filters.store_id;
    if (filters.customer_id) where.customer_id = filters.customer_id;
    if (filters.provider_id) where.provider_id = filters.provider_id;
    if (filters.date) where.scheduled_date = filters.date;

    const [data, total] = await this.bookingRepository.findAndCount({
      where,
      relations: ['product', 'store', 'customer', 'provider'],
      skip: (page - 1) * limit,
      take: limit,
      order: { scheduled_date: 'DESC' },
    });

    return {
      data: data.map((booking) => this.formatBooking(booking)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async stats() {
    const rows = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('booking.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('booking.status')
      .getRawMany();

    const today = await this.bookingRepository
      .createQueryBuilder('booking')
      .where('booking.scheduled_date = CURRENT_DATE')
      .getCount();

    const avg = await this.bookingRepository
      .createQueryBuilder('booking')
      .select(
        'COALESCE(AVG(EXTRACT(EPOCH FROM (booking.completed_at - booking.started_at)) / 60), 0)',
        'minutes',
      )
      .where('booking.completed_at IS NOT NULL')
      .andWhere('booking.started_at IS NOT NULL')
      .getRawOne();

    const byStatus = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.count)]),
    );

    const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
    const cancelled = byStatus['cancelled'] ?? 0;

    return {
      today,
      by_status: byStatus,
      avg_completion_minutes: Number(
        Number(avg?.minutes ?? 0).toFixed(1),
      ),
      cancellation_rate:
        total > 0 ? Number((cancelled / total).toFixed(2)) : 0,
    };
  }
}

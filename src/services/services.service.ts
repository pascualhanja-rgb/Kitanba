import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ServiceDetail } from './entities/service-detail.entity.js';
import { StoreServiceSchedule } from './entities/store-service-schedule.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { ServiceBooking } from '../bookings/entities/service-booking.entity.js';
import { SetScheduleDto, UpdateServiceDetailsDto } from './dto/service.dto.js';

const BLOCKING_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'rescheduled',
];

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    @InjectRepository(ServiceDetail)
    private readonly serviceDetailRepository: Repository<ServiceDetail>,
    @InjectRepository(StoreServiceSchedule)
    private readonly scheduleRepository: Repository<StoreServiceSchedule>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(ServiceBooking)
    private readonly bookingRepository: Repository<ServiceBooking>,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Normaliza "HH:mm:ss" ou "HH:mm" para minutos desde 00:00 */
  static toMinutes(time: string): number {
    const [hours, minutes] = String(time).split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  /** Normaliza TIME do PostgreSQL ("08:00:00") para "08:00" */
  static toHHmm(time: string): string {
    const [hours, minutes] = String(time).split(':');
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /** Gera blocos a partir da abertura, com passo = duração estimada */
  static generateSlots(
    start: string,
    end: string,
    durationMinutes: number,
  ): string[] {
    const step = Math.max(15, durationMinutes || 60);
    const startMin = ServicesService.toMinutes(start);
    const endMin = ServicesService.toMinutes(end);
    const slots: string[] = [];

    for (let current = startMin; current + step <= endMin; current += step) {
      const hours = Math.floor(current / 60);
      const minutes = current % 60;
      slots.push(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      );
    }

    return slots;
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

  private async getOwnedServiceProduct(productId: string, userId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['store'],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    if ((product.store as any)?.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para este produto');
    }

    if (product.product_type !== 'service') {
      throw new BadRequestException('Produto não é do tipo service');
    }

    return product;
  }

  private async getServiceProduct(productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId, is_active: true },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    if (product.product_type !== 'service') {
      throw new BadRequestException('Produto não é do tipo service');
    }

    return product;
  }

  // ---------------------------------------------------------------------------
  // Detalhes do serviço
  // ---------------------------------------------------------------------------

  async upsertDetails(
    productId: string,
    dto: UpdateServiceDetailsDto,
    userId: string,
  ) {
    await this.getOwnedServiceProduct(productId, userId);

    await this.serviceDetailRepository.upsert(
      {
        product_id: productId,
        pricing_type: dto.pricing_type,
        estimated_duration_minutes: dto.estimated_duration_minutes ?? 60,
        requires_site_visit: dto.requires_site_visit ?? false,
      },
      ['product_id'],
    );

    this.logger.log(`Detalhes do serviço ${productId} atualizados`);

    return this.getDetails(productId);
  }

  async getDetails(productId: string) {
    const details = await this.serviceDetailRepository.findOne({
      where: { product_id: productId },
    });

    if (!details) {
      throw new NotFoundException(
        'Serviço sem detalhes configurados (pricing_type)',
      );
    }

    return details;
  }

  // ---------------------------------------------------------------------------
  // Horários da loja
  // ---------------------------------------------------------------------------

  async setSchedule(dto: SetScheduleDto, userId: string) {
    const storeId = await this.resolveStoreId(userId);

    const seen = new Set<number>();

    for (const day of dto.days) {
      if (seen.has(day.day_of_week)) {
        throw new BadRequestException(
          `Dia da semana duplicado: ${day.day_of_week}`,
        );
      }
      seen.add(day.day_of_week);

      if (
        day.is_available !== false &&
        ServicesService.toMinutes(day.start_time) >=
          ServicesService.toMinutes(day.end_time)
      ) {
        throw new BadRequestException(
          'start_time deve ser anterior a end_time',
        );
      }
    }

    await this.scheduleRepository.delete({ store_id: storeId });

    if (dto.days.length > 0) {
      await this.scheduleRepository.save(
        dto.days.map((day) =>
          this.scheduleRepository.create({
            store_id: storeId,
            day_of_week: day.day_of_week,
            start_time: `${day.start_time}:00`,
            end_time: `${day.end_time}:00`,
            is_available: day.is_available ?? true,
          }),
        ),
      );
    }

    return this.getSchedule(userId);
  }

  async getSchedule(userId: string) {
    const storeId = await this.resolveStoreId(userId);

    const days = await this.scheduleRepository.find({
      where: { store_id: storeId },
      order: { day_of_week: 'ASC' },
    });

    return {
      store_id: storeId,
      days: days.map((day) => ({
        id: day.id,
        day_of_week: day.day_of_week,
        start_time: ServicesService.toHHmm(day.start_time),
        end_time: ServicesService.toHHmm(day.end_time),
        is_available: day.is_available,
      })),
    };
  }

  /**
   * Blocos livres num dia (painel do vendedor)
   */
  async getSlots(userId: string, date: string, productId?: string) {
    const storeId = await this.resolveStoreId(userId);
    return this.computeSlotsForDate(storeId, date, productId);
  }

  private async computeSlotsForDate(
    storeId: string,
    date: string,
    productId?: string,
    ignoreBookingId?: string,
  ): Promise<{
    store_id: string;
    date: string;
    day_of_week?: number;
    available: boolean;
    duration_minutes?: number;
    pricing_type?: string | null;
    slots: string[];
  }> {
    const parsed = new Date(`${date}T00:00:00Z`);

    if (isNaN(parsed.getTime())) {
      throw new BadRequestException('Data inválida');
    }

    const dayOfWeek = parsed.getUTCDay();

    const schedule = await this.scheduleRepository.findOne({
      where: { store_id: storeId, day_of_week: dayOfWeek },
    });

    if (!schedule || !schedule.is_available) {
      return { store_id: storeId, date, available: false, slots: [] };
    }

    let duration = 60;
    let pricingType: string | null = null;

    if (productId) {
      const details = await this.serviceDetailRepository.findOne({
        where: { product_id: productId },
      });

      if (!details) {
        throw new BadRequestException(
          'Serviço sem detalhes configurados (pricing_type)',
        );
      }

      duration = Number(details.estimated_duration_minutes ?? 60);
      pricingType = details.pricing_type;
    }

    const allSlots = ServicesService.generateSlots(
      ServicesService.toHHmm(schedule.start_time),
      ServicesService.toHHmm(schedule.end_time),
      duration,
    );

    const bookings = await this.bookingRepository.find({
      where: {
        store_id: storeId,
        scheduled_date: date,
        status: In(BLOCKING_BOOKING_STATUSES),
      },
    });

    const taken = new Set(
      bookings
        .filter((booking) => booking.id !== ignoreBookingId)
        .map((booking) => ServicesService.toHHmm(booking.scheduled_time)),
    );

    return {
      store_id: storeId,
      date,
      day_of_week: dayOfWeek,
      available: true,
      duration_minutes: duration,
      pricing_type: pricingType,
      slots: allSlots.filter((slot) => !taken.has(slot)),
    };
  }

  /**
   * Disponibilidade pública (próximos 14 dias)
   */
  async availability(productId: string) {
    const product = await this.getServiceProduct(productId);
    const details = await this.getDetails(productId);

    const days: Array<{
      date: string;
      available: boolean;
      slots: string[];
    }> = [];

    const today = new Date();

    for (let offset = 0; offset < 14; offset++) {
      const date = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() + offset,
        ),
      );
      const isoDate = date.toISOString().slice(0, 10);

      const result = await this.computeSlotsForDate(
        product.store_id,
        isoDate,
        product.id,
      );

      days.push({
        date: isoDate,
        available: result.available && result.slots.length > 0,
        slots: result.slots,
      });
    }

    return {
      product_id: productId,
      pricing_type: details.pricing_type,
      estimated_duration_minutes: Number(
        details.estimated_duration_minutes ?? 60,
      ),
      requires_site_visit: details.requires_site_visit,
      days,
    };
  }

  /**
   * Blocos ocupados no dia/hora (usado pelo agendamento)
   */
  /**
   * Blocos de uma loja num dia (usado por agendamentos e pelo vendedor)
   */
  async slotsForStoreDate(storeId: string, date: string, productId?: string) {
    return this.computeSlotsForDate(storeId, date, productId);
  }

  /**
   * Verifica se o bloco pedido existe na agenda e não colide com outro
   * agendamento ativo (considera a duração estimada do serviço).
   */
  async isSlotAvailable(
    storeId: string,
    date: string,
    time: string,
    durationMinutes: number,
    productId?: string,
    ignoreBookingId?: string,
  ): Promise<boolean> {
    const day = await this.computeSlotsForDate(
      storeId,
      date,
      productId,
      ignoreBookingId,
    );

    if (!day.available) return false;

    const requested = ServicesService.toHHmm(time);

    if (!day.slots.includes(requested)) return false;

    const bookings = await this.bookingRepository.find({
      where: {
        store_id: storeId,
        scheduled_date: date,
        status: In(BLOCKING_BOOKING_STATUSES),
      },
    });

    const requestedStart = ServicesService.toMinutes(requested);
    const requestedEnd = requestedStart + Math.max(15, durationMinutes || 60);

    return !bookings
      .filter((booking) => booking.id !== ignoreBookingId)
      .some((booking) => {
        const bookingStart = ServicesService.toMinutes(booking.scheduled_time);
        const bookingEnd =
          bookingStart + Math.max(15, durationMinutes || 60);
        return requestedStart < bookingEnd && requestedEnd > bookingStart;
      });
  }
}

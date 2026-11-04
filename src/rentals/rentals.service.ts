import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Rental } from './entities/rental.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import {
  CreateRentalDto,
  ExtendRentalDto,
  ForceRentalStatusDto,
  ReturnRentalDto,
} from './dto/rental.dto.js';
import { sanitizeHtml } from '../common/utils/sanitize.util.js';

const BLOCKING_STATUSES = ['pending', 'active', 'overdue'];

@Injectable()
export class RentalsService {
  private readonly logger = new Logger(RentalsService.name);

  constructor(
    @InjectRepository(Rental)
    private readonly rentalRepository: Repository<Rental>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatRental(rental: Rental) {
    return {
      ...rental,
      rental_price: Number(rental.rental_price),
      security_deposit: Number(rental.security_deposit ?? 0),
      total_amount: Number(rental.total_amount),
    };
  }

  /**
   * Número de unidades de aluguer (hora/dia/mês) entre duas datas
   */
  private computeUnits(start: Date, end: Date, period: string): number {
    const ms = end.getTime() - start.getTime();
    const unit =
      period === 'hourly'
        ? 60 * 60 * 1000
        : period === 'monthly'
          ? 30 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

    return Math.max(1, Math.ceil(ms / unit));
  }

  private computePrice(product: Product, start: Date, end: Date) {
    const period = product.rental_period_type || 'daily';
    const units = this.computeUnits(start, end, period);
    const rentalPrice = Number((Number(product.price) * units).toFixed(2));
    const deposit = Number(product.security_deposit ?? 0);

    return {
      period_type: period,
      units,
      rental_price: rentalPrice,
      security_deposit: deposit,
      total_amount: Number((rentalPrice + deposit).toFixed(2)),
    };
  }

  private async getRentalProduct(productId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId, is_active: true },
    });

    if (!product) {
      throw new BadRequestException('Produto indisponível');
    }

    if (product.product_type !== 'rental') {
      throw new BadRequestException('Produto não está disponível para aluguer');
    }

    return product;
  }

  private async assertStoreActive(storeId: string) {
    const store = await this.storeRepository.findOne({
      where: { id: storeId, status: 'active' },
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada ou não está ativa');
    }

    return store;
  }

  private async countConflicts(
    productId: string,
    start: Date,
    end: Date,
    ignoreRentalId?: string,
  ): Promise<number> {
    const query = this.rentalRepository
      .createQueryBuilder('rental')
      .where('rental.product_id = :productId', { productId })
      .andWhere('rental.status IN (:...statuses)', {
        statuses: BLOCKING_STATUSES,
      })
      .andWhere('rental.start_date < :end', { end })
      .andWhere('rental.end_date > :start', { start });

    if (ignoreRentalId) {
      query.andWhere('rental.id != :ignoreRentalId', { ignoreRentalId });
    }

    return query.getCount();
  }

  private async assertCanAccess(
    rental: Rental,
    userId: string,
    userType: string,
  ) {
    if (userType === 'admin') return;

    if (rental.customer_id === userId) return;

    if (userType === 'seller') {
      const store = await this.storeRepository.findOne({
        where: { id: rental.store_id },
      });

      if (store?.owner_id === userId) return;
    }

    throw new ForbiddenException('Sem permissão para ver este aluguer');
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

  private async assertStoreOwner(storeId: string, userId: string) {
    const store = await this.storeRepository.findOne({
      where: { id: storeId, status: 'active' },
    });

    if (!store || store.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para gerir esta loja');
    }

    return store;
  }

  // ---------------------------------------------------------------------------
  // Disponibilidade
  // ---------------------------------------------------------------------------

  async availability(productId: string, startRaw: string, endRaw: string) {
    const product = await this.getRentalProduct(productId);

    const start = new Date(startRaw);
    const end = new Date(endRaw);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Datas inválidas');
    }

    if (end <= start) {
      throw new BadRequestException(
        'Data final deve ser posterior à data inicial',
      );
    }

    const conflicts = await this.countConflicts(product.id, start, end);
    const stock = Math.max(1, Number(product.stock_quantity ?? 1));
    const price = this.computePrice(product, start, end);

    return {
      available: conflicts < stock,
      conflicts,
      ...price,
    };
  }

  // ---------------------------------------------------------------------------
  // Cliente
  // ---------------------------------------------------------------------------

  async create(dto: CreateRentalDto, customerId: string) {
    const product = await this.getRentalProduct(dto.product_id);
    await this.assertStoreActive(product.store_id);

    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Datas inválidas');
    }

    if (end <= start) {
      throw new BadRequestException(
        'Data final deve ser posterior à data inicial',
      );
    }

    const conflicts = await this.countConflicts(product.id, start, end);
    const stock = Math.max(1, Number(product.stock_quantity ?? 1));

    if (conflicts >= stock) {
      throw new ConflictException('Período indisponível');
    }

    const price = this.computePrice(product, start, end);

    const rental = await this.rentalRepository.save(
      this.rentalRepository.create({
        customer_id: customerId,
        store_id: product.store_id,
        product_id: product.id,
        start_date: start,
        end_date: end,
        rental_price: price.rental_price,
        security_deposit: price.security_deposit,
        total_amount: price.total_amount,
        status: 'pending',
        notes: dto.notes ? sanitizeHtml(dto.notes) : null,
      }),
    );

    this.logger.log(
      `Aluguer ${rental.id} criado (cliente ${customerId}, produto ${product.id})`,
    );

    return this.formatRental(rental);
  }

  async findMine(
    customerId: string,
    page = 1,
    limit = 20,
    status?: string,
  ) {
    const where: any = { customer_id: customerId };
    if (status) where.status = status;

    const [data, total] = await this.rentalRepository.findAndCount({
      where,
      relations: ['product', 'store'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: data.map((rental) => this.formatRental(rental)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, userId: string, userType: string) {
    const rental = await this.rentalRepository.findOne({
      where: { id },
      relations: ['product', 'store', 'customer'],
    });

    if (!rental) {
      throw new NotFoundException('Aluguer não encontrado');
    }

    await this.assertCanAccess(rental, userId, userType);

    return this.formatRental(rental);
  }

  async cancel(id: string, userId: string, userType: string) {
    const rental = await this.rentalRepository.findOne({ where: { id } });

    if (!rental) {
      throw new NotFoundException('Aluguer não encontrado');
    }

    await this.assertCanAccess(rental, userId, userType);

    if (userType === 'customer' && rental.status !== 'pending') {
      throw new BadRequestException(
        'Só é possível cancelar alugueres pendentes',
      );
    }

    if (['returned', 'damaged'].includes(rental.status)) {
      throw new BadRequestException(
        'Aluguer já devolvido não pode ser cancelado',
      );
    }

    rental.status = 'cancelled';
    await this.rentalRepository.save(rental);

    return this.formatRental(rental);
  }

  /**
   * Pedido de extensão: recalcula preço e volta a `pending` para o vendedor
   * confirmar com PATCH /rentals/:id/activate.
   */
  async extend(id: string, dto: ExtendRentalDto, userId: string, userType: string) {
    const rental = await this.rentalRepository.findOne({ where: { id } });

    if (!rental) {
      throw new NotFoundException('Aluguer não encontrado');
    }

    await this.assertCanAccess(rental, userId, userType);

    if (!['pending', 'active'].includes(rental.status)) {
      throw new BadRequestException(
        'Só é possível estender alugueres pendentes ou ativos',
      );
    }

    const newEnd = new Date(dto.new_end_date);

    if (isNaN(newEnd.getTime()) || newEnd <= new Date(rental.end_date)) {
      throw new BadRequestException(
        'Nova data final deve ser posterior à data atual do aluguer',
      );
    }

    const product = await this.getRentalProduct(rental.product_id);

    const conflicts = await this.countConflicts(
      rental.product_id,
      new Date(rental.start_date),
      newEnd,
      rental.id,
    );
    const stock = Math.max(1, Number(product.stock_quantity ?? 1));

    if (conflicts >= stock) {
      throw new ConflictException('Período indisponível');
    }

    const price = this.computePrice(product, new Date(rental.start_date), newEnd);

    rental.end_date = newEnd;
    rental.rental_price = price.rental_price;
    rental.total_amount = price.total_amount;
    rental.status = 'pending';

    if (dto.notes) {
      rental.notes = rental.notes
        ? `${rental.notes}\n${sanitizeHtml(dto.notes)}`
        : sanitizeHtml(dto.notes);
    }

    await this.rentalRepository.save(rental);

    return this.formatRental(rental);
  }

  // ---------------------------------------------------------------------------
  // Vendedor
  // ---------------------------------------------------------------------------

  async findByStore(
    storeId: string | undefined,
    userId: string,
    page = 1,
    limit = 20,
    status?: string,
  ) {
    const resolvedStoreId = storeId ?? (await this.resolveStoreId(userId));
    await this.assertStoreOwner(resolvedStoreId, userId);

    const where: any = { store_id: resolvedStoreId };
    if (status) where.status = status;

    const [data, total] = await this.rentalRepository.findAndCount({
      where,
      relations: ['product', 'customer'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: data.map((rental) => this.formatRental(rental)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async calendar(storeId: string | undefined, userId: string, month?: string) {
    const resolvedStoreId = storeId ?? (await this.resolveStoreId(userId));
    await this.assertStoreOwner(resolvedStoreId, userId);
    storeId = resolvedStoreId;

    const reference = month ? new Date(`${month}-01T00:00:00Z`) : new Date();

    if (isNaN(reference.getTime())) {
      throw new BadRequestException('Formato de mês inválido (YYYY-MM)');
    }

    const start = new Date(
      Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1),
    );

    const rentals = await this.rentalRepository
      .createQueryBuilder('rental')
      .leftJoinAndSelect('rental.product', 'product')
      .where('rental.store_id = :storeId', { storeId })
      .andWhere('rental.status IN (:...statuses)', {
        statuses: BLOCKING_STATUSES,
      })
      .andWhere('rental.start_date < :end', { end })
      .andWhere('rental.end_date > :start', { start })
      .orderBy('rental.start_date', 'ASC')
      .getMany();

    return {
      month: `${reference.getUTCFullYear()}-${String(
        reference.getUTCMonth() + 1,
      ).padStart(2, '0')}`,
      data: rentals.map((rental) => this.formatRental(rental)),
    };
  }

  async activate(id: string, userId: string, userType: string) {
    const rental = await this.rentalRepository.findOne({ where: { id } });

    if (!rental) {
      throw new NotFoundException('Aluguer não encontrado');
    }

    if (userType !== 'admin') {
      await this.assertStoreOwner(rental.store_id, userId);
    }

    if (rental.status !== 'pending') {
      throw new BadRequestException('Aluguer não está pendente');
    }

    const product = await this.getRentalProduct(rental.product_id);
    const conflicts = await this.countConflicts(
      rental.product_id,
      new Date(rental.start_date),
      new Date(rental.end_date),
      rental.id,
    );

    if (conflicts >= Math.max(1, Number(product.stock_quantity ?? 1))) {
      throw new BadRequestException('Produto indisponível no período');
    }

    rental.status = 'active';
    await this.rentalRepository.save(rental);

    return this.formatRental(rental);
  }

  async returnRental(
    id: string,
    dto: ReturnRentalDto,
    userId: string,
    userType: string,
  ) {
    const rental = await this.rentalRepository.findOne({ where: { id } });

    if (!rental) {
      throw new NotFoundException('Aluguer não encontrado');
    }

    if (userType !== 'admin') {
      await this.assertStoreOwner(rental.store_id, userId);
    }

    if (!['active', 'overdue'].includes(rental.status)) {
      throw new BadRequestException(
        'Só é possível devolver alugueres ativos ou em atraso',
      );
    }

    rental.status = dto.condition_on_return;

    if (dto.notes) {
      const note = sanitizeHtml(dto.notes);
      rental.notes = rental.notes ? `${rental.notes}\n${note}` : note;
    }

    await this.rentalRepository.save(rental);

    return this.formatRental(rental);
  }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  async findAll(
    page = 1,
    limit = 20,
    filters: { status?: string; store_id?: string; customer_id?: string } = {},
  ) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.store_id) where.store_id = filters.store_id;
    if (filters.customer_id) where.customer_id = filters.customer_id;

    const [data, total] = await this.rentalRepository.findAndCount({
      where,
      relations: ['product', 'store', 'customer'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: data.map((rental) => this.formatRental(rental)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async forceStatus(id: string, dto: ForceRentalStatusDto) {
    const rental = await this.rentalRepository.findOne({ where: { id } });

    if (!rental) {
      throw new NotFoundException('Aluguer não encontrado');
    }

    if (!dto.notes) {
      throw new BadRequestException(
        'Justificação obrigatória para alteração pelo admin',
      );
    }

    rental.status = dto.status;
    const note = `[admin] ${sanitizeHtml(dto.notes)}`;
    rental.notes = rental.notes ? `${rental.notes}\n${note}` : note;

    await this.rentalRepository.save(rental);

    return this.formatRental(rental);
  }

  async summary() {
    const rows = await this.rentalRepository
      .createQueryBuilder('rental')
      .select('rental.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('rental.status')
      .getRawMany();

    const deposits = await this.rentalRepository
      .createQueryBuilder('rental')
      .select('COALESCE(SUM(rental.security_deposit), 0)', 'total')
      .where('rental.status IN (:...statuses)', { statuses: BLOCKING_STATUSES })
      .getRawOne();

    const revenue = await this.rentalRepository
      .createQueryBuilder('rental')
      .select('COALESCE(SUM(rental.rental_price), 0)', 'total')
      .where("rental.status NOT IN ('pending', 'cancelled')")
      .andWhere("date_trunc('month', rental.start_date) = date_trunc('month', now())")
      .getRawOne();

    return {
      by_status: Object.fromEntries(
        rows.map((row) => [row.status, Number(row.count)]),
      ),
      deposits_held: Number(deposits?.total ?? 0),
      revenue_this_month: Number(revenue?.total ?? 0),
    };
  }
}

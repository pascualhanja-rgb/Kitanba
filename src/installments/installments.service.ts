import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';

import { Installment } from './entities/installment.entity.js';
import { Order } from '../orders/entities/order.entity.js';
import { Rental } from '../rentals/entities/rental.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import {
  CancelInstallmentDto,
  CreateInstallmentPlanDto,
  MarkInstallmentPaidDto,
  PayInstallmentDto,
} from './dto/installment.dto.js';

@Injectable()
export class InstallmentsService {
  private readonly logger = new Logger(InstallmentsService.name);

  constructor(
    @InjectRepository(Installment)
    private readonly installmentRepository: Repository<Installment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Rental)
    private readonly rentalRepository: Repository<Rental>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private format(installment: Installment) {
    return {
      ...installment,
      amount: Number(installment.amount ?? 0),
    };
  }

  private async assertStoreOwner(storeId: string, userId: string) {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    if (store.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para esta loja');
    }

    return store;
  }

  private splitAmounts(total: number, count: number): number[] {
    const totalCents = Math.round(total * 100);
    const baseCents = Math.floor(totalCents / count);
    const amounts: number[] = [];

    for (let index = 0; index < count; index++) {
      const cents =
        index === count - 1
          ? totalCents - baseCents * (count - 1)
          : baseCents;
      amounts.push(cents / 100);
    }

    return amounts;
  }

  private addDays(date: Date, days: number): string {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  }

  // ---------------------------------------------------------------------------
  // Vendedor — criar plano
  // ---------------------------------------------------------------------------

  async createPlan(
    dto: CreateInstallmentPlanDto,
    userId: string,
    userType = 'seller',
  ) {
    if ((!dto.order_id && !dto.rental_id) || (dto.order_id && dto.rental_id)) {
      throw new BadRequestException(
        'Informe order_id ou rental_id (não ambos)',
      );
    }

    let customerId: string;
    let storeId: string;
    let total: number;
    let orderId: string | null = null;
    let rentalId: string | null = null;

    if (dto.order_id) {
      const order = await this.orderRepository.findOne({
        where: { id: dto.order_id },
      });

      if (!order) {
        throw new NotFoundException('Pedido não encontrado');
      }

      if (userType !== 'admin') {
        await this.assertStoreOwner(order.store_id, userId);
      }

      const [existing] = await this.installmentRepository.find({
        where: { order_id: order.id },
        take: 1,
      });

      if (existing) {
        throw new BadRequestException(
          'Já existe plano de prestações para este pedido',
        );
      }

      customerId = order.customer_id;
      storeId = order.store_id;
      total = Number(order.total_amount);
      orderId = order.id;
    } else {
      const rental = await this.rentalRepository.findOne({
        where: { id: dto.rental_id as string },
      });

      if (!rental) {
        throw new NotFoundException('Aluguer não encontrado');
      }

      if (userType !== 'admin') {
        await this.assertStoreOwner(rental.store_id, userId);
      }

      const [existing] = await this.installmentRepository.find({
        where: { rental_id: rental.id },
        take: 1,
      });

      if (existing) {
        throw new BadRequestException(
          'Já existe plano de prestações para este aluguer',
        );
      }

      customerId = rental.customer_id;
      storeId = rental.store_id;
      total = Number(rental.total_amount);
      rentalId = rental.id;
    }

    if (dto.total_installments < 1 || dto.total_installments > 12) {
      throw new BadRequestException(
        'Total de parcelas deve estar entre 1 e 12',
      );
    }

    const firstDue = new Date(`${dto.first_due_date}T00:00:00Z`);

    if (isNaN(firstDue.getTime())) {
      throw new BadRequestException('Data de vencimento inválida');
    }

    const intervalDays = dto.interval_days ?? 30;
    const amounts = this.splitAmounts(total, dto.total_installments);

    const installments = await this.installmentRepository.save(
      amounts.map((amount, index) =>
        this.installmentRepository.create({
          order_id: orderId,
          rental_id: rentalId,
          customer_id: customerId,
          store_id: storeId,
          installment_number: index + 1,
          total_installments: dto.total_installments,
          amount,
          due_date: this.addDays(firstDue, intervalDays * index),
          status: 'pending',
        }),
      ),
    );

    this.logger.log(
      `Plano de ${dto.total_installments} parcelas criado (loja ${storeId}, total ${total})`,
    );

    return {
      order_id: orderId,
      rental_id: rentalId,
      total_amount: total,
      installments: installments
        .sort((a, b) => a.installment_number - b.installment_number)
        .map((installment) => this.format(installment)),
    };
  }

  // ---------------------------------------------------------------------------
  // Cliente
  // ---------------------------------------------------------------------------

  async findMine(customerId: string, page = 1, limit = 20, status?: string) {
    const where: any = { customer_id: customerId };
    if (status) where.status = status;

    const [data, total] = await this.installmentRepository.findAndCount({
      where,
      relations: ['store'],
      skip: (page - 1) * limit,
      take: limit,
      order: { due_date: 'ASC' },
    });

    return {
      data: data.map((installment) => this.format(installment)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async summaryMine(customerId: string) {
    const rows = await this.installmentRepository
      .createQueryBuilder('installment')
      .select('installment.status', 'status')
      .addSelect('COALESCE(SUM(installment.amount), 0)', 'amount')
      .where('installment.customer_id = :customerId', { customerId })
      .groupBy('installment.status')
      .getRawMany();

    const totals = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.amount)]),
    );

    const next = await this.installmentRepository.findOne({
      where: { customer_id: customerId, status: 'pending' },
      order: { due_date: 'ASC' },
    });

    return {
      total_pending: totals['pending'] ?? 0,
      total_overdue: totals['overdue'] ?? 0,
      total_paid: totals['paid'] ?? 0,
      next_due_date: next?.due_date ?? null,
    };
  }

  async findOne(id: string, userId: string, userType: string) {
    const installment = await this.installmentRepository.findOne({
      where: { id },
      relations: ['store', 'customer'],
    });

    if (!installment) {
      throw new NotFoundException('Parcela não encontrada');
    }

    if (userType === 'admin') return this.format(installment);

    if (installment.customer_id === userId) {
      return this.format(installment);
    }

    if (userType === 'seller') {
      const store = await this.storeRepository.findOne({
        where: { id: installment.store_id },
      });

      if (store?.owner_id === userId) {
        return this.format(installment);
      }
    }

    throw new ForbiddenException('Sem permissão para ver esta parcela');
  }

  async pay(id: string, dto: PayInstallmentDto, customerId: string) {
    const installment = await this.installmentRepository.findOne({
      where: { id },
    });

    if (!installment) {
      throw new NotFoundException('Parcela não encontrada');
    }

    if (installment.customer_id !== customerId) {
      throw new ForbiddenException('Sem permissão para esta parcela');
    }

    if (['paid', 'cancelled'].includes(installment.status)) {
      throw new BadRequestException('Parcela já paga ou cancelada');
    }

    if (
      ['transferencia', 'multicaixa'].includes(dto.payment_method) &&
      !dto.payment_proof_url
    ) {
      throw new BadRequestException(
        'Comprovativo obrigatório para este método',
      );
    }

    installment.payment_method = dto.payment_method;
    installment.payment_proof_url = dto.payment_proof_url ?? null;

    await this.installmentRepository.save(installment);

    return {
      ...this.format(installment),
      message:
        'Comprovativo submetido. Aguarda confirmação do vendedor.',
    };
  }

  // ---------------------------------------------------------------------------
  // Vendedor
  // ---------------------------------------------------------------------------

  async findByStore(
    storeId: string | undefined,
    userId: string,
    page = 1,
    limit = 20,
    filters: { status?: string; due_from?: string; due_to?: string } = {},
  ) {
    const resolvedStoreId = storeId ?? (await this.resolveStoreId(userId));
    await this.assertStoreOwner(resolvedStoreId, userId);

    const query = this.installmentRepository
      .createQueryBuilder('installment')
      .where('installment.store_id = :storeId', { storeId: resolvedStoreId })
      .orderBy('installment.due_date', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) {
      query.andWhere('installment.status = :status', {
        status: filters.status,
      });
    }
    if (filters.due_from) {
      query.andWhere('installment.due_date >= :dueFrom', {
        dueFrom: filters.due_from,
      });
    }
    if (filters.due_to) {
      query.andWhere('installment.due_date <= :dueTo', {
        dueTo: filters.due_to,
      });
    }

    const [data, total] = await query.getManyAndCount();

    return {
      data: data.map((installment) => this.format(installment)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async storeSummary(storeId: string | undefined, userId: string) {
    const resolvedStoreId = storeId ?? (await this.resolveStoreId(userId));
    await this.assertStoreOwner(resolvedStoreId, userId);
    return this.summaryByStore(resolvedStoreId);
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

  private async summaryByStore(storeId: string) {
    const rows = await this.installmentRepository
      .createQueryBuilder('installment')
      .select('installment.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(installment.amount), 0)', 'amount')
      .where('installment.store_id = :storeId', { storeId })
      .groupBy('installment.status')
      .getRawMany();

    const counts = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.count)]),
    );
    const totals = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.amount)]),
    );

    return {
      pending: counts['pending'] ?? 0,
      overdue: counts['overdue'] ?? 0,
      paid: counts['paid'] ?? 0,
      cancelled: counts['cancelled'] ?? 0,
      total_pending_amount: totals['pending'] ?? 0,
      total_overdue_amount: totals['overdue'] ?? 0,
    };
  }

  async markPaid(
    id: string,
    dto: MarkInstallmentPaidDto,
    userId: string,
    userType: string,
  ) {
    const installment = await this.installmentRepository.findOne({
      where: { id },
    });

    if (!installment) {
      throw new NotFoundException('Parcela não encontrada');
    }

    if (userType !== 'admin') {
      await this.assertStoreOwner(installment.store_id, userId);
    }

    if (installment.status === 'paid') {
      throw new BadRequestException('Parcela já paga');
    }

    if (installment.status === 'cancelled') {
      throw new BadRequestException('Parcela cancelada');
    }

    const method = dto.payment_method ?? installment.payment_method;

    if (
      method &&
      ['transferencia', 'multicaixa'].includes(method) &&
      !installment.payment_proof_url
    ) {
      throw new BadRequestException('Comprovativo em falta');
    }

    installment.status = 'paid';
    installment.paid_at = dto.paid_at ? new Date(dto.paid_at) : new Date();
    installment.payment_method = method ?? null;

    await this.installmentRepository.save(installment);

    return this.format(installment);
  }

  async cancel(
    id: string,
    dto: CancelInstallmentDto,
    userId: string,
    userType: string,
  ) {
    const installment = await this.installmentRepository.findOne({
      where: { id },
    });

    if (!installment) {
      throw new NotFoundException('Parcela não encontrada');
    }

    if (userType !== 'admin') {
      await this.assertStoreOwner(installment.store_id, userId);
    }

    if (installment.status === 'paid') {
      throw new BadRequestException('Parcela já paga');
    }

    installment.status = 'cancelled';
    await this.installmentRepository.save(installment);

    if (dto.reason) {
      this.logger.log(`Parcela ${id} cancelada: ${dto.reason}`);
    }

    return this.format(installment);
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
      due_from?: string;
      due_to?: string;
    } = {},
  ) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.store_id) where.store_id = filters.store_id;
    if (filters.customer_id) where.customer_id = filters.customer_id;

    const query = this.installmentRepository
      .createQueryBuilder('installment')
      .leftJoinAndSelect('installment.store', 'store')
      .leftJoinAndSelect('installment.customer', 'customer')
      .orderBy('installment.due_date', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) {
      query.andWhere('installment.status = :status', {
        status: filters.status,
      });
    }
    if (filters.store_id) {
      query.andWhere('installment.store_id = :storeId', {
        storeId: filters.store_id,
      });
    }
    if (filters.customer_id) {
      query.andWhere('installment.customer_id = :customerId', {
        customerId: filters.customer_id,
      });
    }
    if (filters.due_from) {
      query.andWhere('installment.due_date >= :dueFrom', {
        dueFrom: filters.due_from,
      });
    }
    if (filters.due_to) {
      query.andWhere('installment.due_date <= :dueTo', {
        dueTo: filters.due_to,
      });
    }

    const [data, total] = await query.getManyAndCount();

    return {
      data: data.map((installment) => this.format(installment)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async summary() {
    const rows = await this.installmentRepository
      .createQueryBuilder('installment')
      .select('installment.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(installment.amount), 0)', 'amount')
      .groupBy('installment.status')
      .getRawMany();

    const counts = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.count)]),
    );
    const totals = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.amount)]),
    );

    return {
      pending: counts['pending'] ?? 0,
      overdue: counts['overdue'] ?? 0,
      paid: counts['paid'] ?? 0,
      total_pending_amount: totals['pending'] ?? 0,
      total_overdue_amount: totals['overdue'] ?? 0,
    };
  }

  async overdueReport(minDaysOverdue = 1, groupBy: 'store' | 'customer' = 'store') {
    if (groupBy === 'customer') {
      const rows = await this.installmentRepository
        .createQueryBuilder('installment')
        .leftJoin('installment.customer', 'customer')
        .select('installment.customer_id', 'customer_id')
        .addSelect('customer.name', 'customer_name')
        .addSelect('COUNT(*)::int', 'overdue_count')
        .addSelect('COALESCE(SUM(installment.amount), 0)', 'overdue_amount')
        .addSelect(
          'COALESCE(MAX(CURRENT_DATE - installment.due_date), 0)::int',
          'max_days_overdue',
        )
        .where("installment.status IN ('pending', 'overdue')")
        .andWhere('installment.due_date <= CURRENT_DATE - :minDays', {
          minDays: minDaysOverdue,
        })
        .groupBy('installment.customer_id')
        .addGroupBy('customer.name')
        .getRawMany();

      return {
        generated_at: new Date().toISOString(),
        total_overdue: rows.reduce(
          (sum, row) => sum + Number(row.overdue_count),
          0,
        ),
        total_amount: rows.reduce(
          (sum, row) => sum + Number(row.overdue_amount),
          0,
        ),
        groups: rows.map((row) => ({
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          overdue_count: Number(row.overdue_count),
          overdue_amount: Number(row.overdue_amount),
          max_days_overdue: Number(row.max_days_overdue),
        })),
      };
    }

    const rows = await this.installmentRepository
      .createQueryBuilder('installment')
      .leftJoin('installment.store', 'store')
      .select('installment.store_id', 'store_id')
      .addSelect('store.name', 'store_name')
      .addSelect('COUNT(*)::int', 'overdue_count')
      .addSelect('COALESCE(SUM(installment.amount), 0)', 'overdue_amount')
      .addSelect(
        'COALESCE(MAX(CURRENT_DATE - installment.due_date), 0)::int',
        'max_days_overdue',
      )
      .where("installment.status IN ('pending', 'overdue')")
      .andWhere('installment.due_date <= CURRENT_DATE - :minDays', {
        minDays: minDaysOverdue,
      })
      .groupBy('installment.store_id')
      .addGroupBy('store.name')
      .getRawMany();

    return {
      generated_at: new Date().toISOString(),
      total_overdue: rows.reduce(
        (sum, row) => sum + Number(row.overdue_count),
        0,
      ),
      total_amount: rows.reduce(
        (sum, row) => sum + Number(row.overdue_amount),
        0,
      ),
      groups: rows.map((row) => ({
        store_id: row.store_id,
        store_name: row.store_name,
        overdue_count: Number(row.overdue_count),
        overdue_amount: Number(row.overdue_amount),
        max_days_overdue: Number(row.max_days_overdue),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Job diário
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async markOverdue() {
    const result = await this.installmentRepository
      .createQueryBuilder()
      .update(Installment)
      .set({ status: 'overdue' })
      .where("status = 'pending'")
      .andWhere('due_date < CURRENT_DATE')
      .execute();

    const rentalsUpdated = await this.rentalRepository
      .createQueryBuilder()
      .update(Rental)
      .set({ status: 'overdue' })
      .where("status = 'active'")
      .andWhere('end_date < now()')
      .execute();

    if ((result.affected ?? 0) > 0 || (rentalsUpdated.affected ?? 0) > 0) {
      this.logger.log(
        `Job de vencimentos: ${result.affected ?? 0} parcelas e ${rentalsUpdated.affected ?? 0} alugueres em atraso`,
      );
    }
  }
}

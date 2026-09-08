import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Store } from '../stores/entities/store.entity.js';
import { StoreSubscriptionPayment } from '../subscriptions/entities/store-subscription-payment.entity.js';
import { SellerPlan } from '../plans/entities/seller-plan.entity.js';
import { Advertisement } from '../advertisements/entities/advertisement.entity.js';
import { AdPayment } from '../advertisements/entities/ad-payment.entity.js';
import { User } from '../users/entities/user.entity.js';

/**
 * Métricas executivas para o painel administrativo.
 *
 * NOTA SOBRE AS FÓRMULAS (ajustáveis ao modelo de negócio):
 * - MRR (receita mensal recorrente) = soma dos pagamentos APROVADOS do mês
 *   corrente (COALESCE(paid_at, created_at) dentro do mês). ARR = MRR * 12.
 * - Churn mensal = lojas ativas cuja assinatura já expirou
 *   (subscription_end_date <= agora) / (ativas válidas + expiradas) * 100.
 * - Retenção = 100 - churn.
 * - LTV = ARPU / churn mensal (em meses); ARPU = receita do mês / assinaturas
 *   válidas. Quando ainda não há churn, LTV é null (dados insuficientes).
 * - CAC = null: não existe registo de custos de aquisição na plataforma.
 */
@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(StoreSubscriptionPayment)
    private readonly paymentRepository: Repository<StoreSubscriptionPayment>,
    @InjectRepository(Advertisement)
    private readonly advertisementRepository: Repository<Advertisement>,
    @InjectRepository(AdPayment)
    private readonly adPaymentRepository: Repository<AdPayment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** Resumo executivo completo — GET /admin/metrics */
  async summary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = monthStart;

    const [
      storeStatusCounts,
      monthRevenueRow,
      prevMonthRevenueRow,
      totalRevenueRow,
      revenueByPlan,
      revenueByStore,
      monthlySeries,
      adsStatusCounts,
      adRevenueRow,
      adsCreatedCounts,
      paymentStats,
      customerCount,
      sellerCount,
      pendingAmount,
    ] = await Promise.all([
      // Lojas por estado
      this.storeRepository
        .createQueryBuilder('s')
        .select('s.status', 'status')
        .addSelect('COUNT(*)', 'cnt')
        .groupBy('s.status')
        .getRawMany<{ status: string; cnt: string }>(),
      // Receita aprovada no mês corrente
      this.sumApprovedBetween(monthStart, now),
      // Receita aprovada no mês anterior
      this.sumApprovedBetween(prevMonthStart, prevMonthEnd),
      // Receita total aprovada (histórico)
      this.sumApprovedAllTime(),
      // Receita por plano (aprovados)
      this.paymentRepository
        .createQueryBuilder('p')
        .innerJoin(SellerPlan, 'sp', 'sp.id = p.plan_id')
        .select('sp.name', 'plan_name')
        .addSelect('SUM(p.amount::float)', 'revenue')
        .where("p.status = 'approved'")
        .groupBy('sp.name')
        .orderBy('revenue', 'DESC')
        .getRawMany<{ plan_name: string; revenue: string }>(),
      // Receita por loja (top 10)
      this.paymentRepository
        .createQueryBuilder('p')
        .innerJoin(Store, 's', 's.id = p.store_id')
        .select('s.id', 'store_id')
        .addSelect('s.name', 'store_name')
        .addSelect('SUM(p.amount::float)', 'revenue')
        .where("p.status = 'approved'")
        .groupBy('s.id')
        .addGroupBy('s.name')
        .orderBy('revenue', 'DESC')
        .limit(10)
        .getRawMany<{ store_id: string; store_name: string; revenue: string }>(),
      // Série mensal (12 meses) de receita aprovada
      this.paymentRepository
        .createQueryBuilder('p')
        .select(
          "to_char(date_trunc('month', COALESCE(p.paid_at, p.created_at)), 'YYYY-MM')",
          'month',
        )
        .addSelect('SUM(p.amount::float)', 'revenue')
        .addSelect('COUNT(*)', 'cnt')
        .where("p.status = 'approved'")
        .andWhere('COALESCE(p.paid_at, p.created_at) >= :since', {
          since: new Date(now.getFullYear(), now.getMonth() - 11, 1),
        })
        .groupBy('month')
        .orderBy('month', 'ASC')
        .getRawMany<{ month: string; revenue: string; cnt: string }>(),
      // Anúncios por estado
      this.advertisementRepository
        .createQueryBuilder('a')
        .select('a.status', 'status')
        .addSelect('COUNT(*)', 'cnt')
        .groupBy('a.status')
        .getRawMany<{ status: string; cnt: string }>(),
      // Receita de publicidade (pagamentos aprovados)
      this.adPaymentRepository
        .createQueryBuilder('adp')
        .select('SUM(adp.amount::float)', 'revenue')
        .where("adp.status = 'approved'")
        .getRawOne<{ revenue: string | null }>(),
      // Anúncios criados: mês corrente vs anterior (crescimento)
      this.advertisementCountsBetween(now),
      // Pagamentos aprovados/falhados do mês (crescimento + taxas)
      this.paymentMonthStats(now),
      // Clientes registados
      this.userRepository.count({ where: { user_type: 'customer' } }),
      // Vendedores distintos (donos de lojas)
      this.storeRepository
        .createQueryBuilder('s')
        .select('COUNT(DISTINCT s.owner_id)', 'cnt')
        .getRawOne<{ cnt: string }>(),
      // Valor total de pagamentos pendentes
      this.paymentRepository
        .createQueryBuilder('p')
        .select('SUM(p.amount::float)', 'total')
        .where("p.status = 'pending'")
        .getRawOne<{ total: string | null }>(),
    ]);

    // ---------------- LOJAS ----------------
    const statuses = (storeStatusCounts ?? []).reduce(
      (acc: Record<string, number>, row) => {
        acc[row.status] = Number(row.cnt) || 0;
        return acc;
      },
      {},
    );
    const totalStores = Object.values(statuses).reduce(
      (sum, value) => sum + value,
      0,
    );
    const activeStores = statuses['active'] ?? 0;
    const pendingStores = statuses['pending_approval'] ?? 0;
    const suspendedStores = statuses['suspended'] ?? 0;
    const rejectedStores = statuses['rejected'] ?? 0;

    // ---------------- ASSINATURAS (churn) ----------------
    const { validSubscriptions, lapsedSubscriptions } =
      await this.subscriptionHealth(now);

    // ---------------- FINANCEIRO ----------------
    const monthRevenue = this.toNumber(monthRevenueRow?.revenue);
    const prevMonthRevenue = this.toNumber(prevMonthRevenueRow?.revenue);
    const totalRevenue = this.toNumber(totalRevenueRow?.revenue);
    const mrr = monthRevenue;
    const arr = mrr * 12;
    const pendingAmountTotal = this.toNumber(pendingAmount?.total);
    const revenueGrowthPct = this.growthPct(monthRevenue, prevMonthRevenue);
    const avgTicket =
      (paymentStats.monthApproved ?? 0) > 0
        ? monthRevenue / (paymentStats.monthApproved ?? 1)
        : 0;

    const arpu = validSubscriptions > 0 ? monthRevenue / validSubscriptions : 0;
    const churnRate =
      validSubscriptions + lapsedSubscriptions > 0
        ? (lapsedSubscriptions / (validSubscriptions + lapsedSubscriptions)) *
          100
        : 0;
    const retentionRate = Math.max(0, 100 - churnRate);
    const ltv = churnRate > 0 ? arpu * (100 / churnRate) : null;

    // ---------------- CRESCIMENTO ----------------
    const storeGrowth = await this.storeCreationGrowth(now);
    const subscriptionsGrowth = this.growthPct(
      paymentStats.monthApproved,
      paymentStats.prevMonthApproved,
    );
    const advertisingGrowth = this.growthPct(
      adsCreatedCounts?.current ?? 0,
      adsCreatedCounts?.previous ?? 0,
    );

    // ---------------- PUBLICIDADE ----------------
    const adStatuses = (adsStatusCounts ?? []).reduce(
      (acc: Record<string, number>, row) => {
        acc[row.status] = Number(row.cnt) || 0;
        return acc;
      },
      {},
    );
    const activeCampaigns = adStatuses['active'] ?? 0;
    const pendingCampaigns = adStatuses['pending_approval'] ?? 0;
    const rejectedCampaigns = adStatuses['rejected'] ?? 0;
    const advertisingRevenue = this.toNumber(adRevenueRow?.revenue);
    const avgPerCampaign =
      activeCampaigns > 0 ? advertisingRevenue / activeCampaigns : 0;

    // ---------------- SÉRIE MENSAL (12 meses completos) ----------------
    const monthlyMap = new Map<string, { revenue: number; count: number }>();
    for (const row of monthlySeries ?? []) {
      monthlyMap.set(row.month, {
        revenue: this.toNumber(row.revenue),
        count: Number(row.cnt) || 0,
      });
    }
    const monthlyRevenue: Array<{
      month: string;
      revenue: number;
      count: number;
    }> = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = this.monthKey(date);
      const entry = monthlyMap.get(key) ?? { revenue: 0, count: 0 };
      monthlyRevenue.push({ month: key, ...entry });
    }

    return {
      generated_at: now.toISOString(),
      finance: {
        total_revenue: this.round2(totalRevenue),
        revenue_month: this.round2(monthRevenue),
        revenue_prev_month: this.round2(prevMonthRevenue),
        revenue_growth_pct: this.round2(revenueGrowthPct),
        mrr: this.round2(mrr),
        arr: this.round2(arr),
        pending_amount: this.round2(pendingAmountTotal),
        avg_ticket: this.round2(avgTicket),
        approval_rate: this.round2(paymentStats.approvalRate),
        cancellation_rate: this.round2(paymentStats.cancellationRate),
      },
      business: {
        total_stores: totalStores,
        active_stores: activeStores,
        pending_stores: pendingStores,
        suspended_stores: suspendedStores,
        rejected_stores: rejectedStores,
        active_subscriptions: validSubscriptions,
        total_customers: customerCount,
        sellers: Number(sellerCount?.cnt) || 0,
        churn_rate: this.round2(churnRate),
        retention_rate: this.round2(retentionRate),
        ltv: ltv != null ? this.round2(ltv) : null,
        cac: null,
      },
      growth: {
        stores_pct: this.round2(storeGrowth),
        subscriptions_pct: this.round2(subscriptionsGrowth),
        advertising_pct: this.round2(advertisingGrowth),
      },
      advertising: {
        revenue: this.round2(advertisingRevenue),
        active_campaigns: activeCampaigns,
        pending_campaigns: pendingCampaigns,
        rejected_campaigns: rejectedCampaigns,
        avg_per_campaign: this.round2(avgPerCampaign),
      },
      revenue_by_plan: (revenueByPlan ?? []).map((row) => ({
        plan_name: row.plan_name,
        revenue: this.round2(this.toNumber(row.revenue)),
      })),
      revenue_by_store: (revenueByStore ?? []).map((row) => ({
        store_id: row.store_id,
        store_name: row.store_name,
        revenue: this.round2(this.toNumber(row.revenue)),
      })),
      monthly_revenue: monthlyRevenue.map((row) => ({
        month: row.month,
        revenue: this.round2(row.revenue),
        count: row.count,
      })),
    };
  }

  // ---------------------------------------------------------------------
  // Helpers de agregação
  // ---------------------------------------------------------------------

  private sumApprovedBetween(start: Date, end: Date) {
    return this.paymentRepository
      .createQueryBuilder('p')
      .select('SUM(p.amount::float)', 'revenue')
      .addSelect('COUNT(*)', 'cnt')
      .where("p.status = 'approved'")
      .andWhere('COALESCE(p.paid_at, p.created_at) >= :start', { start })
      .andWhere('COALESCE(p.paid_at, p.created_at) < :end', { end })
      .getRawOne<{ revenue: string | null; cnt: string | null }>();
  }

  private sumApprovedAllTime() {
    return this.paymentRepository
      .createQueryBuilder('p')
      .select('SUM(p.amount::float)', 'revenue')
      .addSelect('COUNT(*)', 'cnt')
      .where("p.status = 'approved'")
      .getRawOne<{ revenue: string | null; cnt: string | null }>();
  }

  /** Pagamentos aprovados/falhados do mês atual e anterior + taxas. */
  private paymentMonthStats(now: Date) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const countStatusBetween = (
      status: string,
      start: Date,
      end: Date,
    ) =>
      this.paymentRepository
        .createQueryBuilder('p')
        .select('COUNT(*)', 'cnt')
        .where('p.status = :status', { status })
        .andWhere('COALESCE(p.paid_at, p.created_at) >= :start', { start })
        .andWhere('COALESCE(p.paid_at, p.created_at) < :end', { end })
        .getRawOne<{ cnt: string }>();

    return Promise.all([
      countStatusBetween('approved', monthStart, now),
      countStatusBetween('approved', prevMonthStart, monthStart),
      countStatusBetween('failed', monthStart, now),
    ]).then(([monthApproved, prevMonthApproved, monthFailed]) => {
      const approved = Number(monthApproved?.cnt) || 0;
      const prev = Number(prevMonthApproved?.cnt) || 0;
      const failed = Number(monthFailed?.cnt) || 0;
      const denominator = approved + failed;
      return {
        monthApproved: approved,
        prevMonthApproved: prev,
        approvalRate: denominator > 0 ? (approved / denominator) * 100 : 0,
        cancellationRate: denominator > 0 ? (failed / denominator) * 100 : 0,
      };
    });
  }

  /** Anúncios criados no mês atual e no anterior. */
  private async advertisementCountsBetween(now: Date) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const countCreated = (start: Date, end: Date) =>
      this.advertisementRepository
        .createQueryBuilder('a')
        .select('COUNT(*)', 'cnt')
        .where('a.created_at >= :start', { start })
        .andWhere('a.created_at < :end', { end })
        .getRawOne<{ cnt: string }>();

    const [current, previous] = await Promise.all([
      countCreated(monthStart, now),
      countCreated(prevMonthStart, monthStart),
    ]);
    return {
      current: Number(current?.cnt) || 0,
      previous: Number(previous?.cnt) || 0,
    };
  }

  /** Lojas ativas válidas vs com assinatura expirada (base do churn). */
  private async subscriptionHealth(now: Date) {
    const rows = await this.storeRepository
      .createQueryBuilder('s')
      .select(
        'COUNT(*) FILTER (WHERE s.status = :active AND (s.subscription_end_date IS NULL OR s.subscription_end_date > :now))',
        'valid',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE s.status = :active AND s.subscription_end_date IS NOT NULL AND s.subscription_end_date <= :now)',
        'lapsed',
      )
      .setParameters({ active: 'active', now })
      .getRawOne<{ valid: string; lapsed: string }>();

    return {
      validSubscriptions: Number(rows?.valid) || 0,
      lapsedSubscriptions: Number(rows?.lapsed) || 0,
    };
  }

  /** Crescimento de lojas criadas: mês corrente vs anterior. */
  private async storeCreationGrowth(now: Date) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const countCreated = (start: Date, end: Date) =>
      this.storeRepository
        .createQueryBuilder('s')
        .select('COUNT(*)', 'cnt')
        .where('s.created_at >= :start', { start })
        .andWhere('s.created_at < :end', { end })
        .getRawOne<{ cnt: string }>();

    const [current, previous] = await Promise.all([
      countCreated(monthStart, now),
      countCreated(prevMonthStart, monthStart),
    ]);
    return this.growthPct(
      Number(current?.cnt) || 0,
      Number(previous?.cnt) || 0,
    );
  }

  /** Crescimento percentual entre dois valores (mês atual vs anterior). */
  private growthPct(current: number, previous: number): number {
    if (previous > 0) {
      return ((current - previous) / previous) * 100;
    }
    return current > 0 ? 100 : 0;
  }

  private monthKey(date: Date): string {
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${date.getFullYear()}-${mm}`;
  }

  private toNumber(value?: string | number | null): number {
    const numberValue =
      typeof value === 'string' ? Number(value) : Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

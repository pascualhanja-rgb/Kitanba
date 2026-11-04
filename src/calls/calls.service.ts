import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
import * as crypto from 'crypto';

import { CallLog } from './entities/call-log.entity.js';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { Order } from '../orders/entities/order.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { User } from '../users/entities/user.entity.js';
import { RealtimeService } from '../deliveries/realtime/realtime.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { InitiateCallDto, UpdateCallStatusDto } from './dto/call.dto.js';

/**
 * Entrega considerada ativa para permitir chamadas.
 * O sistema da fase 2 usa `picking_up`/`in_transit`; `out_for_delivery`
 * é aceito para manter compatibilidade com o contrato da fase 3.
 */
const ACTIVE_DELIVERY_STATUSES = [
  'out_for_delivery',
  'picking_up',
  'in_transit',
];

const OPEN_CALL_STATUSES = ['initiated', 'ringing', 'answered'];
const CALL_ATTEMPT_WINDOW_MINUTES = 10;
const MAX_ATTEMPTS_PER_WINDOW = 3;

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    @InjectRepository(CallLog)
    private readonly callRepository: Repository<CallLog>,
    @InjectRepository(Delivery)
    private readonly deliveryRepository: Repository<Delivery>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly realtimeService: RealtimeService,
    private readonly redisService: RedisService,
  ) {}

  private format(call: CallLog) {
    return {
      ...call,
      duration_seconds: Number(call.duration_seconds ?? 0),
    };
  }

  private async recordBlocked(reason: string, user: any, deliveryId?: string) {
    await this.redisService.incr(`calls:blocked:${reason}`);
    this.logger.warn(
      `Chamada bloqueada (${reason}) por ${user?.id ?? 'anónimo'} ` +
        `(tipo: ${user?.user_type ?? '?'}, entrega: ${deliveryId ?? '-'})`,
    );
  }

  private async isStoreOwner(storeId: string, userId: string) {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
    });
    return store?.owner_id === userId;
  }

  /**
   * Resolve a entrega e valida todas as regras de segurança da chamada.
   * Lança 403/409/429 quando a chamada não é permitida.
   */
  private async validateCallContext(
    dto: InitiateCallDto,
    user: any,
  ): Promise<{ call: { delivery: Delivery; receiverId: string } }> {
    if (user.user_type !== 'seller' && user.user_type !== 'customer') {
      await this.recordBlocked('role_not_allowed', user, dto.delivery_id);
      throw new ForbiddenException(
        'Apenas o vendedor ou o estafeta podem iniciar chamadas.',
      );
    }

    const delivery = await this.deliveryRepository.findOne({
      where: { id: dto.delivery_id },
      relations: ['order'],
    });

    if (!delivery) {
      await this.recordBlocked('no_active_delivery', user, dto.delivery_id);
      throw new ForbiddenException(
        'É necessário um pedido ou entrega em andamento para iniciar a chamada.',
      );
    }

    const isCourier = delivery.courier_id === user.id;
    const isSellerOwner = await this.isStoreOwner(delivery.store_id, user.id);

    // Regra crítica: cliente comum nunca inicia; só o estafeta atribuído
    if (user.user_type === 'customer' && !isCourier) {
      await this.recordBlocked('customer_initiated', user, delivery.id);
      throw new ForbiddenException(
        'Apenas o vendedor ou o estafeta podem iniciar chamadas.',
      );
    }

    if (user.user_type === 'seller' && !isSellerOwner) {
      await this.recordBlocked('not_store_owner', user, delivery.id);
      throw new ForbiddenException(
        'Sem permissão para ligar nesta entrega.',
      );
    }

    if (!ACTIVE_DELIVERY_STATUSES.includes(delivery.status)) {
      await this.recordBlocked('no_active_delivery', user, delivery.id);
      throw new ForbiddenException(
        'Só é possível ligar durante uma entrega ativa (out_for_delivery).',
      );
    }

    const receiverId = delivery.customer_id;

    if (receiverId === user.id) {
      await this.recordBlocked('self_call', user, delivery.id);
      throw new BadRequestException('Não é possível ligar para si próprio');
    }

    const receiver = await this.userRepository.findOne({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new NotFoundException('Cliente da entrega não encontrado');
    }

    const openCall = await this.callRepository.findOne({
      where: {
        delivery_id: delivery.id,
        status: In(OPEN_CALL_STATUSES),
      },
    });

    if (openCall) {
      await this.recordBlocked('duplicate_call', user, delivery.id);
      throw new ConflictException(
        'Já existe uma chamada ativa para esta entrega.',
      );
    }

    const windowStart = new Date(
      Date.now() - CALL_ATTEMPT_WINDOW_MINUTES * 60 * 1000,
    );

    const attempts = await this.callRepository
      .createQueryBuilder('call')
      .where('call.delivery_id = :deliveryId', { deliveryId: delivery.id })
      .andWhere('call.caller_id = :callerId', { callerId: user.id })
      .andWhere('call.created_at >= :windowStart', { windowStart })
      .getCount();

    if (attempts >= MAX_ATTEMPTS_PER_WINDOW) {
      await this.recordBlocked('rate_limited', user, delivery.id);
      throw new HttpException(
        'Limite de tentativas de chamada atingido.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Pedido indicado (se existir) tem de pertencer à entrega
    if (dto.order_id && delivery.order_id && dto.order_id !== delivery.order_id) {
      throw new BadRequestException(
        'Pedido não corresponde à entrega indicada',
      );
    }

    return { call: { delivery, receiverId } };
  }

  /**
   * Iniciar chamada (apenas vendedor ou estafeta, com entrega ativa)
   */
  async initiate(dto: InitiateCallDto, user: any) {
    const { call } = await this.validateCallContext(dto, user);

    const saved = await this.callRepository.save(
      this.callRepository.create({
        caller_id: user.id,
        receiver_id: call.receiverId,
        order_id: dto.order_id ?? call.delivery.order_id ?? null,
        delivery_id: call.delivery.id,
        status: 'initiated',
      }),
    );

    this.realtimeService.emitCallRinging(call.receiverId, {
      call_id: saved.id,
      caller_id: user.id,
      caller_type: user.user_type,
      order_id: saved.order_id,
      delivery_id: saved.delivery_id,
      created_at: saved.created_at,
    });

    this.logger.log(
      `Chamada ${saved.id} iniciada por ${user.id} para ${call.receiverId}`,
    );

    return this.format(saved);
  }

  /**
   * Verificação silenciosa para o botão "Ligar" do app
   */
  async eligibility(deliveryId: string, user: any) {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['customer'],
    });

    if (!delivery) {
      return {
        can_call: false,
        delivery_status: null,
        active_call_id: null,
        reason:
          'É necessário um pedido ou entrega em andamento para iniciar a chamada.',
      };
    }

    const isCourier = delivery.courier_id === user.id;
    const isSellerOwner =
      user.user_type === 'seller'
        ? await this.isStoreOwner(delivery.store_id, user.id)
        : false;

    const base = {
      delivery_id: delivery.id,
      delivery_status: delivery.status,
      receiver: delivery.customer
        ? { id: (delivery.customer as any).id, name: (delivery.customer as any).name }
        : null,
    };

    if (user.user_type === 'customer' && !isCourier) {
      return {
        ...base,
        can_call: false,
        active_call_id: null,
        reason: 'Apenas o vendedor ou o estafeta podem iniciar chamadas.',
      };
    }

    if (user.user_type === 'seller' && !isSellerOwner) {
      return {
        ...base,
        can_call: false,
        active_call_id: null,
        reason: 'Sem permissão para ligar nesta entrega.',
      };
    }

    if (!ACTIVE_DELIVERY_STATUSES.includes(delivery.status)) {
      return {
        ...base,
        can_call: false,
        active_call_id: null,
        reason:
          'Só é possível ligar durante uma entrega ativa (out_for_delivery).',
      };
    }

    const openCall = await this.callRepository.findOne({
      where: {
        delivery_id: delivery.id,
        status: In(OPEN_CALL_STATUSES),
      },
    });

    if (openCall) {
      return {
        ...base,
        can_call: false,
        active_call_id: openCall.id,
        reason: 'Já existe uma chamada ativa para esta entrega.',
      };
    }

    return {
      ...base,
      can_call: true,
      active_call_id: null,
      reason: null,
    };
  }

  async updateStatus(id: string, dto: UpdateCallStatusDto, user: any) {
    const call = await this.callRepository.findOne({ where: { id } });

    if (!call) {
      throw new NotFoundException('Chamada não encontrada');
    }

    const isParticipant =
      call.caller_id === user.id || call.receiver_id === user.id;

    if (!isParticipant && user.user_type !== 'admin') {
      throw new ForbiddenException('Sem permissão para esta chamada');
    }

    const now = new Date();
    const allowedFrom: Record<string, string[]> = {
      ringing: ['initiated'],
      answered: ['initiated', 'ringing'],
      rejected: ['initiated', 'ringing'],
      missed: ['initiated', 'ringing'],
      ended: ['ringing', 'answered'],
    };

    if (!allowedFrom[dto.status]?.includes(call.status)) {
      throw new BadRequestException('Transição de estado inválida');
    }

    call.status = dto.status;

    if (dto.status === 'answered') {
      call.started_at = now;
    }

    if (['rejected', 'missed', 'ended'].includes(dto.status)) {
      call.ended_at = now;

      if (call.started_at) {
        call.duration_seconds = Math.max(
          0,
          Math.round((now.getTime() - new Date(call.started_at).getTime()) / 1000),
        );
      }
    }

    const saved = await this.callRepository.save(call);

    const event = `call:${dto.status === 'ended' ? 'ended' : dto.status}`;
    const payload = {
      call_id: saved.id,
      status: saved.status,
      duration_seconds: saved.duration_seconds,
    };

    this.realtimeService.emitCallStatus(saved.caller_id, event, payload);
    this.realtimeService.emitCallStatus(saved.receiver_id, event, payload);

    return this.format(saved);
  }

  async findMine(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.callRepository.findAndCount({
      where: [{ caller_id: userId }, { receiver_id: userId }],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: data.map((call) => this.format(call)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByStore(userId: string, page = 1, limit = 20) {
    const [data, total] = await this.callRepository
      .createQueryBuilder('call')
      .innerJoin(Delivery, 'delivery', 'delivery.id = call.delivery_id')
      .innerJoin(Store, 'store', 'store.id = delivery.store_id')
      .where('store.owner_id = :userId', { userId })
      .orderBy('call.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: data.map((call) => this.format(call)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: any) {
    const call = await this.callRepository.findOne({
      where: { id },
      relations: ['caller', 'receiver'],
    });

    if (!call) {
      throw new NotFoundException('Chamada não encontrada');
    }

    if (
      user.user_type !== 'admin' &&
      call.caller_id !== user.id &&
      call.receiver_id !== user.id
    ) {
      throw new ForbiddenException('Sem permissão para ver esta chamada');
    }

    return this.format(call);
  }

  async findAll(
    page = 1,
    limit = 20,
    filters: {
      status?: string;
      caller_id?: string;
      receiver_id?: string;
      delivery_id?: string;
      order_id?: string;
    } = {},
  ) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.caller_id) where.caller_id = filters.caller_id;
    if (filters.receiver_id) where.receiver_id = filters.receiver_id;
    if (filters.delivery_id) where.delivery_id = filters.delivery_id;
    if (filters.order_id) where.order_id = filters.order_id;

    const [data, total] = await this.callRepository.findAndCount({
      where,
      relations: ['caller', 'receiver'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: data.map((call) => this.format(call)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async stats() {
    const rows = await this.callRepository
      .createQueryBuilder('call')
      .select('call.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(AVG(call.duration_seconds), 0)', 'avg_duration')
      .groupBy('call.status')
      .getRawMany();

    const byStatus = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.count)]),
    );

    const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
    const answered = byStatus['answered'] ?? 0;
    const ended = byStatus['ended'] ?? 0;

    const avgRow = rows.find((row) => Number(row.avg_duration) > 0);

    const blocked: Array<[string, number]> = await Promise.all(
      [
        'customer_initiated',
        'no_active_delivery',
        'duplicate_call',
        'rate_limited',
        'not_store_owner',
        'role_not_allowed',
        'self_call',
      ].map(async (reason): Promise<[string, number]> => {
        const count =
          (await this.redisService.get<number>(`calls:blocked:${reason}`)) ?? 0;
        return [reason, Number(count)];
      }),
    );

    return {
      total_calls: total,
      by_status: byStatus,
      answered_rate:
        total > 0 ? Number(((answered + ended) / total).toFixed(2)) : 0,
      avg_duration_seconds: Number(Number(avgRow?.avg_duration ?? 0).toFixed(0)),
      blocked_attempts: blocked.reduce((sum, [, count]) => sum + count, 0),
      blocked_by_reason: Object.fromEntries(blocked),
    };
  }

  async blockedAttempts() {
    const reasons = [
      'customer_initiated',
      'no_active_delivery',
      'duplicate_call',
      'rate_limited',
      'not_store_owner',
      'role_not_allowed',
      'self_call',
    ];

    const data = await Promise.all(
      reasons.map(async (reason) => ({
        reason,
        count: Number(
          (await this.redisService.get<number>(`calls:blocked:${reason}`)) ?? 0,
        ),
      })),
    );

    return {
      data,
      total: data.reduce((sum, row) => sum + row.count, 0),
    };
  }

  /**
   * Credenciais STUN/TURN efémeras para o cliente WebRTC
   */
  async iceConfig(user: any) {
    const ttl = 600;
    const stunUrl = process.env.STUN_URL || 'stun:stun.kitanda.ao:3478';
    const turnUrl = process.env.TURN_URL;
    const turnSecret = process.env.TURN_SECRET;

    const iceServers: any[] = [{ urls: stunUrl }];

    if (turnUrl && turnSecret) {
      const username = `${Math.floor(Date.now() / 1000) + ttl}:${user.id}`;
      const credential = crypto
        .createHmac('sha1', turnSecret)
        .update(username)
        .digest('base64');

      iceServers.push({
        urls: [
          `${turnUrl}?transport=udp`,
          `${turnUrl}?transport=tcp`,
        ],
        username,
        credential,
      });
    }

    return {
      ice_servers: iceServers,
      ttl_seconds: ttl,
      media: {
        audio: true,
        video: false,
        codec: 'opus',
      },
    };
  }

  /**
   * Chamadas em toque há mais de 45s ficam `missed`
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireRingingCalls() {
    const result = await this.callRepository
      .createQueryBuilder()
      .update(CallLog)
      .set({ status: 'missed', ended_at: new Date() })
      .where("status IN ('initiated', 'ringing')")
      .andWhere("created_at < now() - interval '45 seconds'")
      .execute();

    if ((result.affected ?? 0) > 0) {
      this.logger.log(`${result.affected} chamadas sem resposta marcadas como missed`);
    }
  }
}

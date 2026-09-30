import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { LiveStream } from './entities/live-stream.entity.js';
import { LiveComment } from './entities/live-comment.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { SellerPlan } from '../plans/entities/seller-plan.entity.js';
import { User } from '../users/entities/user.entity.js';
import { RealtimeService } from '../deliveries/realtime/realtime.service.js';
import { CreateLiveDto, UpdateLiveDto, CreateCommentDto } from './dto/create-live.dto.js';
import { sanitizeHtml } from '../common/utils/sanitize.util.js';

@Injectable()
export class LivesService {
  private readonly logger = new Logger(LivesService.name);

  constructor(
    @InjectRepository(LiveStream)
    private readonly liveRepository: Repository<LiveStream>,
    @InjectRepository(LiveComment)
    private readonly commentRepository: Repository<LiveComment>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(SellerPlan)
    private readonly planRepository: Repository<SellerPlan>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Regra de negócio #1: verificar se o plano da loja permite transmissões ao vivo
   */
  private async assertStoreCanLive(storeId: string): Promise<void> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
      relations: ['plan'],
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada');
    }

    const plan = store.plan as SellerPlan;

    if (!plan || !plan.is_active) {
      throw new ForbiddenException('Você não tem permissão para usar este plano.');
    }

    if (!plan.allow_live_stream) {
      throw new ForbiddenException(
        'O seu plano não permite realizar transmissões ao vivo.',
      );
    }
  }

  /**
   * Iniciar transmissão (vendedor) - valida plano, gera stream_key
   */
  async start(dto: CreateLiveDto, userId: string) {
    const store = await this.storeRepository.findOne({
      where: { owner_id: userId, status: 'active' },
    });

    if (!store) {
      throw new ForbiddenException(
        'Utilizador não possui uma loja ativa. Crie uma loja primeiro.',
      );
    }

    // Regra: plano deve permitir live
    await this.assertStoreCanLive(store.id);

    // Só uma live por vez por loja
    const liveNow = await this.liveRepository.findOne({
      where: { store_id: store.id, status: 'live' },
    });

    if (liveNow) {
      throw new BadRequestException('A loja já possui uma transmissão em andamento');
    }

    const live = this.liveRepository.create({
      ...dto,
      store_id: store.id,
      stream_key: uuidv4(),
      status: 'live',
      started_at: new Date(),
    });

    const saved = await this.liveRepository.save(live);

    this.logger.log(`Live iniciada: ${saved.title} (loja ${store.id})`);

    return saved;
  }

  /**
   * Finalizar transmissão (vendedor)
   */
  async end(liveId: string, userId: string) {
    const live = await this.liveRepository.findOne({
      where: { id: liveId },
    });

    if (!live) {
      throw new NotFoundException('Transmissão não encontrada');
    }

    const store = await this.storeRepository.findOne({
      where: { id: live.store_id },
    });

    if ((store as any)?.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão para finalizar esta transmissão');
    }

    if (live.status === 'ended') {
      throw new BadRequestException('Transmissão já finalizada');
    }

    live.status = 'ended';
    live.ended_at = new Date();
    await this.liveRepository.save(live);

    this.logger.log(`Live ${liveId} finalizada`);

    return live;
  }

  /**
   * Atualizar playback_url (integração com provedor de streaming)
   */
  async setPlaybackUrl(liveId: string, playbackUrl: string, userId: string) {
    const live = await this.liveRepository.findOne({
      where: { id: liveId },
    });

    if (!live) {
      throw new NotFoundException('Transmissão não encontrada');
    }

    const store = await this.storeRepository.findOne({
      where: { id: live.store_id },
    });

    if ((store as any)?.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    live.playback_url = playbackUrl;
    return this.liveRepository.save(live);
  }

  /**
   * Listar lives da loja do vendedor autenticado
   */
  async findByStoreOfUser(userId: string, page = 1, limit = 20) {
    const store = await this.storeRepository.findOne({
      where: { owner_id: userId, status: 'active' },
    });

    if (!store) {
      throw new ForbiddenException(
        'Utilizador não possui uma loja ativa. Crie uma loja primeiro.',
      );
    }

    return this.findByStore(store.id, page, limit);
  }

  /**
   * Listar lives da loja (vendedor)
   */
  async findByStore(storeId: string, page = 1, limit = 20) {
    const [data, total] = await this.liveRepository.findAndCount({
      where: { store_id: storeId },
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
   * Listar lives ao vivo agora (público - home do app cliente)
   */
  async findLiveNow(page = 1, limit = 20) {
    const [data, total] = await this.liveRepository.findAndCount({
      where: { status: 'live' },
      relations: ['store'],
      skip: (page - 1) * limit,
      take: limit,
      order: { started_at: 'DESC' },
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Obter live por ID
   */
  async findOne(liveId: string) {
    const live = await this.liveRepository.findOne({
      where: { id: liveId },
      relations: ['store'],
    });

    if (!live) {
      throw new NotFoundException('Transmissão não encontrada');
    }

    return live;
  }

  /**
   * Enviar comentário/pergunta na live (cliente)
   * Persiste + emite via WebSocket para a sala da live
   */
  async addComment(liveId: string, dto: CreateCommentDto, userId: string) {
    const live = await this.liveRepository.findOne({
      where: { id: liveId },
    });

    if (!live) {
      throw new NotFoundException('Transmissão não encontrada');
    }

    const comment = this.commentRepository.create({
      live_id: liveId,
      user_id: userId,
      message: sanitizeHtml(dto.message),
      is_question: dto.is_question ?? false,
    });

    const saved = await this.commentRepository.save(comment);

    // Emitir para todos os espectadores da sala
    this.realtimeService.emitLiveComment(liveId, {
      id: saved.id,
      live_id: liveId,
      user_id: userId,
      message: saved.message,
      is_question: saved.is_question,
      created_at: saved.created_at,
    });

    return saved;
  }

  /**
   * Listar comentários da live
   */
  async getComments(liveId: string, page = 1, limit = 50) {
    const live = await this.liveRepository.findOne({
      where: { id: liveId },
    });

    if (!live) {
      throw new NotFoundException('Transmissão não encontrada');
    }

    const [data, total] = await this.commentRepository.findAndCount({
      where: { live_id: liveId },
      relations: ['user'],
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
   * Perguntas destacadas da live (painel do vendedor)
   */
  async getQuestions(liveId: string, userId: string) {
    const live = await this.liveRepository.findOne({
      where: { id: liveId },
    });

    if (!live) {
      throw new NotFoundException('Transmissão não encontrada');
    }

    const store = await this.storeRepository.findOne({
      where: { id: live.store_id },
    });

    if ((store as any)?.owner_id !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    return this.commentRepository.find({
      where: { live_id: liveId, is_question: true },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';

import { ChatRoom } from './entities/chat-room.entity.js';
import { Message } from './entities/message.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Store } from '../stores/entities/store.entity.js';
import { RedisService } from '../common/redis/redis.service.js';
import { sanitizeHtml } from '../common/utils/sanitize.util.js';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly CACHE_TTL = 120; // 2 minutos para chat

  constructor(
    @InjectRepository(ChatRoom)
    private readonly roomRepository: Repository<ChatRoom>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Criar ou obter sala de chat existente
   */
  async createOrGetRoom(customerId: string, storeId: string, productId?: string) {
    // Verificar se a loja existe e está ativa
    const store = await this.storeRepository.findOne({
      where: { id: storeId, status: 'active' },
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada ou inativa');
    }

    // Verificar se o cliente não está a criar chat com a própria loja (seller)
    if (store.owner_id === customerId) {
      throw new BadRequestException('Não pode criar chat com a sua própria loja');
    }

    // Buscar sala existente
    const where: any = {
      customer_id: customerId,
      store_id: storeId,
    };

    if (productId) {
      where.product_id = productId;
    } else {
      where.product_id = null;
    }

    let room = await this.roomRepository.findOne({
      where,
      relations: ['messages'],
    });

    if (!room) {
      const newRoom = this.roomRepository.create({
        customer_id: customerId,
        store_id: storeId,
        product_id: productId || undefined,
      });
      room = await this.roomRepository.save(newRoom) as ChatRoom;

      this.logger.log(
        `Nova sala de chat criada: ${room.id} (customer: ${customerId}, store: ${storeId})`,
      );
    }

    return room;
  }

  /**
   * Enviar mensagem
   */
  async sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    mediaUrl?: string,
    documentUrl?: string,
  ) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['store'],
    });

    if (!room) {
      throw new NotFoundException('Sala de chat não encontrada');
    }

    // Verificar se o remetente é o customer ou o owner da loja
    const isCustomer = room.customer_id === senderId;
    const isStoreOwner =
      (room.store as Store)?.owner_id === senderId;

    if (!isCustomer && !isStoreOwner) {
      throw new ForbiddenException(
        'Sem permissão para enviar mensagens nesta sala',
      );
    }

    // Sanitizar conteúdo
    const sanitizedContent = content ? sanitizeHtml(content) : null;

    const message = this.messageRepository.create({
      room_id: roomId,
      sender_id: senderId,
      content: sanitizedContent,
      media_url: mediaUrl || undefined,
      document_url: documentUrl || undefined,
    } as any);

    const saved = await this.messageRepository.save(message);

    // Invalidar cache de mensagens
    await this.redisService.del(`chat:room:${roomId}:messages`);

    this.logger.log(
      `Mensagem enviada na sala ${roomId} por ${senderId}`,
    );

    return saved;
  }

  /**
   * Listar mensagens de uma sala (com paginação e cache)
   */
  async getRoomMessages(
    roomId: string,
    userId: string,
    page = 1,
    limit = 50,
  ) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['store'],
    });

    if (!room) {
      throw new NotFoundException('Sala de chat não encontrada');
    }

    // Verificar ownership
    const isCustomer = room.customer_id === userId;
    const isStoreOwner = (room.store as Store)?.owner_id === userId;

    if (!isCustomer && !isStoreOwner) {
      throw new ForbiddenException('Sem permissão para aceder esta sala');
    }

    const cacheKey = `chat:room:${roomId}:messages:${page}`;

    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) return cached;

    // Buscar apenas mensagens não expiradas
    const [messages, total] = await this.messageRepository.findAndCount({
      where: {
        room_id: roomId,
        expires_at: MoreThan(new Date()),
      },
      relations: ['sender'],
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const result = {
      data: messages,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redisService.set(cacheKey, result, this.CACHE_TTL);

    return result;
  }

  /**
   * Listar salas de chat do utilizador
   */
  async getMyRooms(userId: string, userType: string) {
    let rooms;

    if (userType === 'customer') {
      rooms = await this.roomRepository.find({
        where: { customer_id: userId },
        relations: ['store', 'product', 'messages'],
        order: { created_at: 'DESC' },
      });
    } else if (userType === 'seller') {
      // Buscar lojas do vendedor
      const stores = await this.storeRepository.find({
        where: { owner_id: userId },
        select: ['id'],
      });

      const storeIds = stores.map((s) => s.id);

      if (storeIds.length === 0) {
        return [];
      }

      rooms = await this.roomRepository
        .createQueryBuilder('room')
        .leftJoinAndSelect('room.store', 'store')
        .leftJoinAndSelect('room.product', 'product')
        .leftJoinAndSelect('room.messages', 'messages')
        .where('room.store_id IN (:...storeIds)', { storeIds })
        .orderBy('room.created_at', 'DESC')
        .getMany();
    }

    return rooms || [];
  }

  /**
   * Marcar mensagens como lidas
   */
  async markAsRead(roomId: string, userId: string) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['store'],
    });

    if (!room) {
      throw new NotFoundException('Sala não encontrada');
    }

    // Marcar como lidas as mensagens que NÃO são do utilizador
    await this.messageRepository.update(
      {
        room_id: roomId,
        sender_id: LessThan(userId) as any, // Mensagens de outros
        is_read: false,
      },
      { is_read: true },
    );

    // Marcar todas as mensagens de outros utilizadores como lidas
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ is_read: true })
      .where('room_id = :roomId', { roomId })
      .andWhere('sender_id != :userId', { userId })
      .andWhere('is_read = false')
      .execute();

    return { message: 'Mensagens marcadas como lidas' };
  }

  /**
   * Eliminar mensagens expiradas (>72h)
   */
  async cleanupExpiredMessages(): Promise<number> {
    const result = await this.messageRepository.delete({
      expires_at: LessThan(new Date()),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `${result.affected} mensagens expiradas eliminadas`,
      );
    }

    return result.affected || 0;
  }

  /**
   * Verificar se utilizador pertence à sala
   */
  async verifyRoomOwnership(roomId: string, userId: string): Promise<boolean> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['store'],
    });

    if (!room) return false;

    return (
      room.customer_id === userId ||
      (room.store as Store)?.owner_id === userId
    );
  }
}

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity.js';
import { RealtimeService } from './realtime.service.js';
import { ChatService } from '../../chat/chat.service.js';

@WebSocketGateway({
  cors: { origin: process.env.APP_URL || 'http://localhost:3000' },
  namespace: '/realtime',
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly realtimeService: RealtimeService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  afterInit() {
    this.realtimeService.setServer(this.server);
    this.logger.log('Socket.io gateway inicializado (namespace /realtime)');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization || '').replace('Bearer ', '');

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        client.disconnect(true);
        return;
      }

      // Dados do utilizador disponíveis nos handlers
      (client as any).data.user = {
        id: user.id,
        user_type: user.user_type,
      };

      // Sala pessoal (notificações futuras)
      client.join(`user:${user.id}`);

      this.logger.debug(`Cliente conectado: ${user.id}`);
    } catch (error) {
      this.logger.warn(`Conexão WebSocket rejeitada: ${error.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Cliente desconectado: ${client.id}`);
  }

  /**
   * Entrar na sala de uma entrega (cliente acompanha seta no mapa)
   */
  @SubscribeMessage('delivery:subscribe')
  async handleDeliverySubscribe(client: Socket, deliveryId: string) {
    const user = (client as any).data.user;
    if (!user) return { event: 'error', data: { message: 'Não autenticado' } };

    client.join(`delivery:${deliveryId}`);
    return { event: 'subscribed', data: { room: `delivery:${deliveryId}` } };
  }

  /**
   * Sair da sala de uma entrega
   */
  @SubscribeMessage('delivery:unsubscribe')
  handleDeliveryUnsubscribe(client: Socket, deliveryId: string) {
    client.leave(`delivery:${deliveryId}`);
    return { event: 'unsubscribed', data: { room: `delivery:${deliveryId}` } };
  }

  /**
   * Entrar na sala de um pedido
   */
  @SubscribeMessage('order:subscribe')
  handleOrderSubscribe(client: Socket, orderId: string) {
    const user = (client as any).data.user;
    if (!user) return { event: 'error', data: { message: 'Não autenticado' } };

    client.join(`order:${orderId}`);
    return { event: 'subscribed', data: { room: `order:${orderId}` } };
  }

  /**
   * Entrar na sala de uma live (chat em tempo real)
   */
  @SubscribeMessage('live:subscribe')
  handleLiveSubscribe(client: Socket, liveId: string) {
    const user = (client as any).data.user;
    if (!user) return { event: 'error', data: { message: 'Não autenticado' } };

    client.join(`live:${liveId}`);
    return { event: 'subscribed', data: { room: `live:${liveId}` } };
  }

  /**
   * Sair da sala de uma live
   */
  @SubscribeMessage('live:unsubscribe')
  handleLiveUnsubscribe(client: Socket, liveId: string) {
    client.leave(`live:${liveId}`);
    return { event: 'unsubscribed', data: { room: `live:${liveId}` } };
  }

  /**
   * Entrar na sala de um chat (cliente e vendedor recebem mensagens em tempo real)
   */
  @SubscribeMessage('chat:subscribe')
  async handleChatSubscribe(client: Socket, roomId: string) {
    const user = (client as any).data.user;
    if (!user) return { event: 'error', data: { message: 'Não autenticado' } };

    try {
      const allowed = await this.chatService.verifyRoomOwnership(roomId, user.id);
      if (!allowed) {
        return { event: 'error', data: { message: 'Sem permissão para esta sala' } };
      }

      client.join(`chat:${roomId}`);
      return { event: 'subscribed', data: { room: `chat:${roomId}` } };
    } catch (error) {
      this.logger.warn(`chat:subscribe falhou: ${error.message}`);
      return { event: 'error', data: { message: 'Sala não encontrada' } };
    }
  }

  /**
   * Sair da sala de um chat
   */
  @SubscribeMessage('chat:unsubscribe')
  handleChatUnsubscribe(client: Socket, roomId: string) {
    client.leave(`chat:${roomId}`);
    return { event: 'unsubscribed', data: { room: `chat:${roomId}` } };
  }
}

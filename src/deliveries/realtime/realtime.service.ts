import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private io: Server | null = null;

  /**
   * Registrar a instância do Socket.io Server (chamado pelo TrackingGateway)
   */
  setServer(io: Server) {
    this.io = io;
  }

  /**
   * Notificar mudança de status da entrega (cliente acompanha em tempo real)
   */
  emitDeliveryUpdate(delivery: any) {
    if (!this.io) return;

    // Sala da entrega: cliente, loja e estafeta entram na mesma sala
    this.io.to(`delivery:${delivery.id}`).emit('delivery:update', {
      id: delivery.id,
      status: delivery.status,
      courier_id: delivery.courier_id,
      completed_at: delivery.completed_at,
    });

    if (delivery.order_id) {
      this.io.to(`order:${delivery.order_id}`).emit('delivery:update', {
        id: delivery.id,
        status: delivery.status,
      });
    }
  }

  /**
   * Emitir posição do estafeta para a sala da entrega (seta em movimento no mapa)
   */
  emitTrackingUpdate(deliveryId: string, payload: any) {
    if (!this.io) return;

    this.io.to(`delivery:${deliveryId}`).emit('courier:position', payload);
  }

  /**
   * Emitir novo comentário/pergunta da live para todos os espectadores
   */
  emitLiveComment(liveId: string, comment: any) {
    if (!this.io) return;

    this.io.to(`live:${liveId}`).emit('live:comment', comment);
  }
}

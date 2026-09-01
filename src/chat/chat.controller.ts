import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { ChatService } from './chat.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('rooms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Criar ou obter sala de chat existente',
    description: 'Cliente cria chat com loja. Se já existir, retorna a existente.',
  })
  @ApiResponse({ status: 200, description: 'Sala de chat' })
  @ApiResponse({ status: 403, description: 'Não pode criar chat consigo mesmo' })
  async createOrGetRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: User,
  ) {
    return this.chatService.createOrGetRoom(
      user.id,
      dto.store_id,
      dto.product_id,
    );
  }

  @Get('rooms')
  @ApiOperation({ summary: 'Listar minhas salas de chat' })
  @ApiResponse({ status: 200, description: 'Lista de salas' })
  async getMyRooms(@CurrentUser() user: User) {
    return this.chatService.getMyRooms(user.id, user.user_type);
  }

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Listar mensagens de uma sala (com paginação)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Mensagens da sala' })
  async getRoomMessages(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getRoomMessages(
      roomId,
      user.id,
      page || 1,
      limit || 50,
    );
  }

  @Post('rooms/:roomId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enviar mensagem numa sala' })
  @ApiResponse({ status: 201, description: 'Mensagem enviada' })
  @ApiResponse({ status: 403, description: 'Sem permissão' })
  async sendMessage(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.chatService.sendMessage(
      roomId,
      user.id,
      dto.content,
      dto.media_url,
      dto.document_url,
    );
  }

  @Post('rooms/:roomId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar mensagens como lidas' })
  async markAsRead(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: User,
  ) {
    return this.chatService.markAsRead(roomId, user.id);
  }
}

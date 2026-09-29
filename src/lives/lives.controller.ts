import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { LivesService } from './lives.service.js';
import { CreateLiveDto, CreateCommentDto } from './dto/create-live.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Lives')
@Controller('lives')
export class LivesController {
  constructor(private readonly livesService: LivesService) {}

  // ==================== VENDEDOR ====================

  @Post('start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Iniciar transmissão ao vivo (vendedor) - valida plano allow_live_stream',
  })
  @ApiResponse({
    status: 403,
    description: 'O seu plano não permite realizar transmissões ao vivo.',
  })
  async start(@Body() dto: CreateLiveDto, @CurrentUser() user: any) {
    return this.livesService.start(dto, user.id);
  }

  @Post(':id/end')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalizar transmissão (vendedor)' })
  async end(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.livesService.end(id, user.id);
  }

  @Patch(':id/playback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Definir playback_url da transmissão (vendedor)' })
  async setPlayback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('playback_url') playbackUrl: string,
    @CurrentUser() user: any,
  ) {
    return this.livesService.setPlaybackUrl(id, playbackUrl, user.id);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar transmissões da minha loja (vendedor)' })
  async findMy(@CurrentUser() user: any, @Query('page') page?: number, @Query('limit') limit?: number) {
    // resolveStoreId não existe aqui, usar owner via service
    return this.livesService.findByStoreOfUser(user.id, page || 1, limit || 20);
  }

  @Get(':id/questions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perguntas destacadas da live (painel do vendedor)' })
  async getQuestions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.livesService.getQuestions(id, user.id);
  }

  // ==================== PÚBLICO ====================

  @Get('live-now')
  @ApiOperation({ summary: 'Listar transmissões ao vivo agora (público)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findLiveNow(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.livesService.findLiveNow(page || 1, limit || 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter transmissão por ID (público)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.livesService.findOne(id);
  }

  // ==================== CLIENTE ====================

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enviar comentário/pergunta na live (cliente)' })
  async addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.livesService.addComment(id, dto, user.id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Listar comentários da live' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.livesService.getComments(id, page || 1, limit || 50);
  }
}

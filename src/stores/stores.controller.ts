import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Head,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { StoresService } from './stores.service.js';
import { CreateStoreDto } from './dto/create-store.dto.js';
import { UpdateStoreDto } from './dto/update-store.dto.js';
import { ApproveStoreDto } from './dto/approve-store.dto.js';
import { RequestPlanUpgradeDto } from './dto/request-plan-upgrade.dto.js';
import { RespondUpgradeDto } from './dto/respond-upgrade.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('Stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // ==================== ROTAS PÚBLICAS ====================

  @Get('public/:slug')
  @ApiOperation({ summary: 'Obter loja por slug (público)' })
  @ApiResponse({ status: 200, description: 'Loja encontrada' })
  @ApiResponse({ status: 404, description: 'Loja não encontrada' })
  async findBySlug(@Param('slug') slug: string) {
    return this.storesService.findBySlug(slug);
  }

  // ==================== ROTAS DO VENDEDOR ====================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar nova loja (Vendedor)' })
  @ApiResponse({ status: 201, description: 'Loja criada' })
  async create(
    @Body() createStoreDto: CreateStoreDto,
    @CurrentUser() user: User,
  ) {
    return this.storesService.create(createStoreDto, user.id);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar minhas lojas (Vendedor)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findMyStores(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.storesService.findByOwner(user.id, page || 1, limit || 20);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter loja por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.storesService.findOne(id);
  }

  @Put(':id')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar loja (Vendedor/Admin)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStoreDto: UpdateStoreDto,
    @CurrentUser() user: User,
  ) {
    return this.storesService.update(id, updateStoreDto, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar loja (Admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { message: 'Loja eliminada com sucesso' };
  }

  @Head(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar se loja existe (HEAD)' })
  async checkExists(@Param('id', ParseUUIDPipe) id: string) {
    await this.storesService.findOne(id);
    return {};
  }

  // ==================== ROTAS DO ADMIN ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todas as lojas (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAllAdmin(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.storesService.findAll(page || 1, limit || 20, status);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprovar loja (Admin)' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.storesService.approve(id, user.id);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeitar loja (Admin)' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveStoreDto,
    @CurrentUser() user: User,
  ) {
    return this.storesService.reject(id, user.id, dto.reason || '');
  }

  @Post(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspender loja por fraude (Admin)' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveStoreDto,
    @CurrentUser() user: User,
  ) {
    return this.storesService.suspend(id, user.id, dto.reason || '');
  }

  // ==================== UPGRADE DE PLANO ====================

  @Post(':id/upgrade-request')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Solicitar upgrade de plano' })
  async requestUpgrade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestPlanUpgradeDto,
    @CurrentUser() user: User,
  ) {
    return this.storesService.requestPlanUpgrade(
      id,
      dto.requested_plan_id,
      user.id,
      dto.payment_proof_url,
    );
  }

  @Get('admin/upgrade-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar solicitações de upgrade (Admin)' })
  @ApiQuery({ name: 'status', required: false })
  async findUpgradeRequests(@Query('status') status?: string) {
    return this.storesService.findAllUpgradeRequests(status || 'pending');
  }

  @Post('admin/upgrade-requests/:requestId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Responder solicitação de upgrade (Admin)' })
  async respondToUpgrade(
    @Param('requestId') requestId: string,
    @Body() dto: RespondUpgradeDto,
    @CurrentUser() user: User,
  ) {
    return this.storesService.respondToUpgradeRequest(
      requestId,
      dto.status as 'approved' | 'rejected',
      user.id,
      dto.admin_notes,
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { SubscriptionsService } from './subscriptions.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('my/:storeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar pagamentos da minha loja' })
  async findByStore(
    @Param('storeId') storeId: string,
    @CurrentUser() user: User,
  ) {
    // Verificar ownership: vendedor só pode ver pagamentos da sua loja
    await this.subscriptionsService.verifyStoreOwnership(storeId, user.id);
    return this.subscriptionsService.findByStore(storeId);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos os pagamentos (Admin)' })
  async findAll(@Query('status') status?: string) {
    return this.subscriptionsService.findAll(status);
  }

  @Post('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprovar pagamento (Admin)' })
  async approvePayment(@Param('id') id: string) {
    return this.subscriptionsService.approvePayment(id);
  }

  @Post('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeitar pagamento (Admin)' })
  async rejectPayment(@Param('id') id: string) {
    return this.subscriptionsService.rejectPayment(id);
  }
}

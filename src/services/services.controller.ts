import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { ServicesService } from './services.service.js';
import { SetScheduleDto, UpdateServiceDetailsDto } from './dto/service.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Horários de atendimento da minha loja (Vendedor)' })
  async getSchedule(@CurrentUser() user: any) {
    return this.servicesService.getSchedule(user.id);
  }

  @Put('schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Substituir a semana de horários (Vendedor)' })
  async setSchedule(@CurrentUser() user: any, @Body() dto: SetScheduleDto) {
    return this.servicesService.setSchedule(dto, user.id);
  }

  @Get('schedule/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Blocos livres num dia (Vendedor)' })
  @ApiQuery({ name: 'date', required: true, example: '2026-11-03' })
  @ApiQuery({ name: 'product_id', required: false })
  async getSlots(
    @CurrentUser() user: any,
    @Query('date') date: string,
    @Query('product_id') productId?: string,
  ) {
    return this.servicesService.getSlots(user.id, date, productId);
  }

  @Get(':productId/availability')
  @ApiOperation({ summary: 'Disponibilidade pública do serviço (14 dias)' })
  async availability(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.servicesService.availability(productId);
  }

  @Get(':productId/details')
  @ApiOperation({ summary: 'Detalhes do serviço (público)' })
  async getDetails(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.servicesService.getDetails(productId);
  }

  @Put(':productId/details')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar/atualizar detalhes do serviço (Vendedor)' })
  async upsertDetails(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateServiceDetailsDto,
    @CurrentUser() user: any,
  ) {
    return this.servicesService.upsertDetails(productId, dto, user.id);
  }
}

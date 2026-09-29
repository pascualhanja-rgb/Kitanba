import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AffiliatesService } from './affiliates.service.js';
import { CreateAffiliateDto, UpdateAffiliateDto } from './dto/create-affiliate.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Store Affiliates')
@Controller('affiliates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AffiliatesController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  @Post()
  @Roles('seller')
  @ApiOperation({
    summary: 'Associar membro à equipe da loja (vendedor) - valida limite do plano',
  })
  @ApiResponse({ status: 403, description: 'Limite de afiliados atingido para o plano atual.' })
  async create(@Body() dto: CreateAffiliateDto, @CurrentUser() user: any) {
    return this.affiliatesService.create(dto, user.id);
  }

  @Get('my')
  @Roles('seller')
  @ApiOperation({ summary: 'Listar membros da equipe da minha loja (vendedor)' })
  async findByStore(@CurrentUser() user: any) {
    const store = await this.affiliatesService.resolveStoreOfUser(user.id);
    return this.affiliatesService.findByStore(store.id);
  }

  @Get('me/teams')
  @ApiOperation({ summary: 'Listar equipes onde sou membro (estafeta/afiliado)' })
  async findMyTeams(@CurrentUser() user: any) {
    return this.affiliatesService.findByUser(user.id);
  }

  @Patch(':id')
  @Roles('seller')
  @ApiOperation({ summary: 'Atualizar role/status de um membro (vendedor)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAffiliateDto,
    @CurrentUser() user: any,
  ) {
    return this.affiliatesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('seller')
  @ApiOperation({ summary: 'Remover membro da equipe (vendedor)' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.affiliatesService.remove(id, user.id);
  }
}

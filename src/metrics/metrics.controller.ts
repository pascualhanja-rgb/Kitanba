import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

import { MetricsService } from './metrics.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('Métricas (Admin)')
@Controller('admin')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Métricas executivas (Admin)',
    description:
      'Resumo financeiro (MRR/ARR/ticket médio), saúde do negócio ' +
      '(churn/retenção/LTV/CAC), crescimento, publicidade, receita por plano ' +
      'e por loja, e série mensal dos últimos 12 meses.',
  })
  @ApiResponse({ status: 200, description: 'Métricas calculadas' })
  async getMetrics() {
    return this.metricsService.summary();
  }
}

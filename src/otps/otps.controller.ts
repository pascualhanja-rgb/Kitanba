import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { OtpsService } from './otps.service.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import { VerifyPasswordResetDto } from './dto/verify-password-reset.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('OTPs')
@Controller('otps')
export class OtpsController {
  constructor(private readonly otpsService: OtpsService) {}

  @Post('send-activation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar OTP de ativação de conta (usa o userId do token)',
  })
  @ApiResponse({ status: 200, description: 'OTP enviado' })
  async sendActivationOtp(@CurrentUser() user: User) {
    return this.otpsService.sendAccountActivationOtp(user.id);
  }

  // OPTION A: Manter autenticado se o Flutter mandar o token Bearer
  @Post('verify-activation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar OTP de ativação (usa o userId do token)',
  })
  @ApiResponse({ status: 200, description: 'Conta ativada' })
  async verifyActivationOtp(
    @CurrentUser() user: User,
    @Body() verifyOtpDto: VerifyOtpDto,
  ) {
    return this.otpsService.verifyAccountActivationOtp(
      user.id,
      verifyOtpDto.otp_code,
    );
  }

  // OPTION B: Endpoint Público por Email (Para quando o usuário não tem Token JWT)
  @Post('verify-activation-public')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar OTP de ativação publicamente via e-mail e código',
  })
  @ApiResponse({ status: 200, description: 'Conta ativada com sucesso' })
  async verifyActivationOtpPublic(@Body() dto: VerifyPasswordResetDto) {
    if (!/^\d{6}$/.test(dto.otp_code)) {
      throw new BadRequestException('O código OTP deve ter 6 dígitos');
    }
    return this.otpsService.verifyAccountActivationOtpByEmail(
      dto.email,
      dto.otp_code,
    );
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar reset de senha (clientes)' })
  @ApiResponse({ status: 200, description: 'OTP enviado' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.otpsService.requestPasswordReset(dto.email);
  }

  @Post('verify-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar OTP de reset de senha' })
  @ApiResponse({ status: 200, description: 'Código verificado' })
  async verifyPasswordReset(@Body() dto: VerifyPasswordResetDto) {
    if (!/^\d{6}$/.test(dto.otp_code)) {
      throw new BadRequestException('Código OTP deve ter exatamente 6 dígitos');
    }
    return this.otpsService.verifyPasswordResetOtp(dto.email, dto.otp_code);
  }
}
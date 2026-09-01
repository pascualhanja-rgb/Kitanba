import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { OtpsService } from './otps.service.js';
import { SendOtpDto } from './dto/send-otp.dto.js';
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
    // Usar o userId do JWT, não da URL - previne que um utilizador envie OTP para outro
    return this.otpsService.sendAccountActivationOtp(user.id);
  }

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
    // Usar o userId do JWT, não da URL
    return this.otpsService.verifyAccountActivationOtp(
      user.id,
      verifyOtpDto.otp_code,
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
    // Validação básica do OTP
    if (!/^\d{6}$/.test(dto.otp_code)) {
      throw new BadRequestException('Código OTP deve ter exatamente 6 dígitos');
    }
    return this.otpsService.verifyPasswordResetOtp(dto.email, dto.otp_code);
  }
}

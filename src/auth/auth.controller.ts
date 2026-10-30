import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { SocialAuthDto, SocialLinkDto } from './dto/social-auth.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registar novo utilizador' })
  @ApiResponse({ status: 201, description: 'Utilizador registado com sucesso' })
  @ApiResponse({ status: 409, description: 'Email já em uso' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // TODO(temporário): @SkipThrottle desativa o rate limit (20 req/min por IP) apenas nesta rota
  // para testes de carga de login. REVERTER após conclusão dos testes.
  @SkipThrottle()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login do utilizador' })
  @ApiResponse({ status: 200, description: 'Login bem-sucedido' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers?.['user-agent'];
    return this.authService.login(loginDto, ip, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens renovados' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout do utilizador (revoga refresh token)' })
  @ApiResponse({ status: 200, description: 'Logout efetuado' })
  async logout(
    @CurrentUser() user: User,
    @Body() dto?: RefreshTokenDto,
  ) {
    return this.authService.logout(user.id, dto?.refresh_token);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alterar senha (autenticado ou via reset por OTP/Email)' })
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados incorretos ou token inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.authService.processChangePassword(dto, authHeader);
  }

  @Post('social')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login/Registro social nativo (Google ou Apple)',
    description:
      'Recebe o ID Token nativo (google_sign_in ou sign_in_with_apple no Flutter), valida-o diretamente com o fornecedor, sincroniza o utilizador e devolve os tokens da aplicação',
  })
  @ApiResponse({ status: 200, description: 'Autenticado com sucesso' })
  @ApiResponse({ status: 401, description: 'Token do Google/Apple inválido ou expirado' })
  @ApiResponse({ status: 409, description: 'Email já ligado a outra conta social' })
  async socialAuth(@Body() dto: SocialAuthDto, @Request() req: any) {
    return this.authService.socialAuth(dto, req.ip, req.headers?.['user-agent']);
  }

  @Post('social/link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ligar conta social (Google/Apple) à conta autenticada' })
  @ApiResponse({ status: 200, description: 'Conta social ligada' })
  @ApiResponse({ status: 401, description: 'Não autenticado ou token social inválido' })
  @ApiResponse({ status: 409, description: 'Conta social já ligada a outro utilizador' })
  async linkSocial(@CurrentUser() user: User, @Body() dto: SocialLinkDto) {
    return this.authService.linkSocialAccount(user.id, dto.provider, dto.token);
  }

  @Delete('social/unlink')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desligar conta social (Google/Apple) da conta autenticada' })
  @ApiResponse({ status: 200, description: 'Conta social desligada' })
  @ApiResponse({ status: 400, description: 'Conta sem senha definida ou não ligada' })
  async unlinkSocial(@CurrentUser() user: User) {
    return this.authService.unlinkSocialAccount(user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter perfil do utilizador autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getProfile(@CurrentUser() user: User) {
    const { password_hash, ...result } = user as any;
    return result;
  }
}
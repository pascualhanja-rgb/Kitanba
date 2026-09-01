import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Registra um novo utilizador
   */
  async register(registerDto: RegisterDto) {
    const { email, password, name, phone, user_type } = registerDto;

    // Verificar se o email já existe
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email já está em uso');
    }

    // Hash da senha com bcrypt (12 rounds para segurança)
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Criar utilizador
    const user = this.userRepository.create({
      name,
      email,
      password_hash,
      phone,
      user_type: user_type || 'customer',
    });

    const savedUser = await this.userRepository.save(user);

    // Gerar tokens JWT (access + refresh)
    const tokens = await this.generateTokens(savedUser);

    this.logger.log(`Novo utilizador registrado: ${email}`);

    return {
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        user_type: savedUser.user_type,
        is_email_verified: savedUser.is_email_verified,
      },
      ...tokens,
    };
  }

  /**
   * Login do utilizador com proteção anti-brute force
   */
  async login(loginDto: LoginDto, ip?: string, userAgent?: string) {
    const { email, password } = loginDto;

    // Verificar se a conta está bloqueada por brute force
    const maxAttempts = this.configService.get<number>(
      'MAX_LOGIN_ATTEMPTS',
      5,
    );
    const lockoutMinutes = this.configService.get<number>(
      'LOGIN_LOCKOUT_MINUTES',
      15,
    );

    const isLocked = await this.redisService.isAccountLocked(
      email,
      maxAttempts,
    );
    if (isLocked) {
      this.logger.warn(
        `Tentativa de login em conta bloqueada: ${email} (IP: ${ip})`,
      );
      throw new UnauthorizedException(
        'Conta temporariamente bloqueada devido a múltiplas tentativas. Tente novamente mais tarde.',
      );
    }

    // Buscar utilizador com password_hash
    const user = await this.userRepository.findOne({
      where: { email },
      select: [
        'id',
        'name',
        'email',
        'password_hash',
        'user_type',
        'is_email_verified',
      ],
    });

    if (!user) {
      // Mensagem genérica para não revelar se o email existe
      await this.redisService.recordFailedLogin(
        email,
        maxAttempts,
        lockoutMinutes,
      );
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      const result = await this.redisService.recordFailedLogin(
        email,
        maxAttempts,
        lockoutMinutes,
      );
      this.logger.warn(
        `Tentativa de login falhada para: ${email} (restam ${result.attemptsLeft} tentativas)`,
      );

      if (result.locked) {
        this.logger.error(
          `🔒 Conta bloqueada por brute force: ${email} (IP: ${ip})`,
        );
      }

      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Login bem-sucedido: limpar tentativas falhadas
    await this.redisService.clearFailedLogins(email);

    // Gerar tokens JWT (access + refresh)
    const tokens = await this.generateTokens(user);

    this.logger.log(
      `Login bem-sucedido: ${email} (IP: ${ip}, UA: ${userAgent})`,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        user_type: user.user_type,
        is_email_verified: user.is_email_verified,
      },
      ...tokens,
    };
  }

  /**
   * Renovar access token usando refresh token
   */
  async refreshToken(refreshToken: string) {
    try {
      // Verificar se o refresh token não está na blacklist
      const isBlacklisted =
        await this.redisService.isTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new UnauthorizedException('Refresh token revogado');
      }

      // Verificar validade do refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Buscar utilizador
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Utilizador não encontrado');
      }

      // Blacklistar o refresh token antigo
      const oldPayload = this.jwtService.decode(refreshToken) as any;
      const oldExp = oldPayload.exp - Math.floor(Date.now() / 1000);
      if (oldExp > 0) {
        await this.redisService.blacklistToken(refreshToken, oldExp);
      }

      // Gerar novos tokens
      const tokens = await this.generateTokens(user);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  /**
   * Logout: revogar tokens
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = this.jwtService.decode(refreshToken) as any;
        if (payload?.exp) {
          const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
          if (expiresIn > 0) {
            await this.redisService.blacklistToken(refreshToken, expiresIn);
          }
        }
      } catch {
        // Token já inválido, ignorar
      }
    }

    // Invalidar todas as chaves de cache do utilizador
    await this.redisService.delPattern(`user:${userId}:*`);

    this.logger.log(`Utilizador ${userId} fez logout`);

    return { message: 'Logout efetuado com sucesso' };
  }

  /**
   * Alterar senha do utilizador
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'password_hash'],
    });

    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    // Verificar senha atual
    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Senha atual incorreta');
    }

    // Verificar que a nova senha é diferente
    const isSame = await bcrypt.compare(newPassword, user.password_hash);
    if (isSame) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da atual',
      );
    }

    // Hash da nova senha
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await this.userRepository.update(userId, { password_hash });

    this.logger.log(`Senha alterada para utilizador ${userId}`);

    return { message: 'Senha alterada com sucesso' };
  }

  /**
   * Definir nova senha (após reset via OTP)
   */
  async resetPassword(email: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException('Email não encontrado');
    }

    // Hash da nova senha
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await this.userRepository.update(user.id, { password_hash });

    this.logger.log(`Senha redefinida para utilizador ${user.id}`);

    return { message: 'Senha redefinida com sucesso' };
  }

  /**
   * Valida utilizador para passport-local
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'password_hash', 'user_type'],
    });

    if (user && (await bcrypt.compare(password, user.password_hash))) {
      const { password_hash, ...result } = user;
      return result;
    }

    return null;
  }

  /**
   * Gera access token + refresh token JWT
   */
  private async generateTokens(user: User): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const payload = {
      sub: user.id,
      email: user.email,
      user_type: user.user_type,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as any,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  /**
   * Valida utilizador pelo ID (usado pelo JwtStrategy)
   */
  async validateUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Utilizador não encontrado');
    }

    return user;
  }
}

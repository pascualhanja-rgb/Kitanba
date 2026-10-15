import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
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
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ClerkAuthDto } from './dto/clerk-auth.dto.js';
import { RedisService } from '../common/redis/redis.service.js';
import { ClerkAuthService, type ClerkProfile } from './clerk.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly clerkAuthService: ClerkAuthService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name, phone, user_type } = registerDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email já está em uso');
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const user = this.userRepository.create({
      name,
      email,
      password_hash,
      phone,
      user_type: user_type || 'customer',
    });

    const savedUser = await this.userRepository.save(user);
    const tokens = await this.generateTokens(savedUser);

    return {
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        user_type: savedUser.user_type,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto, ip?: string, userAgent?: string) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'password_hash', 'user_type'],
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid =
      !!user.password_hash && (await bcrypt.compare(password, user.password_hash));
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        user_type: user.user_type,
      },
      ...tokens,
    };
  }

  /**
   * Login/registro social via Clerk (Google ou Apple).
   * Valida o token de sessão do Clerk, sincroniza o utilizador
   * (por clerk_id ou email) e devolve os tokens da aplicação.
   */
  async clerkAuth(dto: ClerkAuthDto, ip?: string, userAgent?: string) {
    const profile: ClerkProfile = await this.clerkAuthService.verifySessionToken(
      dto.clerk_token,
    );

    const found = await this.userRepository.findOne({
      where: { clerk_id: profile.clerkId },
    });

    let user: User;
    if (found) {
      user = found;
    } else {
      // Sem clerk_id: tentar ligar à conta existente com o mesmo email
      const existingByEmail = await this.userRepository.findOne({
        where: { email: profile.email },
      });

      if (existingByEmail) {
        if (existingByEmail.clerk_id && existingByEmail.clerk_id !== profile.clerkId) {
          throw new ConflictException(
            'Este email já está ligado a outra conta social. Faça login normalmente.',
          );
        }
        existingByEmail.clerk_id = profile.clerkId;
        existingByEmail.avatar_url =
          existingByEmail.avatar_url ?? profile.avatarUrl;
        user = await this.userRepository.save(existingByEmail);
      } else {
        // Primeira vez: cria a conta. password_hash fica nulo (só login social).
        const newUser = this.userRepository.create({
          name: profile.name,
          email: profile.email,
          clerk_id: profile.clerkId,
          user_type: dto.user_type || 'customer',
          is_email_verified: true,
        });
        if (profile.avatarUrl) {
          newUser.avatar_url = profile.avatarUrl;
        }
        user = await this.userRepository.save(newUser);
      }
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        user_type: user.user_type,
        avatar_url: user.avatar_url,
      },
      ...tokens,
    };
  }

  /**
   * Liga uma conta Clerk (Google/Apple) ao utilizador autenticado atual,
   * permitindo depois login social na mesma conta.
   */
  async linkClerkAccount(userId: string, clerkToken: string) {
    const profile: ClerkProfile = await this.clerkAuthService.verifySessionToken(
      clerkToken,
    );

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    const takenByOther = await this.userRepository.findOne({
      where: { clerk_id: profile.clerkId },
    });
    if (takenByOther && takenByOther.id !== userId) {
      throw new ConflictException('Esta conta social já está ligada a outro utilizador');
    }

    user.clerk_id = profile.clerkId;
    user.avatar_url = user.avatar_url ?? profile.avatarUrl;
    user.is_email_verified = true;
    await this.userRepository.save(user);

    return {
      message: 'Conta social ligada com sucesso',
      clerk_provider_email: profile.email,
    };
  }

  /**
   * Desliga a conta social (Clerk) do utilizador autenticado.
   * Só é possível se a conta tiver senha definida (não ficar sem login possível).
   */
  async unlinkClerkAccount(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    if (!user.clerk_id) {
      throw new BadRequestException('A conta não está ligada a nenhuma conta social');
    }

    if (!user.password_hash) {
      throw new BadRequestException(
        'Defina uma senha antes de desligar a conta social, caso contrário perde o acesso',
      );
    }

    user.clerk_id = null;
    await this.userRepository.save(user);

    return { message: 'Conta social desligada com sucesso' };
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'password_hash', 'user_type'],
    });

    if (
      user &&
      user.password_hash &&
      (await bcrypt.compare(pass, user.password_hash))
    ) {
      const { password_hash, clerk_id, ...result } = user;
      return result;
    }
    return null;
  }

  async refreshToken(refreshToken: string) {
    try {
      const isBlacklisted = await this.redisService.isTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new UnauthorizedException('Refresh token revogado');
      }

      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Utilizador não encontrado');
      }

      const oldPayload = this.jwtService.decode(refreshToken) as any;
      const oldExp = oldPayload?.exp - Math.floor(Date.now() / 1000);
      if (oldExp > 0) {
        await this.redisService.blacklistToken(refreshToken, oldExp);
      }

      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

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
        // Ignorar se o token for inválido
      }
    }

    await this.redisService.delPattern(`user:${userId}:*`);
    return { message: 'Logout efetuado com sucesso' };
  }

  async processChangePassword(dto: ChangePasswordDto, authHeader?: string) {
    let targetEmail = dto.email;

    if (dto.reset_token) {
      const emailFromRedis = await this.redisService.get(`reset_token:${dto.reset_token}`);
      if (!emailFromRedis) {
        throw new BadRequestException('Token de redefinição inválido ou expirado');
      }
      targetEmail = typeof emailFromRedis === 'string' ? emailFromRedis : String(emailFromRedis);
      await this.redisService.del(`reset_token:${dto.reset_token}`);
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        const user = await this.userRepository.findOne({ where: { id: payload.sub } });
        if (user) {
          targetEmail = user.email;
          if (dto.current_password) {
            const isMatch =
              !!user.password_hash &&
              (await bcrypt.compare(dto.current_password, user.password_hash));
            if (!isMatch) {
              throw new BadRequestException('A senha atual está incorreta');
            }
          }
        }
      } catch {
        throw new UnauthorizedException('Sessão expirada ou inválida');
      }
    }

    if (!targetEmail) {
      throw new BadRequestException('Não foi possível identificar o utilizador para alteração de senha');
    }

    const userToUpdate = await this.userRepository.findOne({ where: { email: targetEmail } });
    if (!userToUpdate) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    const salt = await bcrypt.genSalt(12);
    userToUpdate.password_hash = await bcrypt.hash(dto.new_password, salt);
    await this.userRepository.save(userToUpdate);

    return { message: 'Senha alterada com sucesso' };
  }

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
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}
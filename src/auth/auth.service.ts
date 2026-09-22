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

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
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

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'password_hash', 'user_type'],
    });

    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      const { password_hash, ...result } = user;
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
            const isMatch = await bcrypt.compare(dto.current_password, user.password_hash);
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
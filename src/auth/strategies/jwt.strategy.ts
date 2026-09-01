import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity.js';
import { RedisService } from '../../common/redis/redis.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret'),
    });
  }

  async validate(payload: any) {
    // Verificar se o token está na blacklist (logout)
    const tokenBlacklisted = await this.redisService.isTokenBlacklisted(
      `${payload.sub}:${payload.iat}`,
    );

    if (tokenBlacklisted) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Utilizador não encontrado');
    }

    // Retornar o utilizador (será adicionado ao request.user)
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      user_type: user.user_type,
    };
  }
}

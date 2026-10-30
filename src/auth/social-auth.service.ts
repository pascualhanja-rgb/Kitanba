import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type SocialProvider = 'google' | 'apple';

export interface SocialProfile {
  provider: SocialProvider;
  /** sub do fornecedor: ID do Google (google_id) ou ID da Apple (apple_id) */
  socialId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Validação nativa de tokens sociais, sem intermediários de terceiros (sem Clerk).
 *
 * - Google: o Flutter (google_sign_in) obtém o ID Token e o backend valida-o
 *   criptograficamente com a google-auth-library (assinatura + audiência).
 * - Apple: o Flutter (sign_in_with_apple) obtém o ID Token e o backend valida-o
 *   via JWKS público da Apple (https://appleid.apple.com/auth/keys).
 */
@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  private readonly googleClient: OAuth2Client | null = null;
  private readonly googleClientIds: string[] = [];
  private readonly appleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  private readonly appleClientId: string | null = null;

  constructor(configService: ConfigService) {
    const googleWeb = configService.get<string>('GOOGLE_CLIENT_ID_WEB');
    const googleAndroid = configService.get<string>('GOOGLE_CLIENT_ID_ANDROID');
    this.googleClientIds = [googleWeb, googleAndroid].filter(
      (id): id is string => !!id,
    );
    if (this.googleClientIds.length > 0) {
      this.googleClient = new OAuth2Client();
    } else {
      this.logger.warn(
        'GOOGLE_CLIENT_ID_WEB/GOOGLE_CLIENT_ID_ANDROID não configuradas — login social com Google desativado',
      );
    }

    const appleClientId = configService.get<string>('APPLE_CLIENT_ID');
    if (appleClientId) {
      this.appleJwks = createRemoteJWKSet(
        new URL('https://appleid.apple.com/auth/keys'),
      );
      this.appleClientId = appleClientId;
    } else {
      this.logger.warn(
        'APPLE_CLIENT_ID não configurada — login social com Apple desativado (preencher quando a conta de programador pago estiver ativa)',
      );
    }
  }

  async verifyToken(
    provider: SocialProvider,
    token: string,
  ): Promise<SocialProfile> {
    switch (provider) {
      case 'google':
        return this.verifyGoogleToken(token);
      case 'apple':
        return this.verifyAppleToken(token);
      default:
        throw new UnauthorizedException('Fornecedor social não suportado');
    }
  }

  /**
   * Valida o ID Token do Google (obtido nativamente no Flutter) e devolve o perfil.
   * Aceita tokens emitidos para a app Web ou Android (GOOGLE_CLIENT_ID_WEB/ANDROID).
   */
  private async verifyGoogleToken(token: string): Promise<SocialProfile> {
    if (!this.googleClient) {
      throw new UnauthorizedException(
        'Autenticação com Google não configurada no servidor',
      );
    }

    let payload: TokenPayload | undefined;
    let lastError: unknown;
    for (const audience of this.googleClientIds) {
      try {
        const ticket = await this.googleClient.verifyIdToken({
          idToken: token,
          audience,
        });
        payload = ticket.getPayload();
        if (payload) break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!payload || !payload.email) {
      this.logger.warn(
        `Token do Google inválido: ${
          lastError instanceof Error ? lastError.message : 'payload sem email'
        }`,
      );
      throw new UnauthorizedException('Token do Google inválido ou expirado');
    }

    const name =
      payload.name ||
      [payload.given_name, payload.family_name].filter(Boolean).join(' ') ||
      payload.email.split('@')[0];

    return {
      provider: 'google',
      socialId: payload.sub,
      email: payload.email,
      name,
      avatarUrl: payload.picture || null,
    };
  }

  /**
   * Valida o ID Token da Apple via JWKS público da Apple.
   * Verifica assinatura, issuer (https://appleid.apple.com) e audiência (APPLE_CLIENT_ID).
   */
  private async verifyAppleToken(token: string): Promise<SocialProfile> {
    if (!this.appleJwks || !this.appleClientId) {
      throw new UnauthorizedException(
        'Autenticação com Apple não configurada no servidor',
      );
    }

    try {
      const { payload } = await jwtVerify(token, this.appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience: this.appleClientId,
      });

      const email = typeof payload.email === 'string' ? payload.email : null;
      const sub = typeof payload.sub === 'string' ? payload.sub : null;
      if (!email || payload.email_verified === false || !sub) {
        throw new UnauthorizedException(
          'A conta Apple não possui email verificado',
        );
      }

      // A Apple só envia name/picture na primeira resposta do app (não no ID token);
      // o nome inicial fica com o prefixo do email.
      return {
        provider: 'apple',
        socialId: sub,
        email,
        name: email.split('@')[0],
        avatarUrl: null,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(`Token da Apple inválido: ${(error as Error).message}`);
      throw new UnauthorizedException('Token da Apple inválido ou expirado');
    }
  }
}

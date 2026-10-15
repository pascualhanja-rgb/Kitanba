import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';

export interface ClerkProfile {
  clerkId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class ClerkAuthService {
  private readonly logger = new Logger(ClerkAuthService.name);
  private clerkClient: ClerkClient;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    const publishableKey = this.configService.get<string>('CLERK_PUBLISHABLE_KEY');
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');

    if (publishableKey && secretKey) {
      this.clerkClient = createClerkClient({ publishableKey, secretKey });
      this.secretKey = secretKey;
    } else {
      this.logger.warn(
        'CLERK_PUBLISHABLE_KEY/CLERK_SECRET_KEY não configuradas — autenticação social (Google/Apple) desativada',
      );
    }
  }

  get isEnabled(): boolean {
    return !!this.clerkClient;
  }

  /**
   * Valida o token de sessão emitido pelo Clerk no frontend
   * (login com Google ou Apple) e devolve o perfil do utilizador Clerk.
   */
  async verifySessionToken(token: string): Promise<ClerkProfile> {
    if (!this.clerkClient) {
      throw new UnauthorizedException('Autenticação social não configurada no servidor');
    }

    let payload: { sub: string };
    try {
      payload = await verifyToken(token, { secretKey: this.secretKey });
    } catch (error) {
      this.logger.warn(`Token Clerk inválido: ${(error as Error).message}`);
      throw new UnauthorizedException('Token do Clerk inválido ou expirado');
    }

    const clerkUser = await this.clerkClient.users.getUser(payload.sub);
    if (!clerkUser) {
      throw new UnauthorizedException('Utilizador do Clerk não encontrado');
    }

    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );
    const email = primaryEmail?.emailAddress;
    if (!email) {
      throw new UnauthorizedException('A conta social não possui email associado');
    }

    return {
      clerkId: clerkUser.id,
      email,
      name:
        clerkUser.fullName ||
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
        email.split('@')[0],
      avatarUrl: clerkUser.imageUrl || null,
    };
  }
}

import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerGuardImpl extends ThrottlerGuard {
  // TODO(temporário): rate limit global DESATIVADO durante testes — os clientes
  // estavam a ser bloqueados pelo limite de 20 req/min por IP mesmo nas rotas
  // com @SkipThrottle() individual. REVERTER para super.canActivate(context)
  // quando os testes terminarem.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return true;
  }
}

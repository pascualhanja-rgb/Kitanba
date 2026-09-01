import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerGuardImpl extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clientIp = request.ip || request.headers['x-forwarded-for'] || 'unknown';

    // Log para monitoramento (não expor ao cliente)
    console.log(`[Rate Limit] IP: ${clientIp} - ${request.method} ${request.url}`);

    return super.canActivate(context);
  }
}

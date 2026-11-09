import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerGuardImpl extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return super.canActivate(context);
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { UserOtp } from '../users/entities/user-otp.entity.js';
import { CustomerPasswordReset } from '../users/entities/customer-password-reset.entity.js';
import { User } from '../users/entities/user.entity.js';
import { EmailService } from '../email/email.service.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class OtpsService {
  private readonly logger = new Logger(OtpsService.name);
  private readonly OTP_MAX_ATTEMPTS = 5;
  private readonly OTP_LOCKOUT_MINUTES = 15;

  constructor(
    @InjectRepository(UserOtp)
    private readonly otpRepository: Repository<UserOtp>,
    @InjectRepository(CustomerPasswordReset)
    private readonly passwordResetRepository: Repository<CustomerPasswordReset>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Gerar OTP de 6 dígitos
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Verificar tentativas de OTP (brute force)
   */
  private async checkOtpAttempts(
    identifier: string,
  ): Promise<{ allowed: boolean; attemptsLeft: number }> {
    const key = `otp:attempts:${identifier}`;
    const current = await this.redisService.get<number>(key);
    const attempts = current || 0;

    if (attempts >= this.OTP_MAX_ATTEMPTS) {
      return { allowed: false, attemptsLeft: 0 };
    }

    return {
      allowed: true,
      attemptsLeft: this.OTP_MAX_ATTEMPTS - attempts,
    };
  }

  /**
   * Registar tentativa de OTP
   */
  private async recordOtpAttempt(identifier: string): Promise<void> {
    const key = `otp:attempts:${identifier}`;
    await this.redisService.incr(
      key,
      this.OTP_LOCKOUT_MINUTES * 60,
    );
  }

  /**
   * Limpar tentativas de OTP (após sucesso)
   */
  private async clearOtpAttempts(identifier: string): Promise<void> {
    const key = `otp:attempts:${identifier}`;
    await this.redisService.del(key);
  }

  /**
   * Enviar OTP de ativação de conta
   */
  async sendAccountActivationOtp(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    if (user.is_email_verified) {
      throw new BadRequestException('Email já verificado');
    }

    // Verificar tentativas
    const { allowed } = await this.checkOtpAttempts(
      `activation:${userId}`,
    );
    if (!allowed) {
      throw new BadRequestException(
        'Muitas tentativas. Aguarde 15 minutos antes de solicitar um novo código.',
      );
    }

    // Invalidar OTPs anteriores do mesmo propósito
    await this.otpRepository.update(
      { user_id: userId, purpose: 'account_activation', is_used: false },
      { is_used: true },
    );

    // Gerar novo OTP
    const otpCode = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Expira em 15 minutos

    const otp = this.otpRepository.create({
      user_id: userId,
      otp_code: otpCode,
      purpose: 'account_activation',
      expires_at: expiresAt,
    });

    await this.otpRepository.save(otp);

    // Enviar email
    await this.emailService.sendAccountActivationOtp(
      user.email,
      otpCode,
      user.name,
    );

    this.logger.log(`OTP de ativação enviado para ${user.email}`);

    return { message: 'Código de verificação enviado' };
  }

  /**
   * Verificar OTP de ativação com proteção contra brute force
   */
  async verifyAccountActivationOtp(userId: string, otpCode: string) {
    // Verificar tentativas
    const { allowed, attemptsLeft } = await this.checkOtpAttempts(
      `verify-activation:${userId}`,
    );
    if (!allowed) {
      throw new BadRequestException(
        'Muitas tentativas de verificação. Aguarde 15 minutos.',
      );
    }

    const otp = await this.otpRepository.findOne({
      where: {
        user_id: userId,
        purpose: 'account_activation',
        is_used: false,
        expires_at: MoreThan(new Date()),
      },
      order: { created_at: 'DESC' },
    });

    if (!otp || otp.otp_code !== otpCode) {
      await this.recordOtpAttempt(`verify-activation:${userId}`);
      throw new BadRequestException(
        `Código inválido ou expirado. Restam ${attemptsLeft - 1} tentativas.`,
      );
    }

    // OTP correto: limpar tentativas
    await this.clearOtpAttempts(`verify-activation:${userId}`);

    // Marcar OTP como usado
    otp.is_used = true;
    await this.otpRepository.save(otp);

    // Ativar email do utilizador
    await this.userRepository.update(userId, { is_email_verified: true });

    this.logger.log(`Email verificado para utilizador ${userId}`);

    return { message: 'Email verificado com sucesso' };
  }

  /**
   * Solicitar reset de senha (clientes) - com proteção de taxa
   */
  async requestPasswordReset(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    // Sempre retornar mensagem genérica (não revelar se o email existe)
    if (!user) {
      return { message: 'Se o email estiver registado, receberá um código' };
    }

    // Verificar tentativas
    const { allowed } = await this.checkOtpAttempts(
      `password-reset:${email}`,
    );
    if (!allowed) {
      // Mesmo bloqueado, retornar a mesma mensagem genérica
      return { message: 'Se o email estiver registado, receberá um código' };
    }

    // Invalidar tokens anteriores
    await this.passwordResetRepository.update(
      { user_id: user.id, is_used: false },
      { is_used: true },
    );

    // Gerar OTP
    const otpCode = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const resetToken = this.passwordResetRepository.create({
      user_id: user.id,
      token: otpCode,
      expires_at: expiresAt,
    });

    await this.passwordResetRepository.save(resetToken);

    // Enviar email
    await this.emailService.sendPasswordResetOtp(
      user.email,
      otpCode,
      user.name,
    );

    this.logger.log(`Reset de senha solicitado para ${email}`);

    return { message: 'Se o email estiver registado, receberá um código' };
  }

  /**
   * Verificar OTP de reset de senha com proteção contra brute force
   */
  async verifyPasswordResetOtp(email: string, otpCode: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException('Email não encontrado');
    }

    // Verificar tentativas
    const { allowed, attemptsLeft } = await this.checkOtpAttempts(
      `verify-reset:${email}`,
    );
    if (!allowed) {
      throw new BadRequestException(
        'Muitas tentativas de verificação. Aguarde 15 minutos.',
      );
    }

    const resetToken = await this.passwordResetRepository.findOne({
      where: {
        user_id: user.id,
        is_used: false,
        expires_at: MoreThan(new Date()),
      },
      order: { created_at: 'DESC' },
    });

    if (!resetToken || resetToken.token !== otpCode) {
      await this.recordOtpAttempt(`verify-reset:${email}`);
      throw new BadRequestException(
        `Código inválido ou expirado. Restam ${attemptsLeft - 1} tentativas.`,
      );
    }

    // OTP correto: limpar tentativas
    await this.clearOtpAttempts(`verify-reset:${email}`);

    // Marcar como usado
    resetToken.is_used = true;
    await this.passwordResetRepository.save(resetToken);

    // Gerar token temporário para redefinir senha
    const tempToken = uuidv4();
    const tempExpiresAt = new Date();
    tempExpiresAt.setMinutes(tempExpiresAt.getMinutes() + 10);

    const tempReset = this.passwordResetRepository.create({
      user_id: user.id,
      token: tempToken,
      expires_at: tempExpiresAt,
    });

    await this.passwordResetRepository.save(tempReset);

    return {
      message: 'Código verificado',
      reset_token: tempToken,
    };
  }
}

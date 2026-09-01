import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SibApiV3Sdk = require('sib-api-v3-sdk') as any;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiInstance: any;

  constructor(private readonly configService: ConfigService) {
    // Configurar Brevo API
    const apiKey = SibApiV3Sdk.ApiClient.instance.authentications['api-key'];
    apiKey.apiKey = this.configService.get<string>('BREVO_API_KEY');

    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  }

  /**
   * Enviar email genérico
   */
  async sendEmail(to: string, subject: string, htmlContent: string) {
    const fromEmail = this.configService.get<string>('BREVO_FROM');
    const appName = this.configService.get<string>('APP_NAME', 'Kitanda');

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = { name: appName, email: fromEmail };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;

    try {
      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Email enviado para ${to}: ${subject}`);
      return result;
    } catch (error) {
      this.logger.error(`Erro ao enviar email para ${to}`, error);
      throw error;
    }
  }

  /**
   * Enviar OTP de ativação de conta
   */
  async sendAccountActivationOtp(email: string, otpCode: string, userName: string) {
    const appName = this.configService.get<string>('APP_NAME', 'Kitanda');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Bem-vindo ao ${appName}!</h2>
        <p>Olá ${userName},</p>
        <p>O seu código de verificação é:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 5px;">${otpCode}</span>
        </div>
        <p style="color: #666;">Este código expira em 15 minutos.</p>
        <p style="color: #666;">Se não solicitou esta verificação, ignore este email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">© ${appName}. Todos os direitos reservados.</p>
      </div>
    `;

    return this.sendEmail(email, `Código de Verificação - ${appName}`, htmlContent);
  }

  /**
   * Enviar OTP de reset de senha
   */
  async sendPasswordResetOtp(email: string, otpCode: string, userName: string) {
    const appName = this.configService.get<string>('APP_NAME', 'Kitanda');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Reset de Palavra-passe</h2>
        <p>Olá ${userName},</p>
        <p>O seu código para redefinir a palavra-passe é:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 5px;">${otpCode}</span>
        </div>
        <p style="color: #666;">Este código expira em 15 minutos.</p>
        <p style="color: #ff0000;">Se não solicitou esta alteração, proteja imediatamente a sua conta.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">© ${appName}. Todos os direitos reservados.</p>
      </div>
    `;

    return this.sendEmail(email, `Reset de Palavra-passe - ${appName}`, htmlContent);
  }

  /**
   * Enviar notificação de aprovação de loja
   */
  async sendStoreApprovalEmail(
    email: string,
    storeName: string,
    userName: string,
    approved: boolean,
  ) {
    const appName = this.configService.get<string>('APP_NAME', 'Kitanda');

    const status = approved ? 'aprovada' : 'rejeitada';
    const color = approved ? '#28a745' : '#dc3545';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Estado da Loja</h2>
        <p>Olá ${userName},</p>
        <p>A sua loja <strong>${storeName}</strong> foi <span style="color: ${color}; font-weight: bold;">${status}</span>.</p>
        ${approved 
          ? '<p>Pode começar a publicar os seus produtos agora!</p>' 
          : '<p>Por favor, contacte o suporte para mais informações.</p>'
        }
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">© ${appName}. Todos os direitos reservados.</p>
      </div>
    `;

    return this.sendEmail(
      email,
      `Estado da Loja ${storeName} - ${appName}`,
      htmlContent,
    );
  }
}

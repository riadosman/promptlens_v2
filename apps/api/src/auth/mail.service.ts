import { Injectable } from '@nestjs/common';
import { parseRuntimeConfig } from '@promptlens/config';
import { createLogger } from '@promptlens/observability';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly config = parseRuntimeConfig(process.env);
  private readonly logger = createLogger('mail', this.config.LOG_LEVEL);
  private readonly transporter: Transporter | null;

  constructor() {
    this.transporter = this.config.SMTP_HOST
      ? nodemailer.createTransport({
          host: this.config.SMTP_HOST,
          port: this.config.SMTP_PORT,
          secure: this.config.SMTP_SECURE,
          ...(this.config.SMTP_USER && this.config.SMTP_PASSWORD
            ? { auth: { user: this.config.SMTP_USER, pass: this.config.SMTP_PASSWORD } }
            : {}),
        })
      : null;
  }

  sendVerification(email: string, token: string): Promise<void> {
    return this.send(
      email,
      'Verify your PromptLens email',
      `${this.config.WEB_ORIGIN}/verify-email?token=${encodeURIComponent(token)}`,
    );
  }

  sendPasswordReset(email: string, token: string): Promise<void> {
    return this.send(
      email,
      'Reset your PromptLens password',
      `${this.config.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`,
    );
  }

  private async send(to: string, subject: string, actionUrl: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn({ recipientDomain: to.split('@')[1] }, 'Email delivery is not configured');
      return;
    }
    await this.transporter.sendMail({
      from: this.config.SMTP_FROM,
      to,
      subject,
      text: `${subject}: ${actionUrl}`,
      html: `<p>${subject}</p><p><a href="${actionUrl}">Continue securely</a></p>`,
    });
  }
}

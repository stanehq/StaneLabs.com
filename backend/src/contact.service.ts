import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { ContactDto } from './contact.dto';

@Injectable()
export class ContactService {
  private readonly transport: Transporter | null;
  private readonly recipient: string;
  private readonly sender: string;

  constructor(private readonly config: ConfigService) {
    this.recipient = config.get<string>('SECURITY_EMAIL') || 'security@stanelabs.com';
    this.sender = config.get<string>('SMTP_FROM') || '';
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    this.transport = host && user && pass && this.sender ? nodemailer.createTransport({
      host,
      port: config.get<number>('SMTP_PORT') || 587,
      secure: config.get<boolean>('SMTP_SECURE') === true,
      requireTLS: config.get<boolean>('SMTP_SECURE') !== true,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    }) : null;
  }

  configured(): boolean { return this.transport !== null; }

  async send(dto: ContactDto): Promise<{ status: 'sent' }> {
    if (!this.transport) throw new ServiceUnavailableException('El contacto directo todavía no está disponible. Puedes escribir a security@stanelabs.com.');
    try {
      const result = await this.transport.sendMail({
        from: this.sender,
        to: this.recipient,
        replyTo: dto.email,
        subject: `StaneLabs — ${dto.topic}`,
        text: `Consulta desde el sitio de StaneLabs\n\nNombre: ${dto.name}\nCorreo: ${dto.email}\nÁrea: ${dto.topic}\n\n${dto.message}\n`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      // An SMTP acceptance is the success boundary. Inbox placement cannot be guaranteed.
      const accepted = Array.isArray(result.accepted) ? result.accepted.map((value: unknown) => typeof value === 'string' ? value.toLowerCase() : '') : [];
      if (!accepted.includes(this.recipient.toLowerCase())) throw new Error('SMTP recipient was not accepted.');
      return { status: 'sent' };
    } catch {
      // Do not log the SMTP exception: it may contain addresses, message content or credentials.
      throw new ServiceUnavailableException('No se pudo entregar el mensaje. Inténtalo más tarde o utiliza el correo de seguridad.');
    }
  }
}

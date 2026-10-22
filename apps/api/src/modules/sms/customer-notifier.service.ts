import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';

export type NotifyChannel = 'sms' | 'email' | 'none';

export interface NotifyResult {
  channel: NotifyChannel;
  sent: boolean;
  reason?: string;
}

export interface NotifyInput {
  phone?: string | null;
  email?: string | null;
  smsBody: string;
  emailSubject: string;
  emailHtml: string;
  /** Idempotencia del SMS: evita avisar dos veces si el cobro se reintenta. */
  clientMessageId?: string;
  /** Solo para el log, para saber a que aviso corresponde. */
  context?: string;
}

/**
 * Decide POR DONDE avisarle al cliente, en un solo lugar.
 *
 * Regla: si tiene telefono va por SMS; si no, pero tiene correo, va por email;
 * si no tiene ninguno, se omite y queda en el log.
 *
 * La decision vive aqui y no en cada punto de disparo (pagos, cuentas por
 * cobrar) para que no se desincronicen cuando cambie la regla.
 */
@Injectable()
export class CustomerNotifierService {
  private readonly logger = new Logger(CustomerNotifierService.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
  ) {}

  async notify(input: NotifyInput): Promise<NotifyResult> {
    const ctx = input.context ? ` (${input.context})` : '';

    if (input.phone?.trim()) {
      const res = await this.smsService.send(
        input.phone,
        input.smsBody,
        input.clientMessageId,
      );
      if (res.sent) return { channel: 'sms', sent: true };

      // El telefono existe pero no sirve (fijo, mal escrito, pasarela caida):
      // se intenta el correo antes de rendirse, si lo hay.
      this.logger.warn(`SMS no enviado${ctx}: ${res.reason}`);
      if (!input.email?.trim()) {
        return { channel: 'sms', sent: false, reason: res.reason };
      }
    }

    if (input.email?.trim()) {
      const res = await this.emailService.send(
        input.email,
        input.emailSubject,
        input.emailHtml,
      );
      return { channel: 'email', sent: res.sent, reason: res.reason };
    }

    this.logger.log(`Cliente sin telefono ni correo, aviso omitido${ctx}`);
    return { channel: 'none', sent: false, reason: 'sin telefono ni correo' };
  }
}

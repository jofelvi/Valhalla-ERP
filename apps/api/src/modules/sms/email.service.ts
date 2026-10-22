import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Envio de correo por el microservicio whatsapp-service (mismo VPS).
 *
 * Se reusa a proposito el mismo endpoint que ya usa print-alerts
 * (/api/v1/notifications/email) en vez de meter nodemailer o una cuenta de
 * Gmail: la infraestructura ya existe, esta probada y no agrega credenciales
 * nuevas que mantener.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.configService.get<string>('WHATSAPP_SERVICE_URL') ??
      'http://127.0.0.1:6000'
    );
  }

  private get apiKey(): string {
    return this.configService.get<string>('WHATSAPP_API_KEY') ?? '';
  }

  /** Nunca lanza: un aviso que falla no puede tumbar el cobro. */
  async send(
    to: string | null | undefined,
    subject: string,
    html: string,
  ): Promise<{ sent: boolean; reason?: string }> {
    const dest = (to ?? '').trim();
    // Validacion minima: solo descarta lo que claramente no es un correo,
    // para no gastar una llamada al servicio.
    if (!dest || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) {
      return { sent: false, reason: 'email invalido o vacio' };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/notifications/email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // El servicio exige "Authorization: Bearer <apiKey>". print-alerts
            // manda 'x-api-key' y por eso sus correos vienen fallando con 401.
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ to: dest, subject, html }),
        },
      );

      if (!response.ok) {
        this.logger.warn(`Email a ${dest} fallo (${response.status})`);
        return { sent: false, reason: `http ${response.status}` };
      }

      this.logger.log(`Email enviado a ${dest}`);
      return { sent: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Email a ${dest} fallo: ${msg}`);
      return { sent: false, reason: msg };
    }
  }
}

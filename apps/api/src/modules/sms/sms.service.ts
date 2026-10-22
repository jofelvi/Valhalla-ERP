import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OperacionConfig } from '@odin6/types';
import { celularE164 } from '../../common/operacion/operacion.util';
import { ConfigsService } from '../configs/configs.service';

/**
 * Envio de SMS por sms-bridge (https://github.com/jofelvi/sms-bridge-mobile).
 *
 * Es una pasarela propia y autoalojada: un telefono Android con la app
 * instalada envia los mensajes desde NUESTRA linea. A diferencia de httpSMS
 * (que se uso antes), los mensajes no pasan por un relay de terceros.
 *
 * Hacen falta tres cosas:
 *   1. SMS_BRIDGE_URL   — la URL del servidor sms-bridge
 *   2. SMS_BRIDGE_KEY   — su API_KEY (la del backend, no la del telefono)
 *   3. El telefono-pasarela encendido con la app corriendo
 *
 * Sin esas variables el servicio queda desactivado y solo loguea: nunca
 * revienta el flujo de cobro que lo invoca.
 */
/** Un SMS son 160 caracteres; pasado eso la operadora cobra otro mensaje. */
export const SMS_SEGMENT_CHARS = 160;

export interface SmsResult {
  sent: boolean;
  reason?: string;
  messageId?: string;
  segments: number;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly configs: ConfigsService,
  ) {}

  private get baseUrl(): string {
    return (this.configService.get<string>('SMS_BRIDGE_URL') ?? '').replace(
      /\/+$/,
      '',
    );
  }

  private get apiKey(): string {
    return this.configService.get<string>('SMS_BRIDGE_KEY') ?? '';
  }

  /** Interruptor general: con SMS_ENABLED=false no sale ningun mensaje. */
  private get enabled(): boolean {
    const flag = this.configService.get<string>('SMS_ENABLED');
    if (flag !== undefined) return flag === 'true';
    return Boolean(this.apiKey && this.baseUrl);
  }

  /**
   * Normaliza a E.164 del país de la operación (`configs/operacion`). Ver `celularE164`: solo
   * celulares; fijos y números que no se reconocen devuelven null.
   */
  static toE164(
    raw: string | null | undefined,
    op: OperacionConfig,
  ): string | null {
    return celularE164(raw, op);
  }

  static countSegments(body: string): number {
    return Math.max(1, Math.ceil(body.length / SMS_SEGMENT_CHARS));
  }

  /**
   * Manda un SMS. Nunca lanza: devuelve el resultado para que el llamador
   * decida si loguearlo. Los avisos de cobro no deben tumbar un pago.
   */
  async send(
    to: string | null | undefined,
    body: string,
    clientMessageId?: string,
  ): Promise<SmsResult> {
    const segments = SmsService.countSegments(body);
    const operacion = await this.configs.obtener('operacion');
    const dest = SmsService.toE164(to, operacion);

    if (!dest) {
      return { sent: false, reason: 'telefono invalido o vacio', segments };
    }
    if (!this.enabled) {
      this.logger.log(
        `SMS desactivado (falta SMS_BRIDGE_URL/SMS_BRIDGE_KEY). No enviado a ${dest}: ${body.slice(0, 60)}...`,
      );
      return { sent: false, reason: 'sms desactivado', segments };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        // clientMessageId da idempotencia: si el cobro se reintenta, el
        // cliente no recibe el mismo aviso dos veces.
        body: JSON.stringify({ to: dest, body, clientMessageId }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };

      if (!response.ok) {
        this.logger.error(
          `SMS a ${dest} fallo (${response.status}): ${result.error ?? 'sin detalle'}`,
        );
        return {
          sent: false,
          reason: `http ${response.status}`,
          segments,
        };
      }

      this.logger.log(`SMS encolado para ${dest} (${segments} segmento/s)`);
      return { sent: true, messageId: result.id, segments };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMS a ${dest} fallo: ${msg}`);
      return { sent: false, reason: msg, segments };
    }
  }
}

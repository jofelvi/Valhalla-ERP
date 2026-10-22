import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailDto } from './dto/send-email.dto';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import { SendPagoPendienteDto } from './dto/send-pago-pendiente.dto';
import { SendBudgetDto } from './dto/send-budget.dto';
import { WhatsappLogsService } from '../whatsapp-logs/whatsapp-logs.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappLogs: WhatsappLogsService,
  ) {}

  async sendWelcomeEmail(data: SendEmailDto) {
    try {
      this.logger.log(
        `Sending welcome email to ${data.email} for ${data.name}`,
      );
      return {
        success: true,
        message: `Welcome email queued for ${data.email}`,
        templateUsed: 'welcome',
        recipient: data.email,
      };
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error}`);
      throw error;
    }
  }

  async sendWhatsapp(data: SendWhatsappDto) {
    try {
      this.logger.log(
        `Sending WhatsApp message to ${data.to} using template ${data.template}`,
      );
      return {
        success: true,
        message: `WhatsApp message queued for ${data.to}`,
        template: data.template,
        recipient: data.to,
      };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp: ${error}`);
      throw error;
    }
  }

  /**
   * Envia el template pago_pendiente con PDF adjunto (via whatsapp-service en VPS).
   *
   * Timeout: 30 segundos (PDF puede ser grande, ~5-10 MB). Si falla, devuelve
   * 502 con detalles tecnicos para diagnosticar problemas de conectividad.
   */
  async sendPagoPendiente(data: SendPagoPendienteDto) {
    const whatsappServiceUrl =
      this.configService.get<string>('WHATSAPP_SERVICE_URL') ??
      'http://127.0.0.1:6000';
    const whatsappApiKey =
      this.configService.get<string>('WHATSAPP_API_KEY') ?? '';
    const publicAppUrl = this.configService.get<string>('PUBLIC_APP_URL') ?? '';

    const url = `${whatsappServiceUrl}/api/v1/messages/template`;
    const payload = {
      to: data.to,
      template: 'pago_pendiente',
      language: 'es',
      variables: [data.customerName, data.amount, data.orderCode, data.date],
      headerPdfBase64: data.pdfBase64,
      headerFilename: data.pdfFilename ?? `consumo-${data.orderCode}.pdf`,
      headerMimeType: 'application/pdf',
      buttonUrlParam: data.orderCode,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whatsappApiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        code?: number;
        hint?: string;
        messageId?: string;
        waId?: string;
      };

      if (!response.ok || result.success === false) {
        this.logger.error(
          `WhatsApp pago_pendiente fallo (${response.status}): ${JSON.stringify(result)}`,
        );
        throw new HttpException(
          {
            success: false,
            error: result.error ?? `HTTP ${response.status}`,
            hint: result.hint,
            code: result.code,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.log(
        `pago_pendiente enviado a ${data.to} (orden ${data.orderCode}, wamid=${result.messageId ?? 'N/A'})`,
      );

      // Guardar log para poder rastrear estado via webhook de Meta.
      let logId: string | undefined;
      if (result.messageId) {
        try {
          const doc = await this.whatsappLogs.create({
            messageId: result.messageId,
            to: data.to,
            template: 'pago_pendiente',
            accountReceivableId: data.accountReceivableId,
            customerName: data.customerName,
            orderCode: data.orderCode,
            amount: data.amount,
          });
          logId = String(doc._id);
        } catch (err) {
          this.logger.warn(
            `No se pudo crear log de WhatsApp (wamid=${result.messageId}): ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      return {
        success: true,
        to: data.to,
        orderCode: data.orderCode,
        messageId: result.messageId,
        logId,
        precuentaUrl: `${publicAppUrl}/public/precuenta/${data.orderCode}`,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;

      // Diagnosticar el error (timeout, ECONNREFUSED, DNS, etc.)
      const isTimeoutError = err instanceof Error && err.name === 'AbortError';
      const message = err instanceof Error ? err.message : 'Error desconocido';
      // fetch (undici) lanza "fetch failed" y deja el codigo real
      // (ECONNREFUSED, ENOTFOUND...) en err.cause, no en el error de arriba.
      const rawCause: unknown =
        err instanceof Error
          ? (err as Error & { cause?: unknown }).cause
          : undefined;
      const causeErr =
        rawCause instanceof Error
          ? (rawCause as NodeJS.ErrnoException)
          : undefined;
      const cause = causeErr
        ? { name: causeErr.name, code: causeErr.code, errno: causeErr.errno }
        : undefined;

      const diagnostic = isTimeoutError
        ? 'TIMEOUT (30s excedido — whatsapp-service puede estar caido o saturado)'
        : cause?.code === 'ECONNREFUSED'
          ? `CONEXION RECHAZADA — whatsapp-service no responde en ${whatsappServiceUrl}`
          : cause?.code === 'ENOTFOUND'
            ? `DNS NO RESUELTO — no se puede alcanzar ${whatsappServiceUrl}`
            : `OTRO ERROR (${cause?.name ?? message})`;

      this.logger.error(
        `sendPagoPendiente fallo: ${diagnostic} | details: ${message} | payloadSize: ${Buffer.byteLength(JSON.stringify(payload))} bytes`,
      );

      throw new HttpException(
        {
          success: false,
          error: `No se pudo enviar por WhatsApp: ${diagnostic}`,
          detail: message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Envia un presupuesto por WhatsApp con el PDF adjunto.
   *
   * Dos vias, en este orden:
   *   1. Plantilla aprobada (WHATSAPP_TEMPLATE_BUDGET). Entrega SIEMPRE, tambien
   *      fuera de la ventana de 24h, y lleva el PDF en el header.
   *   2. Texto plano, si la plantilla no existe o Meta la rechaza. Solo entrega
   *      si el cliente escribio en las ultimas 24h y NO puede llevar el PDF.
   *
   * Se devuelve `method` para que la UI diga con exactitud que ocurrio: un envio
   * que no llega es peor que un error visible.
   */
  async sendBudget(data: SendBudgetDto): Promise<{
    success: boolean;
    method: 'template' | 'text';
    to: string;
    budgetNumber: string;
    messageId?: string;
    warning?: string;
  }> {
    const whatsappServiceUrl =
      this.configService.get<string>('WHATSAPP_SERVICE_URL') ??
      'http://127.0.0.1:6000';
    const whatsappApiKey =
      this.configService.get<string>('WHATSAPP_API_KEY') ?? '';
    const templateName =
      this.configService.get<string>('WHATSAPP_TEMPLATE_BUDGET') ??
      'presupuesto';
    const templateLang =
      this.configService.get<string>('WHATSAPP_TEMPLATE_LANG') ?? 'es';

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${whatsappApiKey}`,
    };

    // ── 1. Plantilla con el PDF en el header ──
    try {
      const response = await fetch(
        `${whatsappServiceUrl}/api/v1/messages/template`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: data.to,
            template: templateName,
            language: templateLang,
            variables: [
              data.customerName,
              data.budgetNumber,
              data.eventName,
              data.total,
            ],
            headerPdfBase64: data.pdfBase64,
            headerFilename:
              data.pdfFilename ?? `presupuesto-${data.budgetNumber}.pdf`,
            headerMimeType: 'application/pdf',
          }),
        },
      );

      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        messageId?: string;
      };

      if (response.ok && result.success !== false) {
        this.logger.log(
          `Presupuesto ${data.budgetNumber} enviado a ${data.to} por plantilla ${templateName} (wamid=${result.messageId ?? 'N/A'})`,
        );
        return {
          success: true,
          method: 'template',
          to: data.to,
          budgetNumber: data.budgetNumber,
          messageId: result.messageId,
        };
      }

      this.logger.warn(
        `Plantilla ${templateName} no disponible (${response.status}: ${result.error ?? 'sin detalle'}) — se intenta texto plano`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error desconocido';
      this.logger.warn(
        `Fallo el envio por plantilla (${message}) — se intenta texto plano`,
      );
    }

    // ── 2. Respaldo: texto plano, sin PDF y solo dentro de la ventana de 24h ──
    const text =
      `Hola ${data.customerName}, aqui esta tu presupuesto ` +
      `*${data.budgetNumber}* para *${data.eventName}*, por un total de ` +
      `*${data.total}*.\n\nCualquier duda escribenos.\n*Su negocio*`;

    const response = await fetch(`${whatsappServiceUrl}/api/v1/messages/text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to: data.to, text }),
    });

    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      messageId?: string;
    };

    if (!response.ok) {
      this.logger.error(
        `Presupuesto ${data.budgetNumber} no se pudo enviar a ${data.to}: ${result.error ?? response.status}`,
      );
      throw new HttpException(
        {
          success: false,
          error: result.error ?? `HTTP ${response.status}`,
          hint: `No hay plantilla "${templateName}" aprobada y el texto plano tampoco entro. El texto plano solo llega si el cliente escribio en las ultimas 24h.`,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    this.logger.log(
      `Presupuesto ${data.budgetNumber} enviado a ${data.to} como texto plano (sin PDF)`,
    );
    return {
      success: true,
      method: 'text',
      to: data.to,
      budgetNumber: data.budgetNumber,
      messageId: result.messageId,
      warning:
        'Enviado como texto, SIN el PDF. Para adjuntar el PDF hace falta aprobar la plantilla en Meta.',
    };
  }

  /**
   * Notifica al restaurante una nueva reserva del evento (texto simple via
   * whatsapp-service POST /api/v1/messages/text). Fire-and-forget: el caller
   * decide si bloquea o no.
   */
  async sendReservationAlert(data: {
    tableNumber: number;
    packageLabel: string;
    customerName: string;
    cedula: string;
    phone: string;
    paymentReference: string;
    amountUsd: number;
    amountBs: number;
  }): Promise<void> {
    const notifyPhone = this.configService.get<string>(
      'RESERVATIONS_NOTIFY_PHONE',
    );
    if (!notifyPhone) {
      this.logger.warn(
        'RESERVATIONS_NOTIFY_PHONE no configurado — skip alerta de reserva',
      );
      return;
    }

    const whatsappServiceUrl =
      this.configService.get<string>('WHATSAPP_SERVICE_URL') ??
      'http://127.0.0.1:6000';
    const whatsappApiKey =
      this.configService.get<string>('WHATSAPP_API_KEY') ?? '';

    const text =
      `🎵 *Nueva reserva*\n` +
      `Mesa: *${data.tableNumber}*\n` +
      `Paquete: ${data.packageLabel}\n` +
      `Cliente: ${data.customerName} (CI ${data.cedula})\n` +
      `Teléfono: ${data.phone}\n` +
      `Referencia Pago Móvil: ${data.paymentReference}\n` +
      `Monto: $${data.amountUsd} (Bs ${data.amountBs})`;

    const response = await fetch(`${whatsappServiceUrl}/api/v1/messages/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${whatsappApiKey}`,
      },
      body: JSON.stringify({ to: notifyPhone, text }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`whatsapp-service ${response.status}: ${detail}`);
    }

    this.logger.log(
      `Alerta de reserva enviada a ${notifyPhone} (mesa ${data.tableNumber})`,
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigsService } from '../configs/configs.service';
import { formatearFechaHora } from '../../common/operacion/operacion.util';
import { PrintJob } from './schemas/print-job.schema';
import {
  PrintIncidentType,
  ReportIncidentDto,
} from './dto/report-incident.dto';

/**
 * Envia alertas por correo cuando un job de impresion falla.
 * Reusa el microservicio whatsapp-service-6000 (mismo VPS, /api/v1/notifications/email).
 *
 * Rate-limit in-memory por "estacion" (station/printer) para evitar spam si la
 * impresora se queda toda la noche sin papel — cada printer manda max 1 email
 * por ventana de cooldown (default 10 min). El cooldown se reinicia en cada send.
 */
@Injectable()
export class PrintAlertsService {
  private readonly logger = new Logger(PrintAlertsService.name);
  private readonly lastSentByKey = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly configs: ConfigsService,
  ) {}

  notifyFailure(job: Partial<PrintJob>, errorMessage?: string): void {
    const cooldownMin = Number(
      this.configService.get<string>('PRINT_ALERT_COOLDOWN_MIN') ?? 10,
    );
    const key = `${job.station ?? 'unknown'}|${job.type ?? 'unknown'}`;
    const now = Date.now();
    const last = this.lastSentByKey.get(key) ?? 0;
    if (now - last < cooldownMin * 60 * 1000) {
      this.logger.log(
        `[PrintAlerts] suprimido por cooldown (${cooldownMin}min) key=${key}`,
      );
      return;
    }
    this.lastSentByKey.set(key, now);

    // Fire-and-forget: nunca bloquear el flujo del print-service por errores SMTP.
    void this.sendEmail(job, errorMessage).catch((err) => {
      this.logger.error(
        `[PrintAlerts] fallo enviar email: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  private async sendEmail(
    job: Partial<PrintJob>,
    errorMessage?: string,
  ): Promise<void> {
    const url =
      (this.configService.get<string>('WHATSAPP_SERVICE_URL') ??
        'http://127.0.0.1:6000') + '/api/v1/notifications/email';
    const apiKey = this.configService.get<string>('WHATSAPP_API_KEY') ?? '';
    const overrideTo = this.configService.get<string>('PRINT_ALERT_TO');

    const station = job.station ?? '—';
    const orderNum = job.orderNumber ?? job.orderId ?? '—';
    const table = job.tableName ?? job.tableId ?? '—';
    const waiter = job.waiterName ?? '—';
    const type = job.type ?? '—';
    const itemsHtml = (job.items ?? [])
      .map(
        (it) =>
          `<li>${escapeHtml(String(it.qty ?? 1))}x ${escapeHtml(it.name ?? '')}${it.notes ? ` <em>(${escapeHtml(it.notes)})</em>` : ''}</li>`,
      )
      .join('');
    const operacion = await this.configs.obtener('operacion');
    const when = formatearFechaHora(new Date(), operacion);

    const html = `
      <h2 style="color:#b00020;margin:0 0 12px">Falla de impresion</h2>
      <p>Un job de impresion no se pudo procesar.</p>
      <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td><b>Hora</b></td><td>${escapeHtml(when)}</td></tr>
        <tr><td><b>Tipo</b></td><td>${escapeHtml(type)}</td></tr>
        <tr><td><b>Estacion</b></td><td>${escapeHtml(station)}</td></tr>
        <tr><td><b>Orden</b></td><td>${escapeHtml(String(orderNum))}</td></tr>
        <tr><td><b>Mesa</b></td><td>${escapeHtml(String(table))}</td></tr>
        <tr><td><b>Mesonero</b></td><td>${escapeHtml(waiter)}</td></tr>
        <tr><td valign="top"><b>Error</b></td><td><pre style="white-space:pre-wrap;margin:0">${escapeHtml(errorMessage ?? '(sin mensaje)')}</pre></td></tr>
      </table>
      ${itemsHtml ? `<h3 style="margin:16px 0 4px">Items</h3><ul>${itemsHtml}</ul>` : ''}
      <p style="color:#666;font-size:12px;margin-top:16px">
        Causa probable: impresora sin papel, tapa abierta, USB desconectado o servicio de impresion caido.
        Esta alerta tiene cooldown de ${this.configService.get<string>('PRINT_ALERT_COOLDOWN_MIN') ?? 10} min por estacion.
      </p>
    `;

    const body: Record<string, unknown> = {
      subject: `[POS] Falla impresion ${type} - ${station} (orden ${orderNum})`,
      html,
    };
    if (overrideTo) body.to = overrideTo;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      messageId?: string;
    };

    if (!res.ok || json.success === false) {
      throw new Error(`HTTP ${res.status}: ${json.error ?? 'unknown error'}`);
    }

    this.logger.log(
      `[PrintAlerts] email enviado (messageId=${json.messageId ?? '?'}) para job ${job._id ?? '?'}`,
    );
  }

  /**
   * Alerta de un incidente reportado por la PC de la caja.
   *
   * Va aparte de notifyFailure porque estos incidentes NO son un job fallido:
   * el job llego a marcarse 'done' y el papel nunca salio. Es justo el hueco por
   * el que se colaron 493 comandas de barra entre el 9 y el 16 de agosto.
   */
  notifyIncident(incidente: ReportIncidentDto): void {
    // Una impresora rota genera un incidente cada 5 min toda la noche: sin
    // cooldown el correo se vuelve ruido y nadie lo lee.
    const cooldownMin =
      incidente.tipo === PrintIncidentType.REQUIERE_INTERVENCION
        ? 60
        : Number(
            this.configService.get<string>('PRINT_ALERT_COOLDOWN_MIN') ?? 10,
          );
    const key = `incidente|${incidente.impresora}|${incidente.tipo}`;
    const now = Date.now();
    const last = this.lastSentByKey.get(key) ?? 0;
    if (now - last < cooldownMin * 60 * 1000) {
      this.logger.log(
        `[PrintAlerts] incidente suprimido por cooldown (${cooldownMin}min) key=${key}`,
      );
      return;
    }
    this.lastSentByKey.set(key, now);

    void this.sendIncidentEmail(incidente).catch((err) => {
      this.logger.error(
        `[PrintAlerts] fallo enviar incidente: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  private async sendIncidentEmail(inc: ReportIncidentDto): Promise<void> {
    const url =
      (this.configService.get<string>('WHATSAPP_SERVICE_URL') ??
        'http://127.0.0.1:6000') + '/api/v1/notifications/email';
    const apiKey = this.configService.get<string>('WHATSAPP_API_KEY') ?? '';
    const overrideTo = this.configService.get<string>('PRINT_ALERT_TO');

    const TITULOS: Record<PrintIncidentType, string> = {
      [PrintIncidentType.PURGA]: 'Se botaron tickets de la cola',
      [PrintIncidentType.REDIRECCION]: 'Ticket desviado a otra impresora',
      [PrintIncidentType.PERDIDA]: 'TICKET PERDIDO: no salio por ningun lado',
      [PrintIncidentType.REQUIERE_INTERVENCION]:
        'IMPRESORA MUERTA: hay que ir a la maquina',
    };
    const QUE_HACER: Record<PrintIncidentType, string> = {
      [PrintIncidentType.PURGA]:
        'Revisar si esos tickets salieron. Si la impresora sigue atascada, revisar papel, tapa y cable USB.',
      [PrintIncidentType.REDIRECCION]:
        'El ticket salio por la impresora de respaldo con una banda de aviso. Alguien debe llevarlo a su estacion.',
      [PrintIncidentType.PERDIDA]:
        'Reimprimir la orden a mano desde el POS. La impresora de la estacion y su respaldo estan caidas.',
      [PrintIncidentType.REQUIERE_INTERVENCION]:
        'El ciclado por software no la levanta. Revisar cable, cambiar de puerto USB y correr identificar-impresoras.ps1 para actualizar el mapeo.',
    };

    const operacion = await this.configs.obtener('operacion');
    const when = formatearFechaHora(new Date(), operacion);
    const filas: string[] = [
      `<tr><td><b>Hora</b></td><td>${escapeHtml(when)}</td></tr>`,
      `<tr><td><b>Impresora</b></td><td>${escapeHtml(inc.impresora)}</td></tr>`,
    ];
    if (inc.destino)
      filas.push(
        `<tr><td><b>Salio por</b></td><td>${escapeHtml(inc.destino)}</td></tr>`,
      );
    if (inc.etiqueta)
      filas.push(
        `<tr><td><b>Estacion</b></td><td>${escapeHtml(inc.etiqueta)}</td></tr>`,
      );
    if (inc.orderNumber)
      filas.push(
        `<tr><td><b>Orden</b></td><td>${escapeHtml(inc.orderNumber)}</td></tr>`,
      );
    if (inc.table)
      filas.push(
        `<tr><td><b>Mesa</b></td><td>${escapeHtml(inc.table)}</td></tr>`,
      );
    if (inc.waiterName)
      filas.push(
        `<tr><td><b>Mesonero</b></td><td>${escapeHtml(inc.waiterName)}</td></tr>`,
      );
    if (inc.motivo)
      filas.push(
        `<tr><td><b>Motivo</b></td><td>${escapeHtml(inc.motivo)}</td></tr>`,
      );
    if (inc.desde)
      filas.push(
        `<tr><td><b>Caida desde</b></td><td>${escapeHtml(
          formatearFechaHora(new Date(inc.desde), operacion),
        )}</td></tr>`,
      );
    if (inc.conector)
      filas.push(
        `<tr><td><b>Conector</b></td><td><code>${escapeHtml(inc.conector)}</code></td></tr>`,
      );
    if (typeof inc.intentos === 'number')
      filas.push(
        `<tr><td><b>Intentos fallidos</b></td><td>${inc.intentos}</td></tr>`,
      );
    if (inc.equipo)
      filas.push(
        `<tr><td><b>Equipo</b></td><td>${escapeHtml(inc.equipo)}</td></tr>`,
      );

    const trabajosHtml = (inc.trabajos ?? [])
      .map(
        (t) =>
          `<li>#${escapeHtml(t.id ?? '?')} ${escapeHtml(t.papel ?? '')} — enviado ${escapeHtml(
            t.enviado ?? '?',
          )} (${escapeHtml(t.estado ?? '?')})</li>`,
      )
      .join('');

    const html = `
      <h2 style="color:#b00020;margin:0 0 12px">${escapeHtml(TITULOS[inc.tipo])}</h2>
      <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        ${filas.join('\n')}
      </table>
      ${trabajosHtml ? `<h3 style="margin:16px 0 4px">Tickets botados de la cola</h3><ul>${trabajosHtml}</ul>` : ''}
      <p style="margin-top:16px"><b>Que hacer:</b> ${escapeHtml(QUE_HACER[inc.tipo])}</p>
      <p style="color:#666;font-size:12px;margin-top:16px">
        Esta alerta tiene cooldown por impresora para no inundar el correo cuando una impresora
        pasa la noche caida.
      </p>
    `;

    const body: Record<string, unknown> = {
      subject: `[POS] ${TITULOS[inc.tipo]} - ${inc.impresora}`,
      html,
    };
    if (overrideTo) body.to = overrideTo;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      messageId?: string;
    };
    if (!res.ok || json.success === false) {
      throw new Error(`HTTP ${res.status}: ${json.error ?? 'unknown error'}`);
    }
    this.logger.log(
      `[PrintAlerts] incidente '${inc.tipo}' notificado para ${inc.impresora}`,
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

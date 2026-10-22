import { NextRequest, NextResponse } from 'next/server';
import { nombreVisible } from '@odin6/types';
import { obtenerConfigPublica } from '@/lib/configServidor';

interface PrintFailureRequest {
  attemptId: string;
  orderId: string;
  orderNumber: string;
  status: string; // PrintAttemptStatus
  errorMessage?: string;
  printerName?: string;
  station?: string;
  waiterName?: string;
  tableName?: string;
  sector?: string;
  items: Array<{
    name: string;
    qty: number;
    station?: string;
  }>;
  via?: 'local' | 'queue' | null;
}

const STATUS_LABELS: Record<string, string> = {
  service_down: '🔴 Servicio de impresion CAIDO',
  network_error: '🌐 Error de red',
  http_500: '⚠️ Print service devolvio error',
  printer_offline: '🖨️ Impresora OFFLINE',
  printer_paper_out: '📄 Sin papel',
  printer_error: '🚨 Error de impresora',
  exception: '💥 Exception inesperada',
  queued: '📥 Comanda en cola: impresion DESCONECTADA',
};

/**
 * POST /api/alerts/print-failure
 *
 * Recibe info de una falla de impresion y dispara un email al admin via
 * el microservicio whatsapp-service del VPS.
 *
 * Diseñado como fire-and-forget: el caller no debe esperar la respuesta
 * (timeout corto, errores ignorados).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PrintFailureRequest;

    if (!body.attemptId || !body.orderId || !body.status) {
      return NextResponse.json(
        { success: false, error: 'attemptId, orderId y status son requeridos' },
        { status: 400 },
      );
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
    const serviceApiKey = process.env.WHATSAPP_SERVICE_API_KEY;

    if (!serviceUrl || !serviceApiKey) {
      console.error('[print-failure] WHATSAPP_SERVICE_URL no configurado');
      return NextResponse.json(
        { success: false, error: 'Microservicio no configurado' },
        { status: 503 },
      );
    }

    // Construir el email
    const statusLabel = STATUS_LABELS[body.status] ?? body.status;
    const { marca, negocio } = await obtenerConfigPublica();
    const nombre = nombreVisible(marca, negocio);
    const subject = `[${nombre.toUpperCase()}] ${statusLabel} — Orden #${body.orderNumber}`;

    const itemsHtml = body.items
      .map(
        (i) =>
          `<li><strong>${i.qty}×</strong> ${escapeHtml(i.name)} ${i.station ? `<em>(${i.station})</em>` : ''}</li>`,
      )
      .join('');

    const auditUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/private/orders/${body.orderId}/details`;

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, ${marca.palette.light.danger}, ${marca.palette.light.danger}); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">${statusLabel}</h1>
          <p style="margin: 4px 0 0; opacity: 0.9; font-size: 13px;">Orden #${escapeHtml(body.orderNumber)}</p>
        </div>

        <div style="background: white; border: 1px solid #fecaca; border-top: 0; padding: 20px; border-radius: 0 0 8px 8px;">
          ${
            body.errorMessage
              ? `
            <div style="background: ${marca.palette.light.elevated}; border-left: 4px solid ${marca.palette.light.danger}; padding: 12px; margin-bottom: 16px;">
              <strong style="color: ${marca.palette.light.danger}; font-size: 12px;">ERROR:</strong>
              <p style="margin: 4px 0 0; font-family: monospace; font-size: 12px; color: #7f1d1d;">${escapeHtml(body.errorMessage)}</p>
            </div>
          `
              : ''
          }

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
            <tr><td style="padding: 4px 0; color: #6b7280;">Mesa/Sector:</td><td style="padding: 4px 0; font-weight: 600;">${escapeHtml(body.tableName ?? body.sector ?? 'N/A')}</td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280;">Mesonero:</td><td style="padding: 4px 0; font-weight: 600;">${escapeHtml(body.waiterName ?? 'N/A')}</td></tr>
            ${body.printerName ? `<tr><td style="padding: 4px 0; color: #6b7280;">Impresora:</td><td style="padding: 4px 0; font-weight: 600;">${escapeHtml(body.printerName)}</td></tr>` : ''}
            ${body.station ? `<tr><td style="padding: 4px 0; color: #6b7280;">Estación:</td><td style="padding: 4px 0; font-weight: 600;">${escapeHtml(body.station)}</td></tr>` : ''}
            <tr><td style="padding: 4px 0; color: #6b7280;">Attempt ID:</td><td style="padding: 4px 0; font-family: monospace; font-size: 11px;">${escapeHtml(body.attemptId)}</td></tr>
          </table>

          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #92400e; text-transform: uppercase;">Items afectados (${body.items.length})</p>
            <ul style="margin: 0; padding-left: 20px; color: #78350f;">
              ${itemsHtml}
            </ul>
          </div>

          <div style="text-align: center; margin-top: 20px;">
            <a href="${auditUrl}" style="display: inline-block; background: ${marca.palette.light.primary}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
              Ver auditoría completa →
            </a>
          </div>

          <p style="margin: 16px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">
            ${nombre} · Sistema de auditoría de impresión
          </p>
        </div>
      </div>
    `;

    const text = `${statusLabel} — Orden #${body.orderNumber}

Mesa/Sector: ${body.tableName ?? body.sector ?? 'N/A'}
Mesonero: ${body.waiterName ?? 'N/A'}
${body.printerName ? `Impresora: ${body.printerName}\n` : ''}${body.station ? `Estación: ${body.station}\n` : ''}
${body.errorMessage ? `ERROR: ${body.errorMessage}\n` : ''}
Items afectados:
${body.items.map((i) => `  - ${i.qty}× ${i.name}${i.station ? ` (${i.station})` : ''}`).join('\n')}

Audit: ${auditUrl}
Attempt ID: ${body.attemptId}`;

    // Llamar al microservicio (timeout corto)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${serviceUrl}/api/v1/notifications/email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          html,
          text,
          priority: 'high',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error('[print-failure] Email service error:', data);
        return NextResponse.json(
          { success: false, error: data.error || 'Error al enviar email' },
          { status: 502 },
        );
      }

      return NextResponse.json({ success: true, messageId: data.messageId });
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error(
        '[print-failure] Error al llamar al microservicio:',
        message,
      );
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[print-failure POST]', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

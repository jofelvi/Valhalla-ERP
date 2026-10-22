/**
 * Cliente para WhatsApp Cloud API (Meta)
 *
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 *
 * Variables de entorno requeridas:
 *   WHATSAPP_API_VERSION (ej. v22.0)
 *   WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_ACCESS_TOKEN
 */

export interface WhatsAppConfig {
  readonly apiVersion: string;
  readonly phoneNumberId: string;
  readonly accessToken: string;
}

export interface PagoPendienteParams {
  readonly to: string; // E.164 sin '+', ej. 584141234567
  readonly nombreCliente: string;
  readonly monto: string;
  readonly fechaVencimiento: string;
  readonly linkReporte: string; // URL publica para reportar el pago
}

export interface PedidoEntregadoParams {
  readonly to: string; // E.164 sin '+', ej. 584141234567
  readonly nombreCliente: string; // body {{1}}
  readonly orderCode: string; // body {{2}} y button URL {{1}}
}

export interface SendDocumentParams {
  readonly to: string;
  readonly link: string;
  readonly filename: string;
  readonly caption?: string;
}

export interface WhatsAppSendResponse {
  readonly messaging_product: 'whatsapp';
  readonly contacts: ReadonlyArray<{ input: string; wa_id: string }>;
  readonly messages: ReadonlyArray<{ id: string }>;
}

export interface WhatsAppApiError {
  readonly error: {
    readonly message: string;
    readonly type: string;
    readonly code: number;
    readonly error_subcode?: number;
    readonly fbtrace_id: string;
  };
}

export class WhatsAppApiException extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly fbtraceId?: string,
  ) {
    super(message);
    this.name = 'WhatsAppApiException';
  }
}

function loadConfig(): WhatsAppConfig {
  const apiVersion = process.env.WHATSAPP_API_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!apiVersion || !phoneNumberId || !accessToken) {
    throw new Error(
      'Faltan variables de entorno WHATSAPP_API_VERSION, WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN. ' +
        'Si estas usando el microservicio, configura WHATSAPP_SERVICE_URL y WHATSAPP_SERVICE_API_KEY en su lugar.',
    );
  }

  return { apiVersion, phoneNumberId, accessToken };
}

/**
 * Normaliza un teléfono al formato E.164 sin '+' que requiere la API.
 * "0414-1234567" → "584141234567"
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '58' + digits.substring(1);
  } else if (digits.length === 10) {
    digits = '58' + digits;
  }
  return digits;
}

async function callWhatsAppApi(
  body: Record<string, unknown>,
): Promise<WhatsAppSendResponse> {
  const { apiVersion, phoneNumberId, accessToken } = loadConfig();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as WhatsAppSendResponse | WhatsAppApiError;

  if (!res.ok) {
    const err = json as WhatsAppApiError;
    throw new WhatsAppApiException(
      err.error.code,
      err.error.message,
      err.error.fbtrace_id,
    );
  }

  return json as WhatsAppSendResponse;
}

/**
 * Envía un mensaje de plantilla aprobada en Meta Business.
 * Las plantillas son la única forma de iniciar una conversación con un usuario
 * fuera de la ventana de 24 horas.
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  language: string,
  variables: ReadonlyArray<string>,
): Promise<WhatsAppSendResponse> {
  const phone = normalizePhone(to);
  if (!phone) throw new Error('Numero de telefono invalido');

  return callWhatsAppApi({
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: 'body',
          parameters: variables.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  });
}

/**
 * Envia un template usando el microservicio compartido `whatsapp-service`.
 *
 * Requiere:
 *   WHATSAPP_SERVICE_URL      (ej. https://wa.ejemplo.com)
 *   WHATSAPP_SERVICE_API_KEY  (apiKey del negocio en el microservicio)
 */
async function sendViaMicroservice(
  templateName: string,
  language: string,
  to: string,
  variables: ReadonlyArray<string>,
  buttonUrlParam?: string,
  headerUrl?: string,
  headerFilename?: string,
  headerPdfBase64?: string,
): Promise<WhatsAppSendResponse> {
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  const serviceApiKey = process.env.WHATSAPP_SERVICE_API_KEY;

  if (!serviceUrl || !serviceApiKey) {
    throw new Error(
      'Microservicio no configurado: faltan WHATSAPP_SERVICE_URL o WHATSAPP_SERVICE_API_KEY',
    );
  }

  const res = await fetch(`${serviceUrl}/api/v1/messages/template`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      template: templateName,
      language,
      variables,
      ...(buttonUrlParam ? { buttonUrlParam } : {}),
      ...(headerUrl ? { headerUrl } : {}),
      ...(headerFilename ? { headerFilename } : {}),
      ...(headerPdfBase64 ? { headerPdfBase64 } : {}),
    }),
  });

  const json = (await res.json()) as {
    success: boolean;
    messageId?: string;
    waId?: string;
    error?: string;
    code?: number;
    hint?: string;
  };

  if (!res.ok || !json.success) {
    const code = json.code ?? res.status;
    throw new WhatsAppApiException(
      code,
      json.error || `Error del microservicio (HTTP ${res.status})`,
    );
  }

  // Adaptamos al formato de MetaApiResponse
  return {
    messaging_product: 'whatsapp',
    contacts: json.waId ? [{ input: to, wa_id: json.waId }] : [],
    messages: json.messageId ? [{ id: json.messageId }] : [],
  };
}

/**
 * Envía una notificación usando la plantilla aprobada `plantillaprueba`
 * (nombre interno: "pedido entregado", categoría UTILITY).
 *
 * Cuerpo de la plantilla:
 *   "Hola {{1}}, su pedido {{2}} se entregó con éxito.
 *    Puedes administrar tu pedido a continuación."
 *
 * Botón URL dinámico: `Gestionar orden` → URL base + {{1}}
 *
 * Variables:
 *   body {{1}} = nombre cliente
 *   body {{2}} = codigo de pedido (invoiceNumber o similar)
 *   button {{1}} = codigo/slug para la URL del boton
 *
 * Usa el microservicio compartido si `WHATSAPP_SERVICE_URL` esta configurado,
 * sino llama directamente a la API de Meta.
 */
export async function enviarPedidoEntregado(
  params: PedidoEntregadoParams,
): Promise<WhatsAppSendResponse> {
  const templateName =
    process.env.WHATSAPP_TEMPLATE_PEDIDO_ENTREGADO || 'plantillaprueba';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'es';
  const variables = [params.nombreCliente, params.orderCode];

  if (process.env.WHATSAPP_SERVICE_URL) {
    return sendViaMicroservice(
      templateName,
      templateLang,
      params.to,
      variables,
      params.orderCode, // button URL param
    );
  }

  // Fallback directo a Meta (llamada con button component)
  const phone = normalizePhone(params.to);
  if (!phone) throw new Error('Numero de telefono invalido');
  const { apiVersion, phoneNumberId, accessToken } = loadConfig();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: 'body',
            parameters: variables.map((text) => ({ type: 'text', text })),
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: params.orderCode }],
          },
        ],
      },
    }),
  });

  const json = (await res.json()) as WhatsAppSendResponse | WhatsAppApiError;
  if (!res.ok) {
    const err = json as WhatsAppApiError;
    throw new WhatsAppApiException(
      err.error.code,
      err.error.message,
      err.error.fbtrace_id,
    );
  }
  return json as WhatsAppSendResponse;
}

/**
 * Envía un recordatorio de pago pendiente usando la plantilla configurada
 * en `WHATSAPP_TEMPLATE_PAGO_PENDIENTE` (default: `pago_pendiente`).
 *
 * IMPORTANTE: Solo funciona cuando la plantilla `pago_pendiente` este aprobada
 * en Meta Business. Mientras esta en revision, usar `enviarPedidoEntregado`.
 *
 * Cuerpo esperado de la plantilla:
 *   "Hola {{1}}, tienes un pago pendiente por *${{2}}* con vencimiento {{3}}.
 *    Reporta tu pago aqui: {{4}}"
 */
export async function enviarRecordatorioPago(
  params: PagoPendienteParams,
): Promise<WhatsAppSendResponse> {
  const templateName =
    process.env.WHATSAPP_TEMPLATE_PAGO_PENDIENTE || 'pago_pendiente';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'es';
  const variables = [
    params.nombreCliente,
    params.monto,
    params.fechaVencimiento,
    params.linkReporte,
  ];

  // Preferir el microservicio si esta configurado
  if (process.env.WHATSAPP_SERVICE_URL) {
    return sendViaMicroservice(
      templateName,
      templateLang,
      params.to,
      variables,
    );
  }

  // Fallback: llamar directamente a Meta
  return sendTemplate(params.to, templateName, templateLang, variables);
}

/**
 * Envía un documento (PDF) por WhatsApp.
 * IMPORTANTE: solo funciona dentro de la ventana de 24h después de que el
 * cliente haya enviado un mensaje. Para iniciar conversación con PDF se
 * necesita una plantilla aprobada con header tipo DOCUMENT.
 */
export async function sendDocument(
  params: SendDocumentParams,
): Promise<WhatsAppSendResponse> {
  const phone = normalizePhone(params.to);
  if (!phone) throw new Error('Numero de telefono invalido');

  return callWhatsAppApi({
    messaging_product: 'whatsapp',
    to: phone,
    type: 'document',
    document: {
      link: params.link,
      filename: params.filename,
      ...(params.caption ? { caption: params.caption } : {}),
    },
  });
}

export interface PurchaseReceiptPdfParams {
  readonly to: string; // telefono (se normaliza)
  readonly customerName: string; // {{1}} del body
  readonly orderCode: string; // {{2}} del body + {{1}} del boton URL
  readonly pdfBase64: string; // PDF en base64 (sin prefijo data:)
  readonly pdfFilename?: string; // nombre a mostrar en WhatsApp
}

/**
 * Envia la factura/precuenta por WhatsApp usando la plantilla `purchase_receipt_pdf`.
 * El PDF se envia en base64 al microservicio que lo sube a Meta Media API (gratis).
 *
 * Variables:
 *   header = document PDF (subido a Meta → media_id)
 *   body {{1}} = nombre del cliente
 *   body {{2}} = codigo de la orden (invoiceNumber)
 *   button URL {{1}} = orderCode para el link de detalle
 */
export async function sendPurchaseReceiptPdf(
  params: PurchaseReceiptPdfParams,
): Promise<WhatsAppSendResponse> {
  const phone = normalizePhone(params.to);
  if (!phone) throw new Error('Numero de telefono invalido');

  const templateName =
    process.env.WHATSAPP_TEMPLATE_PURCHASE_RECEIPT || 'purchase_receipt_pdf';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'es';
  const filename = params.pdfFilename ?? `factura-${params.orderCode}.pdf`;

  if (!process.env.WHATSAPP_SERVICE_URL) {
    throw new Error('WHATSAPP_SERVICE_URL no esta configurado');
  }

  return sendViaMicroservice(
    templateName,
    templateLang,
    phone,
    [params.customerName, params.orderCode],
    params.orderCode, // buttonUrlParam
    undefined, // headerUrl (no usamos URL publica)
    filename, // headerFilename
    params.pdfBase64, // headerPdfBase64 → se sube a Meta
  );
}

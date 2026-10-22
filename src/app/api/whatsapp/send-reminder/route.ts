import { NextRequest, NextResponse } from 'next/server';
import {
  WhatsAppApiException,
  enviarPedidoEntregado,
} from '@/services/whatsapp/whatsappService';

interface SendReminderRequest {
  to: string;
  nombreCliente: string;
  orderCode: string; // body {{2}} y button URL {{1}}
}

/**
 * Envia notificacion de WhatsApp usando la plantilla aprobada `plantillaprueba`.
 *
 * La plantilla tiene 2 variables de body + 1 boton URL dinamico:
 *   {{1}} = nombre del cliente
 *   {{2}} = codigo del pedido (ej: invoice number o account receivable number)
 *   button URL {{1}} = mismo codigo para construir la URL del boton "Gestionar orden"
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendReminderRequest;

    if (!body.to || !body.nombreCliente || !body.orderCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faltan campos: to, nombreCliente, orderCode son requeridos',
        },
        { status: 400 },
      );
    }

    const result = await enviarPedidoEntregado({
      to: body.to,
      nombreCliente: body.nombreCliente,
      orderCode: body.orderCode,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messages[0]?.id,
      waId: result.contacts[0]?.wa_id,
    });
  } catch (error) {
    if (error instanceof WhatsAppApiException) {
      let hint = '';
      switch (error.code) {
        case 131030:
          hint =
            'El numero no esta en la lista de numeros permitidos de la app en modo desarrollo. Agregalo en developers.facebook.com';
          break;
        case 132001:
          hint =
            'La plantilla "plantillaprueba" no existe, no esta aprobada, o el idioma es incorrecto';
          break;
        case 190:
          hint = 'Token de acceso expirado. Regenerar en Meta Business';
          break;
        case 100:
          hint = 'Parametros mal formados. Revisar estructura del request';
          break;
      }

      console.error('[WhatsApp API]', error.code, error.message, hint);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          hint,
          fbtraceId: error.fbtraceId,
        },
        { status: 502 },
      );
    }

    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    console.error('[WhatsApp send-reminder]', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

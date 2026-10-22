import { NextRequest, NextResponse } from 'next/server';
import { pagoMovilVerifier } from '@/shared/utils/pagoMovilVerifier';
import { PagoMovilVerificationRequest } from '@odin6/types';

export async function POST(request: NextRequest) {
  try {
    const body: PagoMovilVerificationRequest = await request.json();

    // ── Validaciones de campos requeridos ─────────────────────────────────────

    if (!body.cedulaPagador || body.cedulaPagador.trim().length < 4) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          amountMatches: false,
          errorMessage: 'Cédula del pagador inválida',
        },
        { status: 400 },
      );
    }

    if (!body.telefonoPagador || body.telefonoPagador.length < 10) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          amountMatches: false,
          errorMessage: 'Número de teléfono del pagador inválido',
        },
        { status: 400 },
      );
    }

    if (!body.referencia || body.referencia.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          amountMatches: false,
          errorMessage: 'Número de referencia requerido',
        },
        { status: 400 },
      );
    }

    if (!body.importe || parseFloat(body.importe) <= 0) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          amountMatches: false,
          errorMessage: 'Monto debe ser mayor a 0',
        },
        { status: 400 },
      );
    }

    if (!body.bancoOrigen || body.bancoOrigen.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          amountMatches: false,
          errorMessage: 'Banco origen requerido',
        },
        { status: 400 },
      );
    }

    if (!body.fechaPago || !/^\d{4}-\d{2}-\d{2}$/.test(body.fechaPago)) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          amountMatches: false,
          errorMessage: 'Fecha de pago inválida, use formato YYYY-MM-DD',
        },
        { status: 400 },
      );
    }

    // Normalizar importe con 2 decimales
    const normalizedBody: PagoMovilVerificationRequest = {
      ...body,
      importe: parseFloat(body.importe).toFixed(2),
    };

    // Llamar a la API BDV (timeout 30s — es una API REST, no un scraper)
    const verificationPromise = pagoMovilVerifier.verifyPayment(normalizedBody);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Timeout: respuesta BDV tardó más de 30s')),
        30000,
      ),
    );

    const result = await Promise.race([verificationPromise, timeoutPromise]);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        found: false,
        amountMatches: false,
        errorMessage:
          error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 },
    );
  }
}

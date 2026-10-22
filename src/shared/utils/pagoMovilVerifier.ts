/**
 * pagoMovilVerifier.ts
 * Verifica pagos móviles usando la API Conciliación BDV oficial.
 * Reemplaza el scraper de Puppeteer por una llamada REST directa.
 *
 * Endpoint producción: https://bdvconciliacion.banvenez.com:443/getMovement
 * Header: X-API-Key (generado desde BDVenLinea Empresa)
 * Env vars requeridas:
 *   BDV_API_KEY           — API key del comercio
 *   BDV_TELEFONO_DESTINO  — Teléfono receptor del comercio
 */

import {
  PagoMovilVerificationRequest,
  PagoMovilVerificationResult,
} from '@odin6/types';

interface BdvApiResponse {
  code: number;
  message: string;
  data: {
    status: string;
    amount: string;
    reason: string;
  } | null;
  status: number;
}

const BDV_ENDPOINT =
  process.env.BDV_API_ENDPOINT ||
  'https://bdvconciliacion.banvenez.com:443/getMovement';

export class PagoMovilVerifier {
  private apiKey: string;
  private telefonoDestino: string;

  constructor() {
    this.apiKey = process.env.BDV_API_KEY || '';
    this.telefonoDestino = process.env.BDV_TELEFONO_DESTINO || '';
  }

  async verifyPayment(
    request: PagoMovilVerificationRequest,
  ): Promise<PagoMovilVerificationResult> {
    if (!this.apiKey) {
      return {
        success: false,
        found: false,
        amountMatches: false,
        errorMessage: 'API Key BDV no configurada (BDV_API_KEY)',
      };
    }

    if (!this.telefonoDestino) {
      return {
        success: false,
        found: false,
        amountMatches: false,
        errorMessage: 'Teléfono destino no configurado (BDV_TELEFONO_DESTINO)',
      };
    }

    try {
      const payload = {
        cedulaPagador: request.cedulaPagador,
        telefonoPagador: request.telefonoPagador,
        telefonoDestino: this.telefonoDestino,
        referencia: request.referencia,
        fechaPago: request.fechaPago,
        importe: request.importe,
        bancoOrigen: request.bancoOrigen,
      };

      const response = await fetch(BDV_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          found: false,
          amountMatches: false,
          errorMessage: `Error HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data: BdvApiResponse = await response.json();

      // code 1000 = transacción encontrada y válida
      if (data.code === 1000 && data.data) {
        const actualAmount = data.data.amount;
        const amountMatches =
          Math.abs(parseFloat(actualAmount) - parseFloat(request.importe)) <
          0.01;

        return {
          success: true,
          found: true,
          amountMatches,
          actualAmount,
        };
      }

      // Cualquier código distinto de 1000 es error/no encontrado
      return {
        success: false,
        found: false,
        amountMatches: false,
        errorMessage: data.message || 'Transacción no encontrada en BDV',
      };
    } catch (error) {
      return {
        success: false,
        found: false,
        amountMatches: false,
        errorMessage:
          error instanceof Error ? error.message : 'Error de conexión con BDV',
      };
    }
  }
}

export const pagoMovilVerifier = new PagoMovilVerifier();

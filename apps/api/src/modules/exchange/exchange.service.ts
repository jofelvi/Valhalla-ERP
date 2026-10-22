import { Injectable, Logger } from '@nestjs/common';

interface ExchangeRateResponse {
  rate: number;
  source: string;
  timestamp: string;
}

/**
 * La tasa se guarda 10 minutos en memoria. Antes cada peticion salia a
 * dolarapi.com: 158 ms de media desde el APK en el log de produccion
 * (23-27/09/2026), sin tiempo limite, para un valor que cambia una vez al dia.
 */
const VIGENCIA_MS = 10 * 60 * 1000;
const TIEMPO_LIMITE_MS = 5000;

@Injectable()
export class ExchangeService {
  private readonly logger = new Logger(ExchangeService.name);
  private readonly FALLBACK_RATE = 50.0;
  private ultimaBuena: { respuesta: ExchangeRateResponse; en: number } | null =
    null;

  async getBcvRate(): Promise<ExchangeRateResponse> {
    const ahora = Date.now();
    if (this.ultimaBuena && ahora - this.ultimaBuena.en < VIGENCIA_MS) {
      return this.ultimaBuena.respuesta;
    }

    try {
      const response = await fetch(
        'https://ve.dolarapi.com/v1/dolares/oficial',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
        },
      );

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = (await response.json()) as { promedio?: unknown };
      const rate = Number(data.promedio);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`tasa invalida: ${String(data.promedio)}`);
      }

      const respuesta = {
        rate,
        source: 'dolarapi.com',
        timestamp: new Date(ahora).toISOString(),
      };
      this.ultimaBuena = { respuesta, en: ahora };
      return respuesta;
    } catch (error) {
      // Si la fuente falla se sigue con la ultima tasa real, aunque este
      // vencida: antes se devolvia 50 y con eso se convertian los pagos en Bs.
      // El 50 queda solo para cuando nunca se obtuvo una tasa desde que arranco.
      if (this.ultimaBuena) {
        this.logger.warn(
          `Fallo la tasa BCV, se usa la ultima buena de ${this.ultimaBuena.respuesta.timestamp}: ${String(error)}`,
        );
        return this.ultimaBuena.respuesta;
      }
      this.logger.warn(`Failed to fetch BCV rate, using fallback: ${error}`);

      return {
        rate: this.FALLBACK_RATE,
        source: 'fallback',
        timestamp: new Date(ahora).toISOString(),
      };
    }
  }
}

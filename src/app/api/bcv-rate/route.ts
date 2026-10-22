import { NextResponse } from 'next/server';
import { getPriceBcv } from '@/shared/utils/getPriceDolar';
import { esTasaConfiable } from '@/shared/utils/bcvRateGuard';

// Caché en servidor: la tasa BCV no cambia más de una vez al día.
// 30 min de TTL evita decenas de fetch externos por sesión de caja.
const CACHE_TTL_MS = 30 * 60 * 1000;
let serverCache: { rate: number; source: string; fetchedAt: number } | null =
  null;

export async function GET() {
  try {
    // Servir desde caché si está fresco
    if (serverCache && Date.now() - serverCache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        rate: serverCache.rate,
        source: serverCache.source,
        timestamp: new Date(serverCache.fetchedAt).toISOString(),
        success: true,
        cached: true,
      });
    }

    const result = await getPriceBcv();
    const numericRate = parseFloat(result.rate);

    // Un fallo NO es un dato. El 19/08/2026 esta ruta respondió `success: true`
    // con la tasa de relleno (50) mientras la real era 775,34: la caja mostró
    // Bs 9.790 por una cuenta de $195,80 y encima se cacheó 30 min. Si no hay
    // tasa real, se dice que no la hay y el cajero la escribe a mano.
    if (!esTasaConfiable(numericRate, result.source)) {
      return NextResponse.json(
        {
          rate: null,
          source: 'unavailable',
          sourceDetail: result.source,
          timestamp: new Date().toISOString(),
          success: false,
          error: `Sin tasa BCV confiable (fuente: ${result.source}, valor: ${result.rate})`,
        },
        { status: 503 },
      );
    }

    // Solo se cachea una tasa buena: cachear un fallo lo convierte en media
    // hora de caja cobrando mal.
    serverCache = {
      rate: numericRate,
      source: result.source,
      fetchedAt: Date.now(),
    };

    return NextResponse.json({
      rate: numericRate,
      source: result.source,
      sourceDetail: result.source,
      timestamp: new Date().toISOString(),
      success: true,
      cached: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        rate: null,
        source: 'error',
        sourceDetail: 'critical error',
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

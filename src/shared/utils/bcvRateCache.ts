import { esTasaConfiable } from './bcvRateGuard';
/**
 * Utilidad para manejar el caché de la tasa BCV en localStorage
 * Esto permite tener un fallback con la última tasa conocida válida
 */

const CACHE_KEY = 'bcv_rate_cache';
const CACHE_EXPIRY_HOURS = 24; // La tasa en caché expira después de 24 horas

export interface BcvRateCache {
  rate: number;
  source: string;
  timestamp: string;
  date: string; // Fecha de la tasa (formato YYYY-MM-DD)
}

/**
 * Guarda la tasa BCV en localStorage
 */
export const saveBcvRateToCache = (rate: number, source: string): void => {
  try {
    // Nunca guardar un relleno: si entra al caché, sobrevive 24 h y se sigue
    // cobrando mal mucho después de que la fuente real ya se recuperó.
    if (!esTasaConfiable(rate, source)) {
      console.warn(
        '⛔ Tasa no confiable, no se guarda en caché:',
        rate,
        source,
      );
      return;
    }
    const cacheData: BcvRateCache = {
      rate,
      source,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log('💾 Tasa BCV guardada en caché:', cacheData);
  } catch (error) {
    console.error('❌ Error guardando tasa en caché:', error);
  }
};

/**
 * Obtiene la tasa BCV del caché si existe y no ha expirado
 */
export const getBcvRateFromCache = (): BcvRateCache | null => {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (!cachedData) {
      console.log('ℹ️ No hay tasa BCV en caché');
      return null;
    }

    const cache: BcvRateCache = JSON.parse(cachedData);
    const cacheDate = new Date(cache.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > CACHE_EXPIRY_HOURS) {
      console.log(`⏰ Caché expirado (${hoursDiff.toFixed(1)} horas)`);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Purga del envenenamiento del 19/08: los navegadores de caja quedaron con
    // "50 / default (fallback)" guardado y lo habrían seguido mostrando 24 h.
    if (!esTasaConfiable(cache.rate, cache.source)) {
      console.warn('⛔ Caché con tasa no confiable, se descarta:', cache);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    console.log('✅ Tasa BCV obtenida del caché:', cache);
    return cache;
  } catch (error) {
    console.error('❌ Error leyendo caché:', error);
    return null;
  }
};

/**
 * Limpia el caché de la tasa BCV
 */
export const clearBcvRateCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Caché de tasa BCV limpiado');
  } catch (error) {
    console.error('❌ Error limpiando caché:', error);
  }
};

/**
 * Verifica si hay una tasa en caché válida
 */
export const hasCachedRate = (): boolean => {
  return getBcvRateFromCache() !== null;
};

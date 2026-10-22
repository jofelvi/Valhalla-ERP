import { api } from './api/apiClient';

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hora
const FALLBACK_RATE = 50.0;

interface BcvRateResponse {
  rate: number;
  source: string;
  timestamp: string;
}

let cachedRate: number | null = null;
let cacheTimestamp = 0;

export const getBcvRate = async (): Promise<number> => {
  const now = Date.now();
  if (cachedRate !== null && now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedRate;
  }

  try {
    const data = await api.get<BcvRateResponse>('/api/exchange/bcv-rate');
    if (typeof data.rate === 'number' && data.rate > 0) {
      cachedRate = data.rate;
      cacheTimestamp = now;
      return data.rate;
    }
    throw new Error('Tasa invalida');
  } catch (err) {
    console.error('Error obteniendo tasa BCV:', err);
    return cachedRate ?? FALLBACK_RATE;
  }
};

export const usdToBs = (amountUsd: number, rate: number): number => {
  if (rate <= 0) return 0;
  return Math.round(amountUsd * rate * 100) / 100;
};

export const bsToUsd = (amountBs: number, rate: number): number => {
  if (rate <= 0) return 0;
  return Math.round((amountBs / rate) * 100) / 100;
};

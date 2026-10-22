import { asRecord, bool } from './util';

/**
 * Interruptores de módulos. Un módulo apagado se oculta del menú, sus rutas devuelven 404 y
 * sus tareas programadas no corren. Los módulos nucleares (órdenes, cobro, productos, caja,
 * nómina, inventario) no se apagan.
 */
export const MODULO_CLAVES = [
  'partners',
  'packsAndBuckets',
  'barTokens',
  'telegramBot',
  'currencyWatcher',
  'bankReconciliation',
  'productBonus',
  'connectedTable',
  'reservations',
] as const;
export type ModuloKey = (typeof MODULO_CLAVES)[number];
export type ModulosConfig = Record<ModuloKey, boolean>;

/** Instalación neutra: todo lo opcional apagado. */
export const MODULOS_DEFAULT: ModulosConfig = {
  partners: false,
  packsAndBuckets: false,
  barTokens: false,
  telegramBot: false,
  currencyWatcher: false,
  bankReconciliation: false,
  productBonus: false,
  connectedTable: false,
  reservations: false,
};

export function normalizeModulos(raw: unknown): ModulosConfig {
  const r = asRecord(raw);
  const out = { ...MODULOS_DEFAULT };
  for (const k of MODULO_CLAVES) out[k] = bool(r[k], MODULOS_DEFAULT[k]);
  return out;
}

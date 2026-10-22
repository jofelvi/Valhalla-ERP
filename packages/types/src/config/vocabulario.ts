import { asRecord, str } from './util';

/**
 * Etiquetas visibles. Los enums y permisos del código NO cambian (`WAITER` sigue siendo
 * `WAITER`): solo cambia lo que ve el usuario.
 */
export const VOCAB_CLAVES = [
  'waiter',
  'waiters',
  'cashier',
  'cashiers',
  'kitchen',
  'bar',
  'table',
  'tables',
  'zone',
  'tab',
  'service',
] as const;
export type VocabKey = (typeof VOCAB_CLAVES)[number];
export type VocabularioConfig = Record<VocabKey, string>;

export const VOCABULARIO_DEFAULT: VocabularioConfig = {
  waiter: 'Mesonero',
  waiters: 'Mesoneros',
  cashier: 'Cajero',
  cashiers: 'Cajeros',
  kitchen: 'Cocina',
  bar: 'Barra',
  table: 'Mesa',
  tables: 'Mesas',
  zone: 'Zona',
  tab: 'Cuenta',
  service: 'Servicio',
};

export function normalizeVocabulario(raw: unknown): VocabularioConfig {
  const r = asRecord(raw);
  const out = { ...VOCABULARIO_DEFAULT };
  for (const k of VOCAB_CLAVES) {
    out[k] = str(r[k], VOCABULARIO_DEFAULT[k], 30) || VOCABULARIO_DEFAULT[k];
  }
  return out;
}

/** Ayudas para normalizar documentos de `configs` leídos de Mongo o recibidos de un PATCH. */

export type Raw = Record<string, unknown>;

export const asRecord = (v: unknown): Raw =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {};

export const str = (v: unknown, def: string, max = 500): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : def;

export const bool = (v: unknown, def: boolean): boolean =>
  typeof v === 'boolean' ? v : def;

export const num = (
  v: unknown,
  def: number,
  min: number,
  max: number,
): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n)
    ? Math.min(max, Math.max(min, n))
    : def;
};

export const oneOf = <T extends string>(
  v: unknown,
  allowed: readonly T[],
  def: T,
): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : def;

const HEX = /^#[0-9a-fA-F]{6}$/;
export const hex = (v: unknown, def: string): string =>
  typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toUpperCase() : def;

/**
 * URL http(s) o ruta relativa que empiece con "/". Cualquier otra cosa
 * (javascript:, data:, //host) se descarta.
 */
export const url = (v: unknown, def: string): string => {
  if (typeof v !== 'string') return def;
  const s = v.trim();
  if (s === '') return '';
  return /^(https?:\/\/|\/)/i.test(s) && !/^\/\//.test(s) ? s.slice(0, 1000) : def;
};

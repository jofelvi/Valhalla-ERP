/**
 * Mezcla de colores hex para derivar variantes (tintes, versiones oscuras) a partir de
 * la paleta de la marca. Solo trabaja con `#RRGGBB`: un valor que no sea hex se devuelve
 * tal cual, sin inventar un color.
 */

type Rgb = [number, number, number];

const HEX = /^#([0-9a-fA-F]{6})$/;

function aRgb(color: string): Rgb | null {
  const m = HEX.exec(color.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const dosHex = (n: number): string =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');

/** `t` = 0 devuelve `a`; `t` = 1 devuelve `b`. */
export function mezclarHex(a: string, b: string, t: number): string {
  const ra = aRgb(a);
  const rb = aRgb(b);
  if (!ra || !rb) return a;
  const k = Math.min(1, Math.max(0, t));
  const [r, g, bl] = ra.map((v, i) => v + (rb[i] - v) * k);
  return `#${dosHex(r)}${dosHex(g)}${dosHex(bl)}`.toUpperCase();
}

/** Tintado sobre un fondo. `intensidad` = cuánto del color se ve (0 = el fondo). */
export const tinte = (
  color: string,
  fondo: string,
  intensidad: number,
): string => mezclarHex(color, fondo, 1 - intensidad);

/** Oscurece mezclando con negro. `cuanto` = fracción de negro (0 a 1). */
export const oscurecer = (color: string, cuanto: number): string =>
  mezclarHex(color, '#000000', cuanto);

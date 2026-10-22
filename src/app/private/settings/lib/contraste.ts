import type { PaletaTokens } from '@odin6/types';

/** Umbral WCAG AA para texto normal. */
export const UMBRAL_AA_TEXTO = 4.5;

const HEX6 = /^#([0-9a-fA-F]{6})$/;

/** Luminancia relativa (WCAG 2.x). null si el valor no es un hex de 6 cifras. */
export function luminancia(hex: string): number | null {
  const m = HEX6.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const canal = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255)
  );
}

/** Razón de contraste entre dos colores (1 a 21). null si alguno no es hex válido. */
export function razonContraste(a: string, b: string): number | null {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return null;
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Pares de texto y fondo que la app usa de verdad. Cada uno debe llegar a AA. */
export interface ParTexto {
  texto: keyof PaletaTokens;
  fondo: keyof PaletaTokens;
  descripcion: string;
}

export const PARES_TEXTO: readonly ParTexto[] = [
  {
    texto: 'content',
    fondo: 'page',
    descripcion: 'Texto principal sobre el fondo',
  },
  {
    texto: 'content',
    fondo: 'surface',
    descripcion: 'Texto principal sobre tarjetas',
  },
  {
    texto: 'content',
    fondo: 'elevated',
    descripcion: 'Texto principal sobre ventanas flotantes',
  },
  {
    texto: 'dim',
    fondo: 'page',
    descripcion: 'Texto secundario sobre el fondo',
  },
  {
    texto: 'dim',
    fondo: 'surface',
    descripcion: 'Texto secundario sobre tarjetas',
  },
  {
    texto: 'onPrimary',
    fondo: 'primary',
    descripcion: 'Texto de los botones principales',
  },
  {
    texto: 'primary',
    fondo: 'surface',
    descripcion: 'Enlaces y acento sobre tarjetas',
  },
  { texto: 'danger', fondo: 'surface', descripcion: 'Mensajes de error' },
  { texto: 'success', fondo: 'surface', descripcion: 'Mensajes de éxito' },
  { texto: 'warning', fondo: 'surface', descripcion: 'Avisos' },
  { texto: 'info', fondo: 'surface', descripcion: 'Información' },
  { texto: 'accent', fondo: 'surface', descripcion: 'Acento secundario' },
];

export interface ResultadoPar extends ParTexto {
  /** Redondeada a 2 decimales; null si un color no es válido. */
  razon: number | null;
  cumple: boolean;
}

/** Revisa todos los pares de texto de una paleta. */
export function revisarContraste(paleta: PaletaTokens): ResultadoPar[] {
  return PARES_TEXTO.map((par) => {
    const bruta = razonContraste(paleta[par.texto], paleta[par.fondo]);
    const razon = bruta === null ? null : Math.round(bruta * 100) / 100;
    return {
      ...par,
      razon,
      cumple: bruta !== null && bruta >= UMBRAL_AA_TEXTO,
    };
  });
}

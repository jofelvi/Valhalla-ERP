import type { PaletaTokens } from '@odin6/types';

/**
 * Token de la paleta -> variable CSS que lee el design system (`src/app/globals.css`).
 * La vista previa aplica estas variables solo dentro de su contenedor.
 */
export const VARIABLE_CSS: Readonly<Record<keyof PaletaTokens, string>> = {
  page: '--bg-page',
  surface: '--bg-surface',
  elevated: '--bg-elevated',
  sidebar: '--bg-sidebar',
  line: '--clr-line',
  lineHover: '--clr-line-hover',
  content: '--text-content',
  dim: '--text-dim',
  primary: '--clr-primary',
  primaryDark: '--clr-primary-dark',
  primaryLight: '--clr-primary-light',
  accent: '--clr-accent',
  success: '--clr-success',
  danger: '--clr-danger',
  warning: '--clr-warning',
  info: '--clr-info',
  onPrimary: '--text-on-brand',
};

/** Objeto de estilo con las variables de una paleta (para `style={...}`). */
export function variablesCss(paleta: PaletaTokens): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const clave of Object.keys(VARIABLE_CSS) as (keyof PaletaTokens)[]) {
    salida[VARIABLE_CSS[clave]] = paleta[clave];
  }
  return salida;
}

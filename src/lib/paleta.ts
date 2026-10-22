import {
  PALETA_CLAVES,
  type MarcaConfig,
  type PaletaTokens,
} from '@odin6/types';

/**
 * Token de la paleta → variable CSS del design system (`src/app/globals.css`).
 * Un solo mapa: la hoja de estilos inyectada en `<head>` y los PDF/correos leen de aquí.
 */
export const VARIABLE_PALETA: Record<keyof PaletaTokens, string> = {
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

const declaraciones = (p: PaletaTokens): string =>
  PALETA_CLAVES.map((k) => `${VARIABLE_PALETA[k]}: ${p[k]};`).join(' ');

/**
 * CSS de las dos paletas. Especificidad (0,2,0) para ganar a `globals.css` sin depender del
 * orden de las hojas. Va en `<head>` para que el primer pintado ya tenga los colores del cliente.
 */
export function paletaCss(marca: MarcaConfig): string {
  const clara = declaraciones(marca.palette.light);
  const oscura = declaraciones(marca.palette.dark);
  return [
    `:root:not([data-theme='light']) { ${oscura} }`,
    `:root[data-theme='dark'] { ${oscura} }`,
    `:root[data-theme='light'] { ${clara} }`,
  ].join('\n');
}

/** Color de la paleta clara como hex, para PDF y correos (que no leen CSS). */
export function colorDeMarca(
  marca: MarcaConfig,
  token: keyof PaletaTokens,
): string {
  return marca.palette.light[token];
}

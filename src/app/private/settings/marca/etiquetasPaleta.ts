import type { PaletaTokens } from '@odin6/types';

/** Nombre en español de cada color, tal como lo ve el dueño (no el nombre técnico). */
export const ETIQUETAS_PALETA: Readonly<Record<keyof PaletaTokens, string>> = {
  page: 'Fondo de la página',
  surface: 'Tarjetas y paneles',
  elevated: 'Ventanas flotantes',
  sidebar: 'Menú lateral',
  line: 'Bordes',
  lineHover: 'Bordes al pasar el cursor',
  content: 'Texto principal',
  dim: 'Texto secundario',
  primary: 'Color principal (botones)',
  primaryDark: 'Color principal oscuro',
  primaryLight: 'Color principal claro',
  accent: 'Color de acento',
  success: 'Éxito',
  danger: 'Error y peligro',
  warning: 'Aviso',
  info: 'Información',
  onPrimary: 'Texto sobre el color principal',
};

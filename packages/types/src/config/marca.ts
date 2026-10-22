import { asRecord, hex, str, url } from './util';

/**
 * Tokens de color de una paleta (claro u oscuro). Corresponden uno a uno con las
 * variables CSS de la web (`--bg-page`, `--clr-primary`, …); el móvil usa los mismos.
 */
export interface PaletaTokens {
  page: string;
  surface: string;
  elevated: string;
  sidebar: string;
  line: string;
  lineHover: string;
  content: string;
  dim: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  /** Texto sobre `primary`. */
  onPrimary: string;
}

export const PALETA_CLAVES = [
  'page',
  'surface',
  'elevated',
  'sidebar',
  'line',
  'lineHover',
  'content',
  'dim',
  'primary',
  'primaryDark',
  'primaryLight',
  'accent',
  'success',
  'danger',
  'warning',
  'info',
  'onPrimary',
] as const satisfies readonly (keyof PaletaTokens)[];

export interface MarcaConfig {
  /**
   * Nombre que se ve en login, sidebar, título de pestaña y app. Vacío = se usa
   * `negocio.tradeName`; si tampoco hay, "Punto de venta".
   */
  appName: string;
  /** Logos (URL http(s) o ruta que empiece con "/"). Vacío = sin logo, solo texto. */
  logoLightUrl: string;
  logoDarkUrl: string;
  /** Ícono cuadrado (favicon / ícono de PWA). */
  iconUrl: string;
  palette: { light: PaletaTokens; dark: PaletaTokens };
  /** Tema para quien no ha elegido uno. */
  defaultTheme: 'light' | 'dark' | 'system';
}

export const PALETA_OSCURA_DEFAULT: PaletaTokens = {
  page: '#0F1115',
  surface: '#151922',
  elevated: '#1B2130',
  sidebar: '#0F1115',
  line: '#2A3142',
  lineHover: '#3A4358',
  content: '#E8ECF4',
  dim: '#9AA4B8',
  primary: '#4C8DF6',
  primaryDark: '#2F6FD8',
  primaryLight: '#7FB0FA',
  accent: '#9B82F0',
  success: '#52C77A',
  danger: '#E85D52',
  warning: '#E8A852',
  info: '#4A8FD0',
  onPrimary: '#0B1220',
};

export const PALETA_CLARA_DEFAULT: PaletaTokens = {
  page: '#F4F6FA',
  surface: '#FFFFFF',
  elevated: '#F8FAFD',
  sidebar: '#FFFFFF',
  line: '#D8DEE9',
  lineHover: '#C3CCDB',
  content: '#111827',
  dim: '#5B6578',
  primary: '#1D4ED8',
  primaryDark: '#1E3A8A',
  primaryLight: '#3B82F6',
  accent: '#6D4FC4',
  success: '#1F7A3D',
  danger: '#B3342B',
  warning: '#9A5B0C',
  info: '#2B5E9E',
  onPrimary: '#FFFFFF',
};

export const MARCA_DEFAULT: MarcaConfig = {
  appName: '',
  logoLightUrl: '',
  logoDarkUrl: '',
  iconUrl: '',
  palette: { light: PALETA_CLARA_DEFAULT, dark: PALETA_OSCURA_DEFAULT },
  defaultTheme: 'system',
};

export function normalizePaleta(raw: unknown, def: PaletaTokens): PaletaTokens {
  const r = asRecord(raw);
  const out = { ...def };
  for (const k of PALETA_CLAVES) out[k] = hex(r[k], def[k]);
  return out;
}

export function normalizeMarca(raw: unknown): MarcaConfig {
  const r = asRecord(raw);
  const d = MARCA_DEFAULT;
  const p = asRecord(r.palette);
  const theme = r.defaultTheme;
  return {
    appName: str(r.appName, d.appName, 60),
    logoLightUrl: url(r.logoLightUrl, d.logoLightUrl),
    logoDarkUrl: url(r.logoDarkUrl, d.logoDarkUrl),
    iconUrl: url(r.iconUrl, d.iconUrl),
    palette: {
      light: normalizePaleta(p.light, d.palette.light),
      dark: normalizePaleta(p.dark, d.palette.dark),
    },
    defaultTheme:
      theme === 'light' || theme === 'dark' || theme === 'system'
        ? theme
        : d.defaultTheme,
  };
}

/** Nombre que ve el usuario: marca → nombre comercial → genérico. */
export function nombreVisible(
  marca: Pick<MarcaConfig, 'appName'>,
  negocio: { tradeName: string },
): string {
  return marca.appName || negocio.tradeName || 'Punto de venta';
}

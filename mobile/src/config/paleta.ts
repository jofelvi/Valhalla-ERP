import { PaletaTokens } from '../shared/contrato';
import { oscurecer, tinte } from './mezclarColor';

// Type definition to ensure both palettes have identical keys
export type ColorPalette = {
  // ─────────────────────────────────────────────────
  // CONTRATO SEMÁNTICO ÚNICO (nombres estándar)
  // ─────────────────────────────────────────────────

  // Fondos
  page: string;
  surface: string;
  elevated: string;

  // Bordes
  line: string;
  'line-hover': string;

  // Texto
  content: string;
  dim: string;
  /**
   * Texto e iconos que van ENCIMA del color de marca (boton primario, chip
   * activo). NO es lo mismo que `textWhite`: un color de marca claro con texto
   * blanco encima puede quedar por debajo del minimo de contraste de 3.0 incluso
   * para texto grande. Por eso la paleta trae su propio `onPrimary`.
   *
   * Es el gemelo de `--text-on-brand` de la web. Este token es para marca SOLIDA;
   * sobre un tinte translucido va el color de la marca, no lo que va encima de ella.
   */
  'on-brand': string;

  // Marca visual
  brand: string;
  'brand-dark': string;
  'brand-light': string;
  accent: string;

  // Estados
  ok: string;
  danger: string;
  warn: string;
  info: string;

  // Especiales
  'toast-bg': string;
  'toast-text': string;
  overlay: string;
  shadow: string;

  // Orden (estados de pedido)
  'status-pending': string;
  'status-in-progress': string;
  'status-ready': string;
  'status-delivered': string;
  'status-cancelled': string;

  // ─────────────────────────────────────────────────
  // ALIAS TEMPORALES (nombres viejos que siguen vivos)
  // Se pueden borrar después de refactorizar los 78 archivos
  // ─────────────────────────────────────────────────

  // Primary — alias de brand
  primary: string;
  primaryDark: string;
  primaryLight: string;

  // Accent — alias (ya existe en contrato, pero se repite aquí por claridad)
  accentDark: string;

  // Background — alias de page
  background: string;
  backgroundSecondary: string;
  backgroundDark: string;

  // Surface — alias (ya existe en contrato)
  surfaceSecondary: string;

  // Text — alias de content/dim
  text: string;
  textSecondary: string;
  textLight: string;
  textWhite: string;
  onPrimary: string;

  // Status — alias de ok/danger/warn/info
  success: string;
  warning: string;
  error: string;

  // Order Status — alias (usar status-* del contrato)
  statusPending: string;
  statusInProgress: string;
  statusReady: string;
  statusDelivered: string;
  statusCancelled: string;

  // Light/Dark variants
  successLight: string;
  warningLight: string;
  errorLight: string;
  infoLight: string;

  // Darker variants (for emphasis)
  successDark: string;
  errorDark: string;
  errorDarker: string;
  warningDark: string;

  // Additional
  border: string;
  gradientStart: string;
  gradientEnd: string;

  // Cyan/Info variants
  cyan: string;
  cyanLight: string;

  // Orange variants
  orange: string;
  orangeLight: string;
};

/**
 * Tema a partir de una paleta de la marca (`marca.palette.light|dark`). Los NOMBRES de
 * token son los que ya usan las pantallas: aquí solo cambia de dónde sale cada valor.
 * Las variantes (tintes, versiones oscuras) se derivan de la paleta, así que el tema
 * sigue coherente con cualquier marca.
 */
export function crearColores(
  p: PaletaTokens,
  modo: 'light' | 'dark',
): ColorPalette {
  const claro = modo === 'light';
  // Tintes claros sobre superficie blanca; tintes oscuros sobre el fondo de página.
  const tinteDe = (c: string) =>
    claro ? tinte(c, p.surface, 0.15) : tinte(c, p.page, 0.4);

  return {
    page: p.page,
    surface: p.surface,
    elevated: p.elevated,

    line: p.line,
    'line-hover': p.lineHover,

    content: p.content,
    dim: p.dim,
    'on-brand': p.onPrimary,

    brand: p.primary,
    'brand-dark': p.primaryDark,
    'brand-light': p.primaryLight,
    accent: p.accent,

    ok: p.success,
    danger: p.danger,
    warn: p.warning,
    info: p.info,

    'toast-bg': p.elevated,
    'toast-text': p.content,
    overlay: claro ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.7)',
    shadow: claro ? 'rgba(0, 0, 0, 0.1)' : '#000000',

    'status-pending': p.warning,
    'status-in-progress': p.info,
    'status-ready': p.success,
    'status-delivered': p.success,
    'status-cancelled': p.danger,

    primary: p.primary,
    primaryDark: p.primaryDark,
    primaryLight: p.primaryLight,

    accentDark: oscurecer(p.accent, 0.2),

    background: p.page,
    backgroundSecondary: p.elevated,
    backgroundDark: p.line,

    surfaceSecondary: p.elevated,

    text: p.content,
    textSecondary: p.dim,
    textLight: p.dim,
    textWhite: p.content,
    onPrimary: p.onPrimary,

    success: p.success,
    warning: p.warning,
    error: p.danger,

    statusPending: p.warning,
    statusInProgress: p.info,
    statusReady: p.success,
    statusDelivered: p.success,
    statusCancelled: p.danger,

    successLight: tinteDe(p.success),
    warningLight: tinteDe(p.warning),
    errorLight: tinteDe(p.danger),
    infoLight: tinteDe(p.info),

    successDark: oscurecer(p.success, 0.5),
    errorDark: oscurecer(p.danger, 0.4),
    errorDarker: oscurecer(p.danger, 0.5),
    warningDark: oscurecer(p.warning, 0.5),

    border: p.line,
    gradientStart: p.primary,
    gradientEnd: p.primaryDark,

    cyan: p.info,
    cyanLight: tinteDe(p.info),

    orange: p.primary,
    orangeLight: p.primaryLight,
  };
}

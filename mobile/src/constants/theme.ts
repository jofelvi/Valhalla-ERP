import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { configActual, useConfigStore } from '../config/configStore';
import { ColorPalette, crearColores } from '../config/paleta';

export type { ColorPalette };

// Paletas del momento de cargar el módulo. La raíz de arranque (ArranqueConfig) espera la
// configuración antes de importar la app, así que aquí ya está la marca del negocio.
export const THEME_COLORS = {
  dark: crearColores(configActual().marca.palette.dark, 'dark'),
  light: crearColores(configActual().marca.palette.light, 'light'),
};

// Hook to get the active color palette. Reacciona a cambios de la configuración y respeta
// `marca.defaultTheme`; con 'system' sigue el tema del sistema (oscuro si no lo informa).
export const useThemeColors = (): ColorPalette => {
  const sistema = useColorScheme();
  const preferido = useConfigStore((s) => s.config.marca.defaultTheme);
  const paleta = useConfigStore((s) => s.config.marca.palette);
  const modo: 'light' | 'dark' =
    preferido === 'light' || preferido === 'dark'
      ? preferido
      : sistema === 'light'
        ? 'light'
        : 'dark';
  return useMemo(() => crearColores(paleta[modo], modo), [paleta, modo]);
};

// Default export (dark theme for backward compatibility)
export const COLORS: ColorPalette = THEME_COLORS.dark;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  title: 32,
};

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const ICON_SIZE = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
};

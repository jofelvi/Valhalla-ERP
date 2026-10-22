import { useColorScheme } from 'react-native';
import { THEME_COLORS } from '../constants/theme';

/**
 * Hook to get the active theme colors based on system color scheme
 * Returns the dark theme by default if color scheme is not available
 *
 * Usage:
 * ```tsx
 * const colors = useThemeColors();
 * // Use colors.primary, colors.background, etc.
 * ```
 *
 * Migration guide for existing components:
 * Before:
 *   import { COLORS } from '@/constants/theme';
 *   const styles = StyleSheet.create({
 *     container: { backgroundColor: '#292524' }  // Hardcoded hex
 *   });
 *
 * After:
 *   import { useThemeColors } from '@/hooks/useThemeColors';
 *   const MyComponent = () => {
 *     const colors = useThemeColors();
 *     return (
 *       <View style={{ backgroundColor: colors.surface }} />
 *     );
 *   };
 */
export const useThemeColors = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'light' ? THEME_COLORS.light : THEME_COLORS.dark;
};

/**
 * Hook to check if the current theme is light
 */
export const useIsLightTheme = (): boolean => {
  const colorScheme = useColorScheme();
  return colorScheme === 'light';
};

/**
 * Hook to get a specific color and have it react to theme changes
 */
export const useThemeColor = (colorKey: keyof typeof THEME_COLORS.dark): string => {
  const colors = useThemeColors();
  return colors[colorKey];
};

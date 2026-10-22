import React from 'react';
import { View, ViewProps, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants';

interface CardProps extends ViewProps {
  /** Variante visual */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Nivel de sombra ('small' | 'medium' | 'large') */
  shadowLevel?: 'small' | 'medium' | 'large';
  /** Padding interior de la tarjeta */
  padding?: 'sm' | 'md' | 'lg';
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  cardDefault: {
    backgroundColor: COLORS.surface,
  },
  cardElevated: {
    backgroundColor: COLORS.surface,
  },
  cardOutlined: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paddingSm: {
    padding: SPACING.sm,
  },
  paddingMd: {
    padding: SPACING.md,
  },
  paddingLg: {
    padding: SPACING.lg,
  },
});

/**
 * Componente Card atómico reutilizable.
 * Contenedor base para agrupar contenido con estilos consistentes.
 * Soporta variantes (default, elevated, outlined) y niveles de sombra.
 *
 * @example
 * <Card variant="elevated" padding="md">
 *   <Text>Contenido de la tarjeta</Text>
 * </Card>
 *
 * <Card variant="outlined" shadowLevel="medium">
 *   <ProductInfo />
 * </Card>
 */
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  shadowLevel = 'small',
  padding = 'md',
  style,
  children,
  ...props
}) => {
  const cardStyles: ViewStyle[] = [styles.card];

  // Variante
  if (variant === 'elevated') {
    cardStyles.push(styles.cardElevated);
    // Agregar sombra si es elevated
    const shadow = SHADOWS[shadowLevel] ?? SHADOWS.small;
    cardStyles.push(shadow as ViewStyle);
  } else if (variant === 'outlined') {
    cardStyles.push(styles.cardOutlined);
  } else {
    // default
    cardStyles.push(styles.cardDefault);
  }

  // Padding
  switch (padding) {
    case 'sm':
      cardStyles.push(styles.paddingSm);
      break;
    case 'lg':
      cardStyles.push(styles.paddingLg);
      break;
    default: // md
      cardStyles.push(styles.paddingMd);
  }

  return (
    <View style={[...cardStyles, style]} {...props}>
      {children}
    </View>
  );
};

import React, { forwardRef } from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  /** Variante visual del botón */
  variant?: Variant;
  /** Tamaño del botón */
  size?: Size;
  /** Texto del botón */
  label: string;
  /** Mostrar indicador de carga */
  loading?: boolean;
  /** Deshabilitar el botón */
  disabled?: boolean;
  /** Ícono o contenido adicional (React component o null) */
  icon?: React.ReactNode;
  /** Posición del ícono ('left' | 'right') */
  iconPosition?: 'left' | 'right';
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonPrimaryDisabled: {
    backgroundColor: `${COLORS.primary}50`,
  },
  buttonSecondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonSecondaryDisabled: {
    backgroundColor: COLORS.backgroundSecondary,
    borderColor: `${COLORS.border}50`,
  },
  buttonDanger: {
    backgroundColor: COLORS.error,
  },
  buttonDangerDisabled: {
    backgroundColor: `${COLORS.error}50`,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonGhostDisabled: {
    opacity: 0.5,
  },
  // Sizes
  buttonSm: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 36,
  },
  buttonMd: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 44,
  },
  buttonLg: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    minHeight: 52,
  },
  labelSm: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  labelMd: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  labelLg: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  labelSecondary: {
    color: COLORS.textSecondary,
  },
  labelGhost: {
    color: COLORS.primary,
  },
  labelDisabled: {
    color: `${COLORS.text}80`,
  },
});

/**
 * Componente Button atómico reutilizable.
 * Soporta variantes (primary, secondary, danger, ghost),
 * tamaños (sm, md, lg), estados (loading, disabled) e íconos.
 *
 * @example
 * <Button label="Guardar" variant="primary" size="lg" onPress={handleSave} />
 * <Button label="Cancelar" variant="ghost" icon={<Ionicons name="close" />} />
 * <Button label="Cargando..." loading variant="primary" disabled />
 */
export const Button = forwardRef<
  React.ElementRef<typeof TouchableOpacity>,
  ButtonProps
>(
  (
    {
      variant = 'primary',
      size = 'md',
      label,
      loading = false,
      disabled = false,
      icon,
      iconPosition = 'left',
      style,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    // Seleccionar estilos de botón
    let buttonStyle: ViewStyle[] = [styles.button];
    switch (size) {
      case 'sm':
        buttonStyle.push(styles.buttonSm);
        break;
      case 'lg':
        buttonStyle.push(styles.buttonLg);
        break;
      default: // md
        buttonStyle.push(styles.buttonMd);
    }

    // Variante
    if (variant === 'primary') {
      buttonStyle.push(
        isDisabled ? styles.buttonPrimaryDisabled : styles.buttonPrimary,
      );
    } else if (variant === 'secondary') {
      buttonStyle.push(
        isDisabled ? styles.buttonSecondaryDisabled : styles.buttonSecondary,
      );
    } else if (variant === 'danger') {
      buttonStyle.push(
        isDisabled ? styles.buttonDangerDisabled : styles.buttonDanger,
      );
    } else if (variant === 'ghost') {
      buttonStyle.push(
        isDisabled ? styles.buttonGhostDisabled : styles.buttonGhost,
      );
    }

    // Seleccionar estilos de etiqueta
    let labelStyle: TextStyle[] = [];
    switch (size) {
      case 'sm':
        labelStyle.push(styles.labelSm);
        break;
      case 'lg':
        labelStyle.push(styles.labelLg);
        break;
      default: // md
        labelStyle.push(styles.labelMd);
    }

    if (variant === 'secondary') {
      labelStyle.push(styles.labelSecondary);
    } else if (variant === 'ghost') {
      labelStyle.push(styles.labelGhost);
    }

    if (isDisabled && variant !== 'primary') {
      labelStyle.push(styles.labelDisabled);
    }

    return (
      <TouchableOpacity
        ref={ref}
        style={[...buttonStyle, style]}
        disabled={isDisabled}
        activeOpacity={isDisabled ? 1 : 0.7}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size={size === 'lg' ? 'small' : 'small'}
            color={variant === 'ghost' ? COLORS.primary : COLORS.text}
          />
        ) : (
          <>
            {icon && iconPosition === 'left' && icon}
            <Text style={labelStyle}>{label}</Text>
            {icon && iconPosition === 'right' && icon}
          </>
        )}
      </TouchableOpacity>
    );
  },
);

Button.displayName = 'Button';

import React, { forwardRef } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Nombre de ícono válido de Ionicons (evita `any` en la prop `name`). */
type IconName = React.ComponentProps<typeof Ionicons>['name'];
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  BORDER_RADIUS,
  FONT_WEIGHT,
} from '../../constants';

interface InputProps extends TextInputProps {
  /** Etiqueta del campo */
  label?: string;
  /** Placeholder del input */
  placeholder?: string;
  /** Texto de error (muestra el input en rojo) */
  error?: string;
  /** Mostrar ícono de éxito (validado) */
  success?: boolean;
  /** Ícono a la izquierda del input */
  leftIcon?: IconName;
  /** Ícono a la derecha del input (ej: 'eye' para password) */
  rightIcon?: IconName;
  /** Callback al presionar el ícono derecho */
  onRightIconPress?: () => void;
  /** Deshabilitar el input */
  disabled?: boolean;
  /** Mostrar contador de caracteres */
  showCharCount?: boolean;
  /** Máximo de caracteres permitidos */
  maxLength?: number;
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
  },
  inputContainerError: {
    borderColor: COLORS.error,
    backgroundColor: `${COLORS.error}10`,
  },
  inputContainerSuccess: {
    borderColor: COLORS.success,
  },
  inputContainerFocused: {
    borderColor: COLORS.primary,
  },
  inputContainerDisabled: {
    backgroundColor: COLORS.backgroundSecondary,
    opacity: 0.6,
  },
  leftIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    paddingVertical: SPACING.sm,
    fontWeight: FONT_WEIGHT.regular,
  },
  inputDisabled: {
    color: COLORS.textLight,
  },
  rightIconContainer: {
    marginLeft: SPACING.sm,
    padding: SPACING.xs,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
    fontWeight: FONT_WEIGHT.medium,
  },
  charCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
    textAlign: 'right',
  },
});

/**
 * Componente Input atómico reutilizable.
 * Soporta etiquetas, errores, iconos, validación visual y contador de caracteres.
 *
 * @example
 * <Input
 *   label="Email"
 *   placeholder="tu@email.com"
 *   leftIcon="mail-outline"
 *   error={emailError}
 * />
 * <Input
 *   label="Contraseña"
 *   placeholder="••••••••"
 *   secureTextEntry
 *   rightIcon="eye-outline"
 * />
 */
export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      placeholder,
      error,
      success,
      leftIcon,
      rightIcon,
      onRightIconPress,
      disabled = false,
      showCharCount = false,
      maxLength,
      value,
      onFocus,
      onBlur,
      style,
      placeholderTextColor,
      ...props
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);

    const handleFocus: TextInputProps['onFocus'] = (e) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur: TextInputProps['onBlur'] = (e) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    // Determinar estilo del contenedor
    const inputContainerStyles: ViewStyle[] = [styles.inputContainer];
    if (error) {
      inputContainerStyles.push(styles.inputContainerError);
    } else if (success) {
      inputContainerStyles.push(styles.inputContainerSuccess);
    } else if (isFocused) {
      inputContainerStyles.push(styles.inputContainerFocused);
    }

    if (disabled) {
      inputContainerStyles.push(styles.inputContainerDisabled);
    }

    const inputTextStyle: TextStyle[] = [styles.input];
    if (disabled) {
      inputTextStyle.push(styles.inputDisabled);
    }

    const charCountValue = typeof value === 'string' ? value.length : 0;

    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={inputContainerStyles}>
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={20}
              color={error ? COLORS.error : COLORS.textSecondary}
              style={styles.leftIcon}
            />
          )}
          <TextInput
            ref={ref}
            style={[inputTextStyle, style]}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor ?? COLORS.textLight}
            editable={!disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            value={value}
            maxLength={maxLength}
            {...props}
          />
          {success && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={COLORS.success}
              style={styles.rightIconContainer}
            />
          )}
          {rightIcon && !success && (
            <Ionicons
              name={rightIcon}
              size={20}
              color={error ? COLORS.error : COLORS.textSecondary}
              style={styles.rightIconContainer}
              onPress={onRightIconPress}
            />
          )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {showCharCount && maxLength && (
          <Text style={styles.charCount}>
            {charCountValue} / {maxLength}
          </Text>
        )}
      </View>
    );
  },
);

Input.displayName = 'Input';

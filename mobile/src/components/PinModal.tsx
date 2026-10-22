import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../constants/theme';

interface Props {
  visible: boolean;
  titulo: string;
  descripcion?: string;
  /** Devuelve un mensaje de error para mostrar, o null si salio bien. */
  onConfirmar: (pin: string) => Promise<string | null>;
  onCancelar: () => void;
}

/**
 * Pide el PIN de un jefe para autorizar una accion en el acto.
 *
 * Existe para que la estacion no tenga que esperar a que un admin abra su
 * propia app: el jefe teclea su PIN en el telefono que hay a mano y la accion
 * queda registrada a SU nombre.
 */
export const PinModal: React.FC<Props> = ({
  visible,
  titulo,
  descripcion,
  onConfirmar,
  onCancelar,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Nunca dejar un PIN tecleado colgando entre aperturas del modal.
  useEffect(() => {
    if (visible) {
      setPin('');
      setError(null);
      setEnviando(false);
    }
  }, [visible]);

  const confirmar = async () => {
    if (!pin.trim() || enviando) return;
    setEnviando(true);
    setError(null);
    const mensaje = await onConfirmar(pin.trim());
    setEnviando(false);
    if (mensaje) {
      setError(mensaje);
      setPin('');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancelar}
    >
      <View style={styles.fondo}>
        <View style={styles.tarjeta}>
          <Text style={styles.titulo}>{titulo}</Text>
          {!!descripcion && (
            <Text style={styles.descripcion}>{descripcion}</Text>
          )}

          <TextInput
            style={[styles.input, !!error && styles.inputError]}
            value={pin}
            onChangeText={setPin}
            placeholder="PIN"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            editable={!enviando}
            onSubmitEditing={confirmar}
            returnKeyType="done"
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.acciones}>
            <TouchableOpacity
              style={[styles.boton, styles.botonSecundario]}
              onPress={onCancelar}
              disabled={enviando}
            >
              <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.boton,
                styles.botonPrimario,
                !pin.trim() && styles.botonInactivo,
              ]}
              onPress={confirmar}
              disabled={!pin.trim() || enviando}
            >
              {enviando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.botonPrimarioTexto}>Autorizar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  tarjeta: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
  },
  titulo: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  descripcion: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  input: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    letterSpacing: 6,
    textAlign: 'center',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  error: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    textAlign: 'center',
  },
  acciones: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  boton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  botonPrimario: {
    backgroundColor: COLORS.primary,
  },
  botonInactivo: {
    opacity: 0.5,
  },
  botonPrimarioTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  botonSecundario: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  botonSecundarioTexto: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
});

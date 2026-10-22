import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, StyleSheet } from 'react-native';
import { Button } from '../ui/Button';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import { api } from '../../services/api/apiClient';
import { showAlert } from '../../utils/alert';
import type { PendingStationItem } from '../../services/kitchenOrderService';

/**
 * Rechazar un item pendiente, con motivo obligatorio. Vive aqui porque lo
 * usan el despacho del admin y las tres estaciones; hasta el 23/09/2026
 * existia solo dentro de `DispatchScreen` y por eso ninguna estacion podia
 * limpiar su propia pantalla.
 *
 * `PATCH /api/orders/:id/items/:itemId/cancel` es un borrado LOGICO y solo
 * pasa si el item no tiene nada entregado. Con entrega parcial el servidor
 * responde 400 y el camino correcto es la cortesia, no este modal: por eso
 * el error del servidor se muestra tal cual en vez de traducirse.
 */
interface ModalDeRechazoDeItemProps {
  /** El item a rechazar; `null` mantiene el modal cerrado. */
  item: PendingStationItem | null;
  onCerrar: () => void;
  /** Se llama tras un rechazo aceptado por el servidor. */
  onRechazado?: () => void;
}

export const ModalDeRechazoDeItem: React.FC<ModalDeRechazoDeItemProps> = ({
  item,
  onCerrar,
  onRechazado,
}) => {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Cada item abre el modal en limpio: sin esto el motivo del rechazo
  // anterior aparece escrito en el siguiente.
  useEffect(() => {
    if (item) {
      setMotivo('');
    }
  }, [item]);

  const confirmar = useCallback(async () => {
    if (!item || !motivo.trim()) {
      showAlert('Error', 'Debes ingresar un motivo de rechazo');
      return;
    }

    setEnviando(true);
    try {
      await api.patch(
        `/api/orders/${item.orderId}/items/${item.itemId}/cancel`,
        { reason: motivo.trim() },
      );
      onCerrar();
      onRechazado?.();
      showAlert(
        'Rechazado',
        `"${item.productName}" ha sido rechazado y eliminado de la orden.`,
      );
    } catch (e) {
      showAlert(
        'Error',
        e instanceof Error ? e.message : 'No se pudo rechazar el item',
      );
    } finally {
      setEnviando(false);
    }
  }, [item, motivo, onCerrar, onRechazado]);

  return (
    <Modal visible={item !== null} transparent animationType="fade">
      <View style={estilos.fondo}>
        <View style={estilos.caja}>
          <Text style={estilos.titulo}>Rechazar Item</Text>
          <Text style={estilos.subtitulo}>
            {item?.productName} × {item?.pendingQty}
          </Text>

          <Text style={estilos.etiqueta}>Motivo del rechazo</Text>
          <TextInput
            style={estilos.entrada}
            placeholder="Ej: sin insumo, se cayó, error..."
            placeholderTextColor={COLORS.textSecondary}
            value={motivo}
            onChangeText={setMotivo}
            editable={!enviando}
            multiline
            numberOfLines={3}
          />

          <View style={estilos.botones}>
            <Button
              label="Cancelar"
              variant="secondary"
              size="md"
              onPress={onCerrar}
              disabled={enviando}
              style={{ flex: 1 }}
            />
            <Button
              label="Rechazar"
              variant="danger"
              size="md"
              onPress={() => void confirmar()}
              disabled={enviando}
              loading={enviando}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  caja: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  titulo: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  subtitulo: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  etiqueta: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  entrada: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  botones: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});

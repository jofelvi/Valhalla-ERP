import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { SPACING } from '../../constants';
import type { PendingStationItem } from '../../services/kitchenOrderService';

/**
 * Los botones de UN item pendiente, iguales en el despacho del admin
 * (`DispatchScreen`) y en la pantalla de estacion (`StationOrdersScreen`).
 *
 * Hasta el 23/09/2026 eran dos juegos distintos y esa diferencia costaba
 * dinero: el admin tenia el boton de RECHAZAR y las estaciones no, asi que
 * un item que nunca se iba a preparar se quedaba pendiente para siempre.
 * Medido ese dia en el ambiente de pruebas: 14 lineas pendientes, **las 14 con mas de
 * un dia**, la mas vieja de 53 dias. Ninguna era trabajo real y nadie en la
 * estacion podia sacarla de su pantalla.
 *
 * Decision del dueno (23/09/2026): las tres estaciones usan la card del
 * admin, con los botones manuales visibles. Antes estaban ocultos tras
 * `STRICT_STATIONS` para forzar la entrega por escaneo de ficha; la ficha
 * sigue siendo la via normal y estos botones son la salida cuando no la hay.
 */
interface AccionesDeItemProps {
  item: PendingStationItem;
  /** Bloquea los tres botones mientras hay una operacion en vuelo. */
  ocupado: boolean;
  onEntregarUno: () => void;
  onEntregarTodos: () => void;
  onRechazar: () => void;
}

export const AccionesDeItem: React.FC<AccionesDeItemProps> = ({
  item,
  ocupado,
  onEntregarUno,
  onEntregarTodos,
  onRechazar,
}) => (
  <View style={estilos.fila}>
    <Button
      variant="primary"
      size="md"
      label="Listo 1"
      icon={<Ionicons name="checkmark" size={14} color="#fff" />}
      loading={ocupado}
      disabled={ocupado}
      onPress={onEntregarUno}
    />

    {item.pendingQty > 1 && (
      <Button
        variant="secondary"
        size="md"
        label={`Listo ${item.pendingQty}`}
        icon={<Ionicons name="checkmark-done" size={14} color="#fff" />}
        disabled={ocupado}
        onPress={onEntregarTodos}
      />
    )}

    {/* Rechazar: borrado logico con motivo. El servidor solo lo acepta si
        `deliveredQty === 0`; con entrega parcial responde 400 y hay que ir
        por cortesia. */}
    <Button
      variant="danger"
      size="md"
      label="Rechazar"
      icon={<Ionicons name="close" size={14} color="#fff" />}
      disabled={ocupado}
      onPress={onRechazar}
    />
  </View>
);

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
});

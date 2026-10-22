import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { StationOrdersScreen } from './StationOrdersScreen';
import type { Station } from '../../services';

/**
 * La pantalla de una estacion: sus pedidos pendientes y el boton que abre el
 * inventario.
 *
 * Existe porque `KitchenScreen` y `BarScreen` eran el mismo archivo copiado
 * (45 lineas identicas salvo la estacion) y `PizzaScreen` era una tercera
 * copia **a la que se le habia caido el boton**: 21 lineas, sin inventario.
 * El `PizzaStackNavigator` registraba InventoryHub, InventoryStock,
 * InventoryCount, InsumoRequestsAdmin y StationProduction — cinco pantallas
 * que el pizzero no podia abrir por ningun camino (medido el 23/09/2026).
 */
interface PantallaDeEstacionProps {
  station: Station;
  /** Navega al hub de inventario; el stack de cada rol ya lo registra. */
  onAbrirInventario: () => void;
}

export const PantallaDeEstacion: React.FC<PantallaDeEstacionProps> = ({
  station,
  onAbrirInventario,
}) => (
  <View style={s.container}>
    <StationOrdersScreen station={station} />
    <TouchableOpacity
      style={s.inventoryButton}
      onPress={onAbrirInventario}
      accessibilityRole="button"
      accessibilityLabel="Abrir inventario"
    >
      <Ionicons name="cube" size={24} color="#fff" />
    </TouchableOpacity>
  </View>
);

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  inventoryButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../constants';
import { Table, TableStatusEnum } from '../types';

interface SalonPlanoProps {
  tables: Table[];
  onTablePress: (table: Table) => void;
  waiterMap: Record<string, { waiterName?: string; orderId: string }>;
}

const getMesaEstadoColor = (status: TableStatusEnum): string => {
  switch (status) {
    case TableStatusEnum.ISAVAILABLE:
      return COLORS.line; // Gris sutil para disponible
    case TableStatusEnum.OCCUPIED:
      return COLORS.brand; // Naranja para comiendo
    case TableStatusEnum.RESERVED:
      return COLORS.accent; // Púrpura para reservado
    case TableStatusEnum.CLEANING:
      return COLORS.warn;
    case TableStatusEnum.PREPARING:
      return COLORS.info;
    default:
      return COLORS.dim;
  }
};

const getMesaEstadoIcon = (status: TableStatusEnum): keyof typeof Ionicons.glyphMap => {
  switch (status) {
    case TableStatusEnum.ISAVAILABLE:
      return 'checkmark-circle-outline';
    case TableStatusEnum.OCCUPIED:
      return 'people-outline';
    case TableStatusEnum.RESERVED:
      return 'card-outline';
    case TableStatusEnum.CLEANING:
      return 'sparkles-outline';
    case TableStatusEnum.PREPARING:
      return 'restaurant-outline';
    default:
      return 'help-circle-outline';
  }
};

/**
 * Plano visual del salón con mesas representadas como círculos
 * Estructura A: "Noche de Llanura: el club en un plano"
 *
 * - Mesas libres: gris sutil (line token)
 * - Mesas comiendo: naranja (brand token)
 * - Pidió la cuenta: púrpura (accent token)
 */
export const SalonPlano: React.FC<SalonPlanoProps> = ({
  tables,
  onTablePress,
  waiterMap,
}) => {
  // Organizar mesas en filas (máx. 4 mesas por fila para un plano compacto)
  const tablasOrdenadas = useMemo(() => {
    const rows: Table[][] = [];
    for (let i = 0; i < tables.length; i += 4) {
      rows.push(tables.slice(i, i + 4));
    }
    return rows;
  }, [tables]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <View style={styles.plano}>
        {tablasOrdenadas.map((row, rowIdx) => (
          <View key={`row-${rowIdx}`} style={styles.row}>
            {row.map((table) => {
              const estadoColor = getMesaEstadoColor(table.status);
              const isAvailable = table.status === TableStatusEnum.ISAVAILABLE;

              return (
                <TouchableOpacity
                  key={table.id}
                  style={[
                    styles.mesaContainer,
                    {
                      borderColor: estadoColor,
                      backgroundColor: isAvailable
                        ? `${estadoColor}15`
                        : `${estadoColor}10`,
                    },
                  ]}
                  onPress={() => onTablePress(table)}
                  activeOpacity={0.7}
                >
                  {/* Número o nombre de la mesa */}
                  <Text style={[styles.mesaNombre, { color: estadoColor }]}>
                    {table.name}
                  </Text>

                  {/* Icono del estado */}
                  <Ionicons
                    name={getMesaEstadoIcon(table.status)}
                    size={20}
                    color={estadoColor}
                    style={styles.mesaIcon}
                  />

                  {/* Capacidad (pequeño) */}
                  <Text style={styles.mesaCapacity}>{table.capacity}p</Text>

                  {/* Mesonero (si está ocupada) */}
                  {table.status === TableStatusEnum.OCCUPIED &&
                    waiterMap[table.id]?.waiterName && (
                      <Text
                        style={styles.mesaMesonero}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {waiterMap[table.id].waiterName}
                      </Text>
                    )}

                  {/* Indicador de estado (puntito) */}
                  <View
                    style={[
                      styles.estadoDot,
                      { backgroundColor: estadoColor },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const MESA_SIZE = 100;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  plano: {
    gap: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  mesaContainer: {
    width: MESA_SIZE,
    height: MESA_SIZE,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: SPACING.sm,
  },
  mesaNombre: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.xs,
  },
  mesaIcon: {
    marginBottom: SPACING.xs,
  },
  mesaCapacity: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.dim,
    marginBottom: SPACING.xs,
  },
  mesaMesonero: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.brand,
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: SPACING.xs,
    maxWidth: MESA_SIZE - SPACING.md,
  },
  estadoDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: SPACING.sm,
    right: SPACING.sm,
  },
});

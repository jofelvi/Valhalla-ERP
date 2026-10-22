import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../constants';
import { Table, TableStatusEnum } from '../types';

interface MesaAccionesProps {
  table: Table;
  onAgregar: (table: Table) => void;
  onCobrar: (table: Table) => void;
  onPasar?: (table: Table) => void;
}

/**
 * Componente de acciones para una mesa.
 * Se renderiza dentro del BottomSheetMesa.
 */
export const MesaAcciones: React.FC<MesaAccionesProps> = ({
  table,
  onAgregar,
  onCobrar,
  onPasar,
}) => {
  const isAvailable = table.status === TableStatusEnum.ISAVAILABLE;
  const isOccupied = table.status === TableStatusEnum.OCCUPIED;

  return (
    <View style={styles.actionsSection}>
      <Text style={styles.sectionTitle}>Acciones</Text>
      <View style={styles.actionsGrid}>
        {isAvailable && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonAdd]}
            onPress={() => onAgregar(table)}
          >
            <Ionicons
              name="add-circle-outline"
              size={24}
              color={COLORS['on-brand']}
            />
            <Text style={styles.actionLabel}>Agregar</Text>
          </TouchableOpacity>
        )}

        {isOccupied && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonAdd]}
              onPress={() => onAgregar(table)}
            >
              <Ionicons
                name="add-circle-outline"
                size={24}
                color={COLORS['on-brand']}
              />
              <Text style={styles.actionLabel}>Agregar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPay]}
              onPress={() => onCobrar(table)}
            >
              <Ionicons
                name="cash-outline"
                size={24}
                color={COLORS['on-brand']}
              />
              <Text style={styles.actionLabel}>Cobrar</Text>
            </TouchableOpacity>

            {onPasar && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPass]}
                onPress={() => onPasar(table)}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={24}
                  color={COLORS['on-brand']}
                />
                <Text style={styles.actionLabel}>Pasar</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  actionsSection: {
    marginBottom: SPACING.lg,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.dim,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionButtonAdd: {
    backgroundColor: COLORS.brand,
  },
  actionButtonPay: {
    backgroundColor: COLORS.accent,
  },
  actionButtonPass: {
    backgroundColor: COLORS.warn,
  },
  actionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS['on-brand'],
  },
});

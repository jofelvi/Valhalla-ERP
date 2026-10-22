import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../constants';
import { Table, TableStatusEnum } from '../types';

import { useVocab } from '../config/hooks';
interface MesaInfoPanelProps {
  table: Table;
  waiterName?: string | null;
  customerAlias?: string | null;
}

/**
 * Panel de información de la mesa.
 * Muestra estado, mesonero y cliente. Se renderiza en el BottomSheetMesa.
 */
export const MesaInfoPanel: React.FC<MesaInfoPanelProps> = ({
  table,
  waiterName,
  customerAlias,
}) => {
  const vocab = useVocab();
  const isOccupied = table.status === TableStatusEnum.OCCUPIED;

  return (
    <>
      {/* Estado de la mesa */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Estado</Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                table.status === TableStatusEnum.OCCUPIED
                  ? `${COLORS.brand}15`
                  : `${COLORS.ok}15`,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  table.status === TableStatusEnum.OCCUPIED
                    ? COLORS.brand
                    : COLORS.ok,
              },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              {
                color:
                  table.status === TableStatusEnum.OCCUPIED
                    ? COLORS.brand
                    : COLORS.ok,
              },
            ]}
          >
            {table.status === TableStatusEnum.OCCUPIED
              ? 'Ocupada'
              : 'Disponible'}
          </Text>
        </View>
      </View>

      {/* Mesonero (si está ocupada) */}
      {isOccupied && waiterName && (
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>{vocab.waiter}</Text>
          <View style={styles.infoRow}>
            <Ionicons
              name="person-circle-outline"
              size={16}
              color={COLORS.brand}
            />
            <Text style={styles.infoText}>{waiterName}</Text>
          </View>
        </View>
      )}

      {/* Cliente (si está ocupada) */}
      {isOccupied && customerAlias && (
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <View style={styles.infoRow}>
            <Ionicons name="pricetag-outline" size={16} color={COLORS.accent} />
            <Text style={styles.infoText}>{customerAlias}</Text>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  infoSection: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.dim,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.page}50`,
  },
  infoText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.content,
    flex: 1,
  },
});

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../constants';
import { Table } from '../types';
import { MesaAcciones } from './MesaAcciones';
import { MesaInfoPanel } from './MesaInfoPanel';

interface BottomSheetMesaProps {
  visible: boolean;
  table: Table | null;
  onClose: () => void;
  onAgregar: (table: Table) => void;
  onCobrar: (table: Table) => void;
  onPasar?: (table: Table) => void;
  waiterName?: string | null;
  customerAlias?: string | null;
}

/**
 * Panel inferior (bottom sheet) que muestra los datos de una mesa y acciones.
 * Se abre al tocar una mesa en el plano.
 */
export const BottomSheetMesa: React.FC<BottomSheetMesaProps> = ({
  visible,
  table,
  onClose,
  onAgregar,
  onCobrar,
  onPasar,
  waiterName,
  customerAlias,
}) => {
  if (!table) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.mesaNombre}>{table.name}</Text>
              <Text style={styles.mesaCapacity}>
                Capacidad: {table.capacity} personas
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name="close-circle-outline" size={24} color={COLORS.dim} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Contenido */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Info de la mesa */}
            <MesaInfoPanel
              table={table}
              waiterName={waiterName}
              customerAlias={customerAlias}
            />

            {/* Acciones rápidas */}
            <MesaAcciones
              table={table}
              onAgregar={(t) => {
                onAgregar(t);
                onClose();
              }}
              onCobrar={(t) => {
                onCobrar(t);
                onClose();
              }}
              onPasar={
                onPasar
                  ? (t) => {
                      onPasar(t);
                      onClose();
                    }
                  : undefined
              }
            />
          </ScrollView>

          {/* Close button at bottom */}
          <TouchableOpacity
            style={styles.closeButtonFooter}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
  },
  mesaNombre: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.content,
    marginBottom: SPACING.xs,
  },
  mesaCapacity: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.dim,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginBottom: SPACING.md,
  },
  content: {
    flex: 1,
    marginBottom: SPACING.lg,
  },
  closeButtonFooter: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.dim,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../constants';
import { tableService, orderService } from '../services';
import { Table, TableStatusEnum, ZoneSectorEnum } from '../types';
import { showAlert } from '../utils/alert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SectorInfo {
  key: ZoneSectorEnum;
  label: string;
  emoji: string;
}

const SECTORS: SectorInfo[] = [
  { key: ZoneSectorEnum.PISCINA, label: 'Piscina', emoji: '\u{1F3CA}' },
  { key: ZoneSectorEnum.TENIS, label: 'Tenis', emoji: '\u{1F3BE}' },
  { key: ZoneSectorEnum.FUTBOL, label: 'Futbol', emoji: '\u26BD' },
  { key: ZoneSectorEnum.BEISBOL, label: 'Beisbol', emoji: '\u26BE' },
  {
    key: ZoneSectorEnum.SALON_PRINCIPAL,
    label: 'Salon Principal',
    emoji: '\u{1F3DB}\uFE0F',
  },
  { key: ZoneSectorEnum.CANCHAS, label: 'Canchas', emoji: '\u{1F3DF}\uFE0F' },
];

const SECTOR_LABELS: Record<ZoneSectorEnum, string> = {
  [ZoneSectorEnum.PISCINA]: 'Piscina',
  [ZoneSectorEnum.TENIS]: 'Tenis',
  [ZoneSectorEnum.FUTBOL]: 'Futbol',
  [ZoneSectorEnum.BEISBOL]: 'Beisbol',
  [ZoneSectorEnum.SALON_PRINCIPAL]: 'Salon Principal',
  [ZoneSectorEnum.CANCHAS]: 'Canchas',
};

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
  sourceOrder: {
    id: string;
    tableId?: string | null;
    tableName?: string | null;
    sector?: ZoneSectorEnum | null;
  };
  onTransferComplete: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  visible,
  onClose,
  sourceOrder,
  onTransferComplete,
}) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsLoadingTables(true);
      tableService
        .getAllTables()
        .then((allTables) => {
          setTables(allTables);
          setIsLoadingTables(false);
        })
        .catch(() => {
          setIsLoadingTables(false);
        });
    }
  }, [visible]);

  const availableTables = tables.filter(
    (t) =>
      t.status === TableStatusEnum.ISAVAILABLE && t.id !== sourceOrder.tableId,
  );

  const availableSectors = SECTORS.filter((s) => s.key !== sourceOrder.sector);

  const sourceLabel = sourceOrder.tableName
    ? sourceOrder.tableName
    : sourceOrder.sector
      ? SECTOR_LABELS[sourceOrder.sector]
      : 'Desconocido';

  const handleTransferToTable = async (destTable: Table) => {
    if (isTransferring) return;
    setIsTransferring(true);

    try {
      // Actualizar la orden con nuevo destino
      await orderService.updateOrder(sourceOrder.id, {
        tableId: destTable.id,
        tableName: destTable.name,
        sector: null,
      });

      // Liberar mesa origen si habia
      if (sourceOrder.tableId) {
        await tableService.updateTableStatus(
          sourceOrder.tableId,
          TableStatusEnum.ISAVAILABLE,
          null,
        );
      }

      // Ocupar mesa destino
      await tableService.updateTableStatus(
        destTable.id,
        TableStatusEnum.OCCUPIED,
        sourceOrder.id,
      );

      onTransferComplete();
      onClose();
      showAlert('Traspaso exitoso', `Pedido movido a ${destTable.name}`);
    } catch {
      showAlert('Error', 'No se pudo traspasar el pedido');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleTransferToSector = async (sector: ZoneSectorEnum) => {
    if (isTransferring) return;
    setIsTransferring(true);

    try {
      // Actualizar la orden con nuevo destino
      await orderService.updateOrder(sourceOrder.id, {
        tableId: null,
        tableName: null,
        sector,
      });

      // Liberar mesa origen si habia
      if (sourceOrder.tableId) {
        await tableService.updateTableStatus(
          sourceOrder.tableId,
          TableStatusEnum.ISAVAILABLE,
          null,
        );
      }

      onTransferComplete();
      onClose();
      showAlert('Traspaso exitoso', `Pedido movido a ${SECTOR_LABELS[sector]}`);
    } catch {
      showAlert('Error', 'No se pudo traspasar el pedido');
    } finally {
      setIsTransferring(false);
    }
  };

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
        <View
          style={styles.content}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons
                name="swap-horizontal"
                size={24}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.title}>Traspasar pedido</Text>
            <Text style={styles.subtitle}>
              #{sourceOrder.id.slice(-6).toUpperCase()} &bull; Desde:{' '}
              {sourceLabel}
            </Text>
          </View>

          {isTransferring && (
            <View style={styles.transferringOverlay}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.transferringText}>Traspasando...</Text>
            </View>
          )}

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Mesas disponibles */}
            <Text style={styles.sectionTitle}>
              <Ionicons
                name="grid-outline"
                size={14}
                color={COLORS.textSecondary}
              />{' '}
              Mesas disponibles
            </Text>

            {isLoadingTables ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={{ marginVertical: SPACING.md }}
              />
            ) : availableTables.length === 0 ? (
              <Text style={styles.emptyText}>No hay mesas disponibles</Text>
            ) : (
              <View style={styles.tablesGrid}>
                {availableTables.map((table) => (
                  <TouchableOpacity
                    key={table.id}
                    style={styles.tableOption}
                    onPress={() => handleTransferToTable(table)}
                    activeOpacity={0.7}
                    disabled={isTransferring}
                  >
                    <Ionicons
                      name="restaurant-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.tableOptionName}>{table.name}</Text>
                    <Text style={styles.tableOptionCapacity}>
                      {table.capacity}p
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Zonas */}
            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>
              <Ionicons
                name="map-outline"
                size={14}
                color={COLORS.textSecondary}
              />{' '}
              Zonas
            </Text>

            <View style={styles.sectorsGrid}>
              {availableSectors.map((sector) => (
                <TouchableOpacity
                  key={sector.key}
                  style={styles.sectorOption}
                  onPress={() => handleTransferToSector(sector.key)}
                  activeOpacity={0.7}
                  disabled={isTransferring}
                >
                  <Text style={styles.sectorEmoji}>{sector.emoji}</Text>
                  <Text style={styles.sectorLabel}>{sector.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Cancelar */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isTransferring}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  content: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    width: SCREEN_WIDTH - SPACING.lg * 2,
    maxWidth: 420,
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  scrollContent: {
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tableOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  tableOptionName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  tableOptionCapacity: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  sectorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sectorOption: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.xl * 2 - SPACING.sm) / 2,
    maxWidth: 170,
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectorEmoji: {
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  sectorLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  cancelButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  transferringOverlay: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  transferringText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
});

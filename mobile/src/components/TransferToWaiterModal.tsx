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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../constants';
import { waiterAssignmentService } from '../services/waiterAssignmentService';
import { showAlert } from '../utils/alert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WaiterOption {
  waiterId: string;
  waiterName: string;
}

interface TransferToWaiterModalProps {
  visible: boolean;
  onClose: () => void;
  sourceOrder: {
    id: string;
    tableName?: string | null;
    sector?: string | null;
  };
  currentUserId: string;
  onTransferStart: () => void;
  onTransferComplete: (
    toWaiterId: string,
    toWaiterName: string,
    fromPct: number,
    toPct: number,
  ) => void;
}

export const TransferToWaiterModal: React.FC<TransferToWaiterModalProps> = ({
  visible,
  onClose,
  sourceOrder,
  currentUserId,
  onTransferStart,
  onTransferComplete,
}) => {
  const [waiters, setWaiters] = useState<WaiterOption[]>([]);
  const [isLoadingWaiters, setIsLoadingWaiters] = useState(false);
  const [selectedWaiter, setSelectedWaiter] = useState<WaiterOption | null>(
    null,
  );
  const [fromPct, setFromPct] = useState('50');
  const [toPct, setToPct] = useState('50');
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsLoadingWaiters(true);
      waiterAssignmentService
        .getActiveWaiters()
        .then((allWaiters) => {
          const filtered = allWaiters.filter(
            (w) => w.waiterId !== currentUserId,
          );
          setWaiters(filtered);
          setSelectedWaiter(null);
          setFromPct('50');
          setToPct('50');
        })
        .catch((err) => {
          console.error('Error cargando mesoneros:', err);
          showAlert('Error', 'No se pudo cargar la lista de mesoneros');
        })
        .finally(() => {
          setIsLoadingWaiters(false);
        });
    }
  }, [visible, currentUserId]);

  const updateFromPct = (val: string) => {
    const num = parseInt(val) || 0;
    const bounded = Math.max(0, Math.min(100, num));
    setFromPct(String(bounded));
    setToPct(String(Math.max(0, 100 - bounded)));
  };

  const updateToPct = (val: string) => {
    const num = parseInt(val) || 0;
    const bounded = Math.max(0, Math.min(100, num));
    setToPct(String(bounded));
    setFromPct(String(Math.max(0, 100 - bounded)));
  };

  const isValidTransfer = (): boolean => {
    const from = parseInt(fromPct) || 0;
    const to = parseInt(toPct) || 0;
    return from + to === 100 && selectedWaiter !== null && from > 0 && to > 0;
  };

  const handleTransfer = async () => {
    if (!selectedWaiter || !isValidTransfer()) {
      showAlert(
        'Error',
        'Selecciona un mesonero y verifica que la suma sea 100%',
      );
      return;
    }

    if (isTransferring) return;
    setIsTransferring(true);

    try {
      onTransferStart();
      const from = parseInt(fromPct) || 50;
      const to = parseInt(toPct) || 50;
      onTransferComplete(
        selectedWaiter.waiterId,
        selectedWaiter.waiterName,
        from,
        to,
      );
      onClose();
    } catch (err) {
      console.error('Error en traspaso:', err);
      showAlert('Error', 'No se pudo completar el traspaso');
    } finally {
      setIsTransferring(false);
    }
  };

  const sourceLabel = sourceOrder.tableName || sourceOrder.sector || 'Pedido';

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
            <Text style={styles.title}>Ceder a colega</Text>
            <Text style={styles.subtitle}>
              #{sourceOrder.id.slice(-6).toUpperCase()} &bull; {sourceLabel}
            </Text>
          </View>

          {isTransferring && (
            <View style={styles.transferringOverlay}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.transferringText}>
                Registrando traspaso...
              </Text>
            </View>
          )}

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Seleccionar mesonero */}
            <Text style={styles.sectionTitle}>
              <Ionicons
                name="person-outline"
                size={14}
                color={COLORS.textSecondary}
              />{' '}
              Elige un colega
            </Text>

            {isLoadingWaiters ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={{ marginVertical: SPACING.md }}
              />
            ) : waiters.length === 0 ? (
              <Text style={styles.emptyText}>No hay mesoneros disponibles</Text>
            ) : (
              <View style={styles.waitersList}>
                {waiters.map((waiter) => (
                  <TouchableOpacity
                    key={waiter.waiterId}
                    style={[
                      styles.waiterOption,
                      selectedWaiter?.waiterId === waiter.waiterId &&
                        styles.waiterOptionSelected,
                    ]}
                    onPress={() => setSelectedWaiter(waiter)}
                    activeOpacity={0.7}
                    disabled={isTransferring}
                  >
                    <Ionicons
                      name={
                        selectedWaiter?.waiterId === waiter.waiterId
                          ? 'radio-button-on'
                          : 'radio-button-off'
                      }
                      size={18}
                      color={COLORS.primary}
                      style={styles.radioIcon}
                    />
                    <Text style={styles.waiterName}>{waiter.waiterName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Reparto de porcentajes */}
            {selectedWaiter && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>
                  <Ionicons
                    name="pie-chart-outline"
                    size={14}
                    color={COLORS.textSecondary}
                  />{' '}
                  Reparto de propina y comisión
                </Text>

                <Text style={styles.shareDescription}>
                  Tu parte de propina y comisión de esta orden será {fromPct}% y
                  la de{' '}
                  <Text style={styles.shareWaiterName}>
                    {selectedWaiter.waiterName}
                  </Text>{' '}
                  {toPct}%.
                </Text>

                <View style={styles.percentGrid}>
                  <View style={styles.percentColumn}>
                    <Text style={styles.percentLabel}>Tu parte</Text>
                    <View style={styles.percentInputContainer}>
                      <TouchableOpacity
                        onPress={() =>
                          updateFromPct(
                            String(Math.max(0, parseInt(fromPct) - 5)),
                          )
                        }
                        disabled={isTransferring}
                      >
                        <Ionicons
                          name="remove-circle-outline"
                          size={24}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.percentInput}
                        value={fromPct}
                        onChangeText={updateFromPct}
                        keyboardType="number-pad"
                        editable={!isTransferring}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          updateFromPct(
                            String(Math.min(100, parseInt(fromPct) + 5)),
                          )
                        }
                        disabled={isTransferring}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={24}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.percentUnit}>%</Text>
                  </View>

                  <View style={styles.percentArrow}>
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color={COLORS.textSecondary}
                    />
                  </View>

                  <View style={styles.percentColumn}>
                    <Text style={styles.percentLabel}>
                      Parte de {selectedWaiter.waiterName.split(' ')[0]}
                    </Text>
                    <View style={styles.percentInputContainer}>
                      <TouchableOpacity
                        onPress={() =>
                          updateToPct(String(Math.max(0, parseInt(toPct) - 5)))
                        }
                        disabled={isTransferring}
                      >
                        <Ionicons
                          name="remove-circle-outline"
                          size={24}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.percentInput}
                        value={toPct}
                        onChangeText={updateToPct}
                        keyboardType="number-pad"
                        editable={!isTransferring}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          updateToPct(
                            String(Math.min(100, parseInt(toPct) + 5)),
                          )
                        }
                        disabled={isTransferring}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={24}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.percentUnit}>%</Text>
                  </View>
                </View>

                {parseInt(fromPct) + parseInt(toPct) !== 100 && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color="COLORS.errorLight" />
                    <Text style={styles.errorText}>La suma debe ser 100%</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Botones de acción */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isTransferring}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!isValidTransfer() || isTransferring) &&
                  styles.confirmButtonDisabled,
              ]}
              onPress={handleTransfer}
              disabled={!isValidTransfer() || isTransferring}
              activeOpacity={0.8}
            >
              {isTransferring ? (
                <ActivityIndicator size="small" color={COLORS.background} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color={COLORS.background}
                  />
                  <Text style={styles.confirmText}>Ceder</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
    maxHeight: '90%',
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
    maxHeight: 450,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  waitersList: {
    gap: SPACING.sm,
  },
  waiterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  waiterOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}08`,
  },
  radioIcon: {
    marginRight: SPACING.xs,
  },
  waiterName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    flex: 1,
  },
  shareDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  shareWaiterName: {
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  percentGrid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  percentColumn: {
    flex: 1,
    alignItems: 'center',
  },
  percentLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  percentInputContainer: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  percentInput: {
    width: 50,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    textAlign: 'center',
  },
  percentUnit: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  percentArrow: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorLight,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.errorLight,
    gap: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.errorLight,
    fontWeight: FONT_WEIGHT.semibold,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.textLight,
    opacity: 0.6,
  },
  confirmText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  transferringOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: BORDER_RADIUS.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  transferringText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    marginTop: SPACING.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
});

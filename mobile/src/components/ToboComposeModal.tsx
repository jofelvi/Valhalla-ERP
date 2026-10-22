import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../constants';
import {
  TOBO_VARIANTS,
  BARRA_WAREHOUSE_ID,
  ToboContainer,
} from '../constants/toboRegistry';
import { inventoryService } from '../services/inventoryService';
import { CartItemComposition } from '../types';

interface ToboComposeModalProps {
  visible: boolean;
  productName: string;
  container: ToboContainer;
  totalUnits: number;
  onClose: () => void;
  onConfirm: (composition: CartItemComposition[]) => void;
}

// Umbral de "stock bajo" si el producto no lo trae; solo informativo.
const LOW_STOCK_DEFAULT = 24;

export const ToboComposeModal: React.FC<ToboComposeModalProps> = ({
  visible,
  productName,
  container,
  totalUnits,
  onClose,
  onConfirm,
}) => {
  const variants = TOBO_VARIANTS[container];
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [stockById, setStockById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQtyById({});
    setLoading(true);
    inventoryService
      .getStock(BARRA_WAREHOUSE_ID)
      .then((items) => {
        const map: Record<string, number> = {};
        for (const it of items) map[it.productId] = it.qty;
        setStockById(map);
      })
      .catch(() => setStockById({}))
      .finally(() => setLoading(false));
  }, [visible, container]);

  const assigned = useMemo(
    () => Object.values(qtyById).reduce((s, n) => s + n, 0),
    [qtyById],
  );
  const remaining = totalUnits - assigned;

  const setQty = (variantProductId: string, next: number) => {
    // No dejar asignar más de lo que falta ni bajar de 0.
    const current = qtyById[variantProductId] ?? 0;
    const maxAllowed = current + remaining; // lo que ya tiene + lo libre
    const clamped = Math.max(0, Math.min(next, maxAllowed));
    setQtyById((prev) => ({ ...prev, [variantProductId]: clamped }));
  };

  const confirm = () => {
    if (assigned !== totalUnits) return;
    const composition: CartItemComposition[] = variants
      .map((v) => ({
        variantProductId: v.variantProductId,
        variantName: v.name,
        qty: qtyById[v.variantProductId] ?? 0,
      }))
      .filter((c) => c.qty > 0);
    onConfirm(composition);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{productName}</Text>
              <Text style={styles.subtitle}>
                Arma tu {container === 'lata' ? 'tobo de latas' : 'tobo'} (
                {totalUnits})
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.counter, remaining === 0 && styles.counterDone]}>
            {remaining === 0
              ? '¡Completo!'
              : `Faltan ${remaining} de ${totalUnits}`}
          </Text>

          {loading ? (
            <ActivityIndicator
              color={COLORS.primary}
              style={{ marginVertical: SPACING.lg }}
            />
          ) : (
            variants.map((v) => {
              const value = qtyById[v.variantProductId] ?? 0;
              const stock = stockById[v.variantProductId] ?? 0;
              const noStock = stock <= 0;
              const low = !noStock && stock <= LOW_STOCK_DEFAULT;
              return (
                <View key={v.variantProductId} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text
                      style={[styles.rowName, noStock && styles.rowNameOff]}
                    >
                      {v.name}
                    </Text>
                    {noStock ? (
                      <Text style={styles.noStock}>Sin stock</Text>
                    ) : low ? (
                      <Text style={styles.low}>Queda poco: {stock}</Text>
                    ) : null}
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setQty(v.variantProductId, value - 1)}
                      disabled={value <= 0}
                    >
                      <Ionicons
                        name="remove"
                        size={20}
                        color={COLORS.textWhite}
                      />
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{value}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setQty(v.variantProductId, value + 1)}
                      disabled={noStock || remaining <= 0}
                    >
                      <Ionicons name="add" size={20} color={COLORS.textWhite} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <TouchableOpacity
            style={[
              styles.confirm,
              assigned !== totalUnits && styles.confirmOff,
            ]}
            onPress={confirm}
            disabled={assigned !== totalUnits}
          >
            <Text style={styles.confirmText}>Agregar tobo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  counter: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    marginVertical: SPACING.md,
    textAlign: 'center',
  },
  counterDone: { color: COLORS.success },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  rowInfo: { flex: 1 },
  rowName: { color: COLORS.textWhite, fontSize: FONT_SIZE.md },
  rowNameOff: { color: COLORS.textSecondary },
  noStock: { color: COLORS.error, fontSize: FONT_SIZE.xs },
  low: { color: COLORS.warning, fontSize: FONT_SIZE.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.lg,
    minWidth: 28,
    textAlign: 'center',
  },
  confirm: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  confirmOff: { opacity: 0.4 },
  confirmText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
});

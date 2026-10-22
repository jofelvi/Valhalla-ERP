import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../constants';
import { fichaService, FichaView } from '../services/fichaService';
import { genClientRequestId } from '../services/orderService';
import { Station } from '../services/kitchenOrderService';
import { useAuthStore } from '../store';
import { UserRoleEnum } from '../types';
import { showAlert } from '../utils/alert';

interface FichaDeliveryModalProps {
  visible: boolean;
  ficha: FichaView | null;
  // Estación de la pantalla que escanea: el modal muestra SOLO sus ítems.
  station: Station;
  onClose: () => void;
  onChanged: (updated: FichaView) => void;
}

type Mode = 'deliver' | 'return';

export const FichaDeliveryModal: React.FC<FichaDeliveryModalProps> = ({
  visible,
  ficha,
  station,
  onClose,
  onChanged,
}) => {
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.user?.role);
  // Devolver a pendiente es un vector de robo: solo admin/gerente. El personal
  // de estación (barra/cocina/pizza) solo entrega.
  const mandaEnTodasLasAreas =
    role === UserRoleEnum.ADMIN || role === UserRoleEnum.MANAGER;
  const canReturn = mandaEnTodasLasAreas;
  const [mode, setMode] = useState<Mode>('deliver');
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  // Id de idempotencia: uno por tanda de entrega, estable en reintentos.
  const opIdRef = useRef<string>('');

  useEffect(() => {
    if (visible) {
      setMode('deliver');
      setQtyById({});
      // Generar un nuevo opId al abrir el modal — se reutiliza en reintentos.
      opIdRef.current = genClientRequestId();
    }
  }, [visible, ficha?.orderId]);

  // La ficha trae ítems de las 3 estaciones controladas. El personal solo ve
  // y entrega los de SU estación (blindaje anti-robo), pero el admin/gerente
  // los ve TODOS: es quien cubre turnos y resuelve enredos, y de nada le sirve
  // escanear si la pantalla le esconde lo de las otras áreas.
  const stationItems = (ficha?.items ?? []).filter(
    (i) => mandaEnTodasLasAreas || i.station === station,
  );

  // Clave por fila: tobo mixto = "itemId::variantProductId"; ítem suelto = "itemId".
  const keyFor = (itemId: string, variantProductId?: string): string =>
    variantProductId ? `${itemId}::${variantProductId}` : itemId;

  // Tope de la fila según el modo (entregar hasta pendiente, devolver hasta entregado).
  const maxForKey = (key: string): number => {
    const [itemId, variantProductId] = key.split('::');
    const it = stationItems.find((i) => i.itemId === itemId);
    if (!it) return 0;
    if (variantProductId) {
      const v = it.composition?.find(
        (c) => c.variantProductId === variantProductId,
      );
      if (!v) return 0;
      return mode === 'deliver' ? v.pendingQty : v.deliveredQty;
    }
    return mode === 'deliver' ? it.pendingQty : it.deliveredQty;
  };

  const totalSelected = useMemo(
    () => Object.values(qtyById).reduce((s, n) => s + n, 0),
    [qtyById],
  );

  const setQty = (key: string, next: number) => {
    const clamped = Math.max(0, Math.min(next, maxForKey(key)));
    setQtyById((prev) => ({ ...prev, [key]: clamped }));
  };

  const submit = async () => {
    if (!ficha || totalSelected === 0 || busy) return;
    const lines = Object.entries(qtyById)
      .filter(([, delta]) => delta > 0)
      .map(([key, delta]) => {
        const [itemId, variantProductId] = key.split('::');
        return variantProductId
          ? { itemId, variantProductId, delta }
          : { itemId, delta };
      });
    setBusy(true);
    try {
      const updated =
        mode === 'deliver'
          ? await fichaService.deliver(
              ficha.fichaToken,
              lines,
              mandaEnTodasLasAreas ? undefined : station,
              opIdRef.current,
            )
          : await fichaService.returnUnits(
              ficha.fichaToken,
              lines,
              mandaEnTodasLasAreas ? undefined : station,
              opIdRef.current,
            );
      onChanged(updated);
      // Se cierra cuando ya no queda nada que entregar EN LO QUE ESTA PANTALLA
      // muestra: para el personal, su estación; para el admin, la ficha entera.
      const pendientes = updated.items.filter(
        (i) => mandaEnTodasLasAreas || i.station === station,
      );
      if (pendientes.length === 0) {
        showAlert(
          'Listo',
          mandaEnTodasLasAreas
            ? 'No quedan ítems pendientes en esta ficha'
            : 'No quedan ítems pendientes de esta estación',
        );
        onClose();
      } else {
        // Nueva tanda: generar opId fresco.
        opIdRef.current = genClientRequestId();
        setQtyById({});
      }
    } catch (e) {
      showAlert(
        'Error',
        e instanceof Error ? e.message : 'No se pudo registrar la operación',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!ficha) return null;

  const actionLabel = mode === 'deliver' ? 'Entregar' : 'Devolver';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[styles.sheet, { paddingBottom: SPACING.lg + insets.bottom }]}
        >
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.title}>Orden #{ficha.orderNumber}</Text>
              <Text style={styles.subtitle}>
                {ficha.tableName ?? ficha.sector ?? 'Para llevar'}
              </Text>
              {(ficha.waiterName || ficha.createdAt) && (
                <Text style={styles.meta}>
                  {ficha.waiterName ? `Mesonero: ${ficha.waiterName}` : ''}
                  {ficha.waiterName && ficha.createdAt ? '  ·  ' : ''}
                  {ficha.createdAt
                    ? new Date(ficha.createdAt).toLocaleTimeString('es-VE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {canReturn && (
            <View style={styles.tabs}>
              {(['deliver', 'return'] as Mode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.tab, mode === m && styles.tabActive]}
                  onPress={() => {
                    setMode(m);
                    setQtyById({});
                  }}
                >
                  <Text
                    style={[styles.tabText, mode === m && styles.tabTextActive]}
                  >
                    {m === 'deliver' ? 'Entregar' : 'Devolver'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView style={styles.list}>
            {stationItems.map((it) => {
              // Tobo mixto: una fila por variante (Light/Pilsen/Azul).
              if (it.composition && it.composition.length) {
                return (
                  <View key={it.itemId}>
                    <Text style={styles.groupName}>{it.productName}</Text>
                    {it.composition.map((v) => {
                      const key = keyFor(it.itemId, v.variantProductId);
                      const value = qtyById[key] ?? 0;
                      const max =
                        mode === 'deliver' ? v.pendingQty : v.deliveredQty;
                      return (
                        <View key={key} style={styles.row}>
                          <View style={styles.rowInfo}>
                            <Text style={styles.rowName}> {v.variantName}</Text>
                            <Text style={styles.rowMeta}>
                              {mode === 'deliver'
                                ? `Pendiente: ${v.pendingQty}`
                                : `Entregado: ${v.deliveredQty}`}
                            </Text>
                          </View>
                          <View style={styles.stepper}>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => setQty(key, value - 1)}
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
                              onPress={() => setQty(key, value + 1)}
                              disabled={value >= max}
                            >
                              <Ionicons
                                name="add"
                                size={20}
                                color={COLORS.textWhite}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              }

              // Ítem suelto: una fila por ítem.
              const value = qtyById[it.itemId] ?? 0;
              const max = mode === 'deliver' ? it.pendingQty : it.deliveredQty;
              return (
                <View key={it.itemId} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{it.productName}</Text>
                    <Text style={styles.rowMeta}>
                      {mode === 'deliver'
                        ? `Pendiente: ${it.pendingQty}`
                        : `Entregado: ${it.deliveredQty}`}
                    </Text>
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setQty(it.itemId, value - 1)}
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
                      onPress={() => setQty(it.itemId, value + 1)}
                      disabled={value >= max}
                    >
                      <Ionicons name="add" size={20} color={COLORS.textWhite} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.submit,
              (totalSelected === 0 || busy) && styles.submitDisabled,
            ]}
            onPress={submit}
            disabled={totalSelected === 0 || busy}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.submitText}>
                {actionLabel} {totalSelected > 0 ? `(${totalSelected})` : ''}
              </Text>
            )}
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
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: { flex: 1, paddingRight: SPACING.md },
  title: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  meta: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: 2,
  },
  tabs: { flexDirection: 'row', marginVertical: SPACING.md, gap: SPACING.sm },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.semibold },
  tabTextActive: { color: COLORS.textWhite },
  list: { marginBottom: SPACING.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  rowInfo: { flex: 1 },
  groupName: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.sm,
  },
  rowName: { color: COLORS.textWhite, fontSize: FONT_SIZE.md },
  rowMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
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
  submit: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
});

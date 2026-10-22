// Vista de despacho unificada: Cocina, Barra, Pizza.
// Admin/Manager pueden ver todas las áreas, marcar entregas y rechazos.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../../constants';
import { Button } from '../../components/ui/Button';
import { AccionesDeItem } from '../../components/station/AccionesDeItem';
import {
  orderService,
  kitchenOrderService,
  flattenPendingItems,
  type PendingStationItem,
} from '../../services';
import { api } from '../../services/api/apiClient';
import { PACKAGING } from '../../services/packagingService';
import { useProductosDelMenu } from '../../queries/useCatalogo';
import {
  filtrarPorArea,
  ESTACIONES_DE_DESPACHO,
} from '../../services/areaDeDespacho';
import { Order } from '../../types/models';
import { UserRoleEnum } from '../../types';
import { useAuthStore } from '../../store';
import { BarcodeScannerModal, FichaDeliveryModal } from '../../components';
import { fichaService } from '../../services/fichaService';
import type { FichaView } from '../../services/fichaService';
import { showAlert } from '../../utils/alert';

type Area = 'KITCHEN' | 'BAR' | 'PIZZA';

interface OrderGroup {
  orderId: string;
  orderNumber?: string;
  tableName?: string;
  sector?: string;
  waiterName?: string;
  customerAlias?: string;
  orderCreatedAt: Date | null;
  items: PendingStationItem[];
  totalPendingUnits: number;
  oldestMinutes: number;
}

function groupByOrder(items: PendingStationItem[]): OrderGroup[] {
  const map = new Map<string, OrderGroup>();
  for (const it of items) {
    const existing = map.get(it.orderId);
    if (existing) {
      existing.items.push(it);
      existing.totalPendingUnits += it.pendingQty;
    } else {
      map.set(it.orderId, {
        orderId: it.orderId,
        orderNumber: it.orderNumber,
        tableName: it.tableName,
        sector: it.sector,
        waiterName: it.waiterName,
        customerAlias: it.customerAlias,
        orderCreatedAt: it.orderCreatedAt,
        items: [it],
        totalPendingUnits: it.pendingQty,
        oldestMinutes: 0,
      });
    }
  }
  const groups = Array.from(map.values());
  for (const g of groups) {
    const oldest = g.items.reduce((min, it) => {
      const t = (it.addedAt ?? g.orderCreatedAt)?.getTime?.() ?? 0;
      return t > 0 && (min === 0 || t < min) ? t : min;
    }, 0);
    g.oldestMinutes =
      oldest > 0 ? Math.floor((Date.now() - oldest) / 60000) : 0;
  }
  groups.sort((a, b) => b.oldestMinutes - a.oldestMinutes);
  return groups;
}

export const DispatchScreen: React.FC = () => {
  const [selectedArea, setSelectedArea] = useState<Area>('KITCHEN');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyItems, setBusyItems] = useState<Set<string>>(new Set());
  const [busyOrders, setBusyOrders] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  // Modal de rechazo
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingItem, setRejectingItem] = useState<PendingStationItem | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectingSubmit, setIsRejectingSubmit] = useState(false);

  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

  // Verificar que sea admin/manager
  const isAdminOrManager =
    role === UserRoleEnum.ADMIN || role === UserRoleEnum.MANAGER;

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Suscripción WS
  useEffect(() => {
    setLoading(true);
    const unsubscribe = orderService.subscribeToActiveOrdersForStation(
      (list) => {
        setOrders(list);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  // Escaneo de ficha: el admin quema (entrega) contra el QR del cliente, igual
  // que hace cada estación, pero sin el candado de área — el servidor lo
  // permite por su rol.
  const [showScanner, setShowScanner] = useState(false);
  const [fichaModal, setFichaModal] = useState<FichaView | null>(null);

  const handleScanned = useCallback((code: string) => {
    setShowScanner(false);
    const clean = code.trim();
    if (!clean.startsWith('AR1.')) {
      showAlert(
        'Código no reconocido',
        'Escanea la ficha del cliente (empieza por AR1.)',
      );
      return;
    }
    fichaService
      .getByToken(clean)
      .then((ficha) => {
        if (!ficha.items.length) {
          showAlert('Nada pendiente', 'Esta ficha no tiene ítems pendientes');
          return;
        }
        setFichaModal(ficha);
      })
      .catch((e) => {
        showAlert(
          'Ficha',
          e instanceof Error ? e.message : 'Ficha no válida o anulada',
        );
      });
  }, []);

  // Obtener map de productId → categoryId/station para determinar pizza
  const { data: productsData = [] } = useProductosDelMenu();

  const productLookupFn = useMemo(() => {
    const map = new Map<
      string,
      { categoryId?: string; station?: string | null }
    >();
    for (const p of productsData) {
      map.set(p.id, { categoryId: p.categoryId, station: p.station });
    }
    return (productId: string) => map.get(productId);
  }, [productsData]);

  // Filtrar items por area. La logica vive en `areaDeDespacho` (con pruebas):
  // pizza se marca de dos formas segun la antiguedad de la orden y mirar solo
  // una dejaba items fuera de las tres pestanas.
  const filterItemsByArea = useCallback(
    (items: PendingStationItem[], area: Area): PendingStationItem[] => {
      const categoriaDe = (productId: string) =>
        productLookupFn(productId)?.categoryId;

      return filtrarPorArea(
        items,
        area,
        categoriaDe,
        PACKAGING.pizzasCategoryId,
      );
    },
    [productLookupFn],
  );

  // Obtener items pendientes del área actual
  const allPendingItems = useMemo(() => {
    // Las TRES estaciones. Pedir solo KITCHEN y BAR dejaba fuera de la
    // pantalla TODO lo que trae station 'PIZZA': no salia ni en pizza ni
    // en cocina, y desde el APK no habia nada que quemar.
    return ESTACIONES_DE_DESPACHO.flatMap((st) =>
      flattenPendingItems(orders, st),
    );
  }, [orders]);

  const areaItems = useMemo(() => {
    return filterItemsByArea(allPendingItems, selectedArea);
  }, [allPendingItems, selectedArea, filterItemsByArea]);

  const groups = useMemo(() => groupByOrder(areaItems), [areaItems]);

  const countByArea = useMemo(() => {
    const kitchen = filterItemsByArea(allPendingItems, 'KITCHEN').length;
    const bar = filterItemsByArea(allPendingItems, 'BAR').length;
    const pizza = filterItemsByArea(allPendingItems, 'PIZZA').length;
    return { KITCHEN: kitchen, BAR: bar, PIZZA: pizza };
  }, [allPendingItems, filterItemsByArea]);

  const handleDeliverOne = useCallback(
    async (item: PendingStationItem) => {
      const key = `${item.orderId}:${item.itemId}`;
      if (busyItems.has(key)) return;
      setBusyItems((prev) => new Set(prev).add(key));
      try {
        await kitchenOrderService.deliverItem(item.orderId, item.itemId, 1);
      } catch (e) {
        showAlert(
          'Error',
          e instanceof Error ? e.message : 'No se pudo marcar como entregado',
        );
      } finally {
        setBusyItems((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [busyItems],
  );

  const handleDeliverAllOfItem = useCallback(
    async (item: PendingStationItem) => {
      const key = `${item.orderId}:${item.itemId}`;
      if (busyItems.has(key)) return;
      if (item.pendingQty <= 1) {
        await handleDeliverOne(item);
        return;
      }
      showAlert(
        'Marcar todo este item',
        `Marcar ${item.pendingQty} unidades de "${item.productName}" como entregadas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Sí, todo',
            onPress: async () => {
              setBusyItems((prev) => new Set(prev).add(key));
              try {
                await kitchenOrderService.deliverItemAll(
                  item.orderId,
                  item.itemId,
                  item.pendingQty,
                );
              } catch (e) {
                showAlert(
                  'Error',
                  e instanceof Error ? e.message : 'No se pudo marcar',
                );
              } finally {
                setBusyItems((prev) => {
                  const next = new Set(prev);
                  next.delete(key);
                  return next;
                });
              }
            },
          },
        ],
      );
    },
    [busyItems, handleDeliverOne],
  );

  const handleRejectItem = useCallback((item: PendingStationItem) => {
    setRejectingItem(item);
    setRejectReason('');
    setRejectModalVisible(true);
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectingItem || !rejectReason.trim()) {
      showAlert('Error', 'Debes ingresar un motivo de rechazo');
      return;
    }

    setIsRejectingSubmit(true);
    try {
      await api.patch(
        `/api/orders/${rejectingItem.orderId}/items/${rejectingItem.itemId}/cancel`,
        { reason: rejectReason.trim() },
      );
      setRejectModalVisible(false);
      setRejectingItem(null);
      setRejectReason('');
      showAlert(
        'Rechazado',
        `"${rejectingItem.productName}" ha sido rechazado y eliminado de la orden.`,
      );
    } catch (e) {
      showAlert(
        'Error',
        e instanceof Error ? e.message : 'No se pudo rechazar el item',
      );
    } finally {
      setIsRejectingSubmit(false);
    }
  }, [rejectingItem, rejectReason]);

  const handleDeliverAllOrder = useCallback(
    async (group: OrderGroup) => {
      if (busyOrders.has(group.orderId)) return;

      if (selectedArea === 'BAR') {
        // Para Barra: usar deliverStation BAR
        showAlert(
          'Despachar área',
          `¿Marcar TODOS los ${group.totalPendingUnits} items de barra como entregados?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Sí, despachar',
              onPress: async () => {
                setBusyOrders((prev) => new Set(prev).add(group.orderId));
                try {
                  await kitchenOrderService.deliverStation(
                    group.orderId,
                    'BAR',
                  );
                } catch (e) {
                  showAlert(
                    'Error',
                    e instanceof Error ? e.message : 'No se pudo marcar',
                  );
                } finally {
                  setBusyOrders((prev) => {
                    const next = new Set(prev);
                    next.delete(group.orderId);
                    return next;
                  });
                }
              },
            },
          ],
        );
      } else {
        // Para Cocina/Pizza: deliverItemAll para cada item visible en esta área
        showAlert(
          'Despachar área',
          `¿Marcar TODOS los ${group.totalPendingUnits} items de ${selectedArea === 'PIZZA' ? 'pizzas' : 'cocina'} como entregados?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Sí, despachar',
              onPress: async () => {
                setBusyOrders((prev) => new Set(prev).add(group.orderId));
                try {
                  for (const item of group.items) {
                    if (item.pendingQty > 0) {
                      await kitchenOrderService.deliverItemAll(
                        item.orderId,
                        item.itemId,
                        item.pendingQty,
                      );
                    }
                  }
                } catch (e) {
                  showAlert(
                    'Error',
                    e instanceof Error ? e.message : 'No se pudo marcar',
                  );
                } finally {
                  setBusyOrders((prev) => {
                    const next = new Set(prev);
                    next.delete(group.orderId);
                    return next;
                  });
                }
              },
            },
          ],
        );
      }
    },
    [busyOrders, selectedArea],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // Si no es admin/manager, mostrar mensaje
  if (!isAdminOrManager) {
    return (
      <View style={styles.restrictedContainer}>
        <View style={styles.restrictedIcon}>
          <Ionicons name="lock-closed" size={56} color={COLORS.warning} />
        </View>
        <Text style={styles.restrictedTitle}>Solo Administración</Text>
        <Text style={styles.restrictedSubtitle}>
          Esta pantalla es solo para administradores y managers.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="paper-plane" size={28} color={COLORS.primary} />
          <View>
            <Text style={styles.headerTitle}>Despacho</Text>
            <Text style={styles.headerSubtitle}>{user?.name ?? '...'}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Button
            label="Escanear"
            variant="primary"
            size="sm"
            icon={<Ionicons name="qr-code-outline" size={20} color="#fff" />}
            onPress={() => setShowScanner(true)}
            accessibilityLabel="Escanear ficha"
          />
          <TouchableOpacity
            onPress={() => void signOut()}
            style={styles.logoutBtn}
          >
            <Ionicons
              name="log-out-outline"
              size={22}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Area chips */}
      <View style={styles.chipsContainer}>
        <TouchableOpacity
          style={[styles.chip, selectedArea === 'KITCHEN' && styles.chipActive]}
          onPress={() => setSelectedArea('KITCHEN')}
        >
          <Ionicons
            name="restaurant"
            size={16}
            color={selectedArea === 'KITCHEN' ? '#fff' : COLORS.primary}
          />
          <Text
            style={[
              styles.chipText,
              selectedArea === 'KITCHEN' && styles.chipTextActive,
            ]}
          >
            Cocina
          </Text>
          <View
            style={[
              styles.chipBadge,
              selectedArea === 'KITCHEN' && styles.chipBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.chipBadgeText,
                selectedArea === 'KITCHEN' && styles.chipBadgeTextActive,
              ]}
            >
              {countByArea.KITCHEN}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, selectedArea === 'BAR' && styles.chipActive]}
          onPress={() => setSelectedArea('BAR')}
        >
          <Ionicons
            name="wine"
            size={16}
            color={selectedArea === 'BAR' ? '#fff' : COLORS.primary}
          />
          <Text
            style={[
              styles.chipText,
              selectedArea === 'BAR' && styles.chipTextActive,
            ]}
          >
            Barra
          </Text>
          <View
            style={[
              styles.chipBadge,
              selectedArea === 'BAR' && styles.chipBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.chipBadgeText,
                selectedArea === 'BAR' && styles.chipBadgeTextActive,
              ]}
            >
              {countByArea.BAR}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, selectedArea === 'PIZZA' && styles.chipActive]}
          onPress={() => setSelectedArea('PIZZA')}
        >
          <Ionicons
            name="pizza"
            size={16}
            color={selectedArea === 'PIZZA' ? '#fff' : COLORS.primary}
          />
          <Text
            style={[
              styles.chipText,
              selectedArea === 'PIZZA' && styles.chipTextActive,
            ]}
          >
            Pizzas
          </Text>
          <View
            style={[
              styles.chipBadge,
              selectedArea === 'PIZZA' && styles.chipBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.chipBadgeText,
                selectedArea === 'PIZZA' && styles.chipBadgeTextActive,
              ]}
            >
              {countByArea.PIZZA}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
          <Text style={styles.emptyTitle}>
            Nada pendiente en{' '}
            {selectedArea === 'PIZZA'
              ? 'pizzas'
              : selectedArea === 'BAR'
                ? 'barra'
                : 'cocina'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Todas las órdenes de esta área han sido despachadas ✅
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          {groups.map((group) => {
            const orderBusy = busyOrders.has(group.orderId);
            const isOld = group.oldestMinutes >= 15;
            return (
              <View
                key={group.orderId}
                style={[styles.orderCard, isOld && styles.orderCardUrgent]}
              >
                {/* Cabecera */}
                <View style={styles.orderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderTitle}>
                      {group.tableName ?? group.sector ?? 'Para llevar'}
                    </Text>
                    <Text style={styles.orderSubtitle}>
                      {group.orderNumber ??
                        `#${group.orderId.slice(-6).toUpperCase()}`}
                      {group.waiterName ? ` · ${group.waiterName}` : ''}
                      {group.customerAlias ? ` · ${group.customerAlias}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[styles.timeBadge, isOld && styles.timeBadgeUrgent]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={isOld ? COLORS.error : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.timeBadgeText,
                        isOld && styles.timeBadgeTextUrgent,
                      ]}
                    >
                      {group.oldestMinutes} min
                    </Text>
                  </View>
                </View>

                {/* Items */}
                {group.items.map((item) => {
                  const itemKey = `${item.orderId}:${item.itemId}`;
                  const itemBusy = busyItems.has(itemKey) || orderBusy;

                  return (
                    <View key={item.itemId} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.productName}</Text>
                        <Text style={styles.itemQty}>
                          Pendientes:{' '}
                          <Text style={styles.itemQtyHighlight}>
                            {item.pendingQty}
                          </Text>
                        </Text>
                        {item.notes ? (
                          <Text style={styles.itemNotes}>{item.notes}</Text>
                        ) : null}
                      </View>
                      <View style={styles.itemActions}>
                        <AccionesDeItem
                          item={item}
                          ocupado={itemBusy}
                          onEntregarUno={() => void handleDeliverOne(item)}
                          onEntregarTodos={() =>
                            void handleDeliverAllOfItem(item)
                          }
                          onRechazar={() => handleRejectItem(item)}
                        />
                      </View>
                    </View>
                  );
                })}

                {/* Botón Despachar todo */}
                <Button
                  label={`Despachar todo (${group.totalPendingUnits})`}
                  variant="secondary"
                  size="md"
                  icon={
                    <Ionicons name="send" size={18} color={COLORS.primary} />
                  }
                  onPress={() => void handleDeliverAllOrder(group)}
                  disabled={orderBusy}
                  loading={orderBusy}
                  style={styles.btnDeliverAll}
                />
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={handleScanned}
      />

      <FichaDeliveryModal
        visible={!!fichaModal}
        ficha={fichaModal}
        // La estación es indiferente para admin/gerente: el modal le muestra la
        // ficha completa y el servidor no le aplica el candado de área.
        station="KITCHEN"
        onClose={() => setFichaModal(null)}
        // La lista se refresca sola por WebSocket; aqui basta con quedarse
        // con la ficha actualizada para seguir entregando en la misma tanda.
        onChanged={(actualizada) => setFichaModal(actualizada)}
      />

      {/* Modal de rechazo */}
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rechazar Item</Text>
            <Text style={styles.modalSubtitle}>
              {rejectingItem?.productName} × {rejectingItem?.pendingQty}
            </Text>

            <Text style={styles.modalLabel}>Motivo del rechazo</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: sin insumo, se cayó, error..."
              placeholderTextColor={COLORS.textSecondary}
              value={rejectReason}
              onChangeText={setRejectReason}
              editable={!isRejectingSubmit}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <Button
                label="Cancelar"
                variant="secondary"
                size="md"
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectingItem(null);
                }}
                disabled={isRejectingSubmit}
                style={{ flex: 1 }}
              />
              <Button
                label="Rechazar"
                variant="danger"
                size="md"
                onPress={() => void handleRejectConfirm()}
                disabled={isRejectingSubmit}
                loading={isRejectingSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  restrictedIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.warning}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  restrictedTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  restrictedSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  headerTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  logoutBtn: { padding: SPACING.sm },

  // Chips
  chipsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  chipTextActive: { color: '#fff' },
  chipBadge: {
    marginLeft: SPACING.xs,
    backgroundColor: `${COLORS.primary}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 20,
    alignItems: 'center',
  },
  chipBadgeActive: { backgroundColor: `#fff80` },
  chipBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  chipBadgeTextActive: { color: '#fff' },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },

  // List
  listContent: { padding: SPACING.md },
  orderCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderCardUrgent: { borderColor: COLORS.error, borderWidth: 2 },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  orderSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.full,
  },
  timeBadgeUrgent: { backgroundColor: `${COLORS.error}20` },
  timeBadgeText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  timeBadgeTextUrgent: { color: COLORS.error },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}40`,
  },
  itemInfo: { flex: 1 },
  itemName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  itemQty: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  itemQtyHighlight: { color: COLORS.primary, fontWeight: FONT_WEIGHT.bold },
  itemNotes: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.xs,
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginLeft: SPACING.sm,
  },

  // Botones pequeños

  // Botón Despachar todo
  btnDeliverAll: {
    marginTop: SPACING.md,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  modalLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: SPACING.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
});

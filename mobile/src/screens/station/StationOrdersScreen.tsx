// Pantalla compartida para Cocina y Barra. Recibe `station` como prop y
// muestra los items pendientes filtrados por esa estacion. Cada item tiene
// botones para marcar entrega individual; los pack products (tobos, cajas)
// muestran una UI de rondas con barra de progreso.
//
// Tiempo real: usa subscribeToActiveOrdersForStation que se actualiza por
// WebSocket — al marcar un item como entregado el cambio se refleja en
// todas las pantallas (incluida esta) sin recargar.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../../constants';
import {
  orderService,
  kitchenOrderService,
  flattenPendingItems,
  fichaService,
  type Station,
  type PendingStationItem,
  type FichaView,
} from '../../services';
import { useProductosDelMenu } from '../../queries/useCatalogo';
import {
  type DeliveredEventRow,
  type StationDispatchRow,
  type StationInsumoRow,
} from '../../services/kitchenOrderService';
import { enqueuePrintRonda } from '../../services/printQueueService';
import { inventoryService } from '../../services/inventoryService';
import {
  BarcodeScannerModal,
  FichaDeliveryModal,
  PinModal,
} from '../../components';
import { Button } from '../../components/ui';
import { AccionesDeItem } from '../../components/station/AccionesDeItem';
import { ModalDeRechazoDeItem } from '../../components/station/ModalDeRechazoDeItem';
import { Order } from '../../types/models';
import { useAuthStore } from '../../store';
import { showAlert } from '../../utils/alert';
import { formatearUsd } from '../../utils/dinero';

// Unidades entregadas por ronda para pack products (tobos, cajas)
const ROUND_SIZE = 4;

// Estaciones cuyo escaneo entra por el flujo de ficha (prefijo AR1.) ademas
// del barcode de producto. Hasta el 23/09/2026 esto TAMBIEN ocultaba los
// botones manuales de "Listo"; el dueno pidio que las tres estaciones usen la
// misma card que el admin, asi que ahora solo decide como se lee un escaneo.
const STRICT_STATIONS: Station[] = ['BAR', 'KITCHEN', 'PIZZA'];

interface StationOrdersScreenProps {
  station: Station;
}

// Agrupa items pendientes por orderId para mostrarlos como tarjetas
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
  // Ordenar por antiguedad descendente (los mas viejos primero)
  groups.sort((a, b) => b.oldestMinutes - a.oldestMinutes);
  return groups;
}

type StationNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const StationOrdersScreen: React.FC<StationOrdersScreenProps> = ({
  station,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StationNavigationProp>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyItems, setBusyItems] = useState<Set<string>>(new Set());
  const [busyOrders, setBusyOrders] = useState<Set<string>>(new Set());
  // Tick cada 30s para actualizar los minutos transcurridos en pantalla
  const [, setTick] = useState(0);
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);

  // ── Scan-para-entregar + resumen diario ──
  const [showScanner, setShowScanner] = useState(false);
  // Ficha de barra escaneada (modal de entrega/devolucion)
  const [fichaModal, setFichaModal] = useState<FichaView | null>(null);
  // Varias mesas con el mismo producto pendiente → picker
  const [scanTargets, setScanTargets] = useState<PendingStationItem[]>([]);
  const [scanProductName, setScanProductName] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState<DeliveredEventRow[]>([]);
  // Histórico de despachos de la estación (con "a quién")
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<StationDispatchRow[]>([]);
  // Insumos disponibles en el almacén de la estación
  const [showInsumos, setShowInsumos] = useState(false);
  const [insumosLoading, setInsumosLoading] = useState(false);
  const [insumosRows, setInsumosRows] = useState<StationInsumoRow[]>([]);
  // Solicitud de reposición al depósito (cantidades por insumo + nota)
  const [reqQtyById, setReqQtyById] = useState<Record<string, number>>({});
  const [reqNote, setReqNote] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  // Solicitud recien creada que un jefe puede autorizar aqui mismo con su PIN.
  const [solicitudParaAutorizar, setSolicitudParaAutorizar] = useState<
    string | null
  >(null);

  // Item que el modal de rechazo tiene abierto (null = cerrado).
  const [itemARechazar, setItemARechazar] = useState<PendingStationItem | null>(
    null,
  );

  // Catalogo para matchear codigos de barra (barcode + barcodes[])
  const { data: products = [] } = useProductosDelMenu();

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Suscripcion WS — la lista se actualiza sola
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

  const groups = useMemo(() => {
    const items = flattenPendingItems(orders, station);
    return groupByOrder(items);
  }, [orders, station]);

  const totalPendingUnits = useMemo(
    () => groups.reduce((s, g) => s + g.totalPendingUnits, 0),
    [groups],
  );

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
        `Marcar ${item.pendingQty} unidades restantes de "${item.productName}" como entregadas?`,
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

  // Entrega una ronda de un pack product (tobo/caja) e imprime ticket de ronda
  const handleDeliverRound = useCallback(
    async (item: PendingStationItem) => {
      const key = `${item.orderId}:${item.itemId}`;
      if (busyItems.has(key)) return;
      const delta = Math.min(ROUND_SIZE, item.pendingQty);
      if (delta <= 0) return;
      setBusyItems((prev) => new Set(prev).add(key));
      try {
        await kitchenOrderService.deliverItem(item.orderId, item.itemId, delta);
        const newDelivered = item.deliveredQty + delta;
        const rondaNum = Math.ceil(newDelivered / ROUND_SIZE);
        // Imprimir ticket de ronda fire-and-forget
        enqueuePrintRonda({
          orderNumber: item.orderNumber ?? item.orderId.slice(-6).toUpperCase(),
          tableName: item.tableName ?? item.sector,
          productName: item.productName,
          rondaNum,
          unitsThisRound: delta,
          totalDelivered: newDelivered,
          totalUnits: item.quantity,
          bartenderName: user?.name,
          time: new Date().toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }).catch(() => {
          // El error de impresion no bloquea la entrega
        });
      } catch (e) {
        showAlert(
          'Error',
          e instanceof Error ? e.message : 'No se pudo servir la ronda',
        );
      } finally {
        setBusyItems((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [busyItems, user?.name],
  );

  const handleDeliverAllOrder = useCallback(
    async (group: OrderGroup) => {
      if (busyOrders.has(group.orderId)) return;
      showAlert(
        'Listo todo',
        `Marcar TODOS los ${group.totalPendingUnits} items pendientes de esta orden como entregados?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Sí, todo listo',
            style: 'default',
            onPress: async () => {
              setBusyOrders((prev) => new Set(prev).add(group.orderId));
              try {
                await kitchenOrderService.deliverStation(
                  group.orderId,
                  station,
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
    },
    [busyOrders, station],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // Entrega el item que se escaneó: packs (tobos/cajas) completos de una vez,
  // items normales de a 1 unidad.
  const deliverScanned = useCallback((item: PendingStationItem) => {
    const isPack = (item.presentationQty ?? 0) > 0;
    const qty = isPack ? item.pendingQty : 1;
    const where = item.tableName ?? item.sector ?? 'Para llevar';
    showAlert(
      'Entregar escaneado',
      `${item.productName}\n${where}${item.waiterName ? ` · ${item.waiterName}` : ''}\n\nMarcar ${qty} unidad${qty !== 1 ? 'es' : ''} como entregada${qty !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Entregar ${qty}`,
          onPress: async () => {
            try {
              await kitchenOrderService.deliverItem(
                item.orderId,
                item.itemId,
                qty,
              );
            } catch (e) {
              showAlert(
                'Error',
                e instanceof Error ? e.message : 'No se pudo entregar',
              );
            }
          },
        },
      ],
    );
  }, []);

  const handleScanned = useCallback(
    (code: string) => {
      setShowScanner(false);
      const clean = code.trim();
      if (!clean) return;
      // Ficha: prefijo AR1. → flujo de ficha (barra, cocina y pizza).
      if (STRICT_STATIONS.includes(station) && clean.startsWith('AR1.')) {
        fichaService
          .getByToken(clean)
          .then((ficha) => {
            // La ficha trae las 3 estaciones; esta pantalla entrega solo la suya.
            const mine = ficha.items.filter((i) => i.station === station);
            if (!mine.length) {
              showAlert(
                'Nada pendiente',
                `Esta ficha no tiene ítems de ${stationLabel.toLowerCase()} pendientes`,
              );
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
        return;
      }
      const product = products.find(
        (p) => p.barcode === clean || (p.barcodes ?? []).includes(clean),
      );
      if (!product) {
        showAlert(
          'Código no registrado',
          `El código "${clean}" no está asignado a ningún producto. Asígnalo en el panel de productos.`,
        );
        return;
      }
      const pending = flattenPendingItems(orders, station).filter(
        (i) => i.productId === product.id && i.pendingQty > 0,
      );
      if (pending.length === 0) {
        showAlert(
          'Sin pendientes',
          `No hay "${product.name}" pendiente por entregar en este momento.`,
        );
        return;
      }
      if (pending.length === 1) {
        deliverScanned(pending[0]);
        return;
      }
      // Varias mesas esperando el mismo producto → elegir cuál
      setScanProductName(product.name);
      setScanTargets(pending);
    },
    [products, orders, station, deliverScanned],
  );

  // Resumen diario del usuario logueado (jornada 6am-6am)
  const openSummary = useCallback(async () => {
    if (!user?.uid) return;
    setShowSummary(true);
    setSummaryLoading(true);
    try {
      const rows = await kitchenOrderService.getMyDeliveriesToday(user.uid);
      setSummaryRows(rows);
    } catch {
      setSummaryRows([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [user?.uid]);

  // Histórico de despachos de la estación en la jornada (con "a quién")
  const openHistory = useCallback(async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      setHistoryRows(
        await kitchenOrderService.getStationDispatchesToday(station),
      );
    } catch {
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [station]);

  // Insumos disponibles en el almacén de la estación
  const openInsumos = useCallback(async () => {
    setShowInsumos(true);
    setInsumosLoading(true);
    setReqQtyById({});
    setReqNote('');
    try {
      setInsumosRows(await kitchenOrderService.getAvailableInsumos(station));
    } catch {
      setInsumosRows([]);
    } finally {
      setInsumosLoading(false);
    }
  }, [station]);

  const setReqQty = useCallback((productId: string, qty: number) => {
    setReqQtyById((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }, []);

  // Enviar la solicitud de reposición al admin (depósito → estación al aprobar).
  const submitInsumoRequest = useCallback(async () => {
    const items = insumosRows
      .filter((r) => (reqQtyById[r.productId] ?? 0) > 0)
      .map((r) => ({
        productId: r.productId,
        productName: r.productName,
        qty: reqQtyById[r.productId],
        unit: r.unit,
      }));
    if (items.length === 0) {
      showAlert(
        'Solicitud vacía',
        'Indica cuánto necesitas de al menos un insumo.',
      );
      return;
    }
    setReqBusy(true);
    try {
      const creada = await kitchenOrderService.requestInsumos(
        station,
        items,
        reqNote.trim() || undefined,
      );
      setReqQtyById({});
      setReqNote('');
      showAlert(
        'Solicitud enviada',
        'El admin la verá y repondrá desde el depósito.',
        creada.id
          ? [
              { text: 'Listo', style: 'cancel' },
              {
                text: 'El jefe autoriza ahora',
                onPress: () => setSolicitudParaAutorizar(creada.id),
              },
            ]
          : undefined,
      );
    } catch (e) {
      showAlert(
        'Error',
        e instanceof Error ? e.message : 'No se pudo enviar la solicitud',
      );
    } finally {
      setReqBusy(false);
    }
  }, [insumosRows, reqQtyById, reqNote, station]);

  // Agregado por producto con valor $ (packs: precio del pack / unidades)
  const summaryAgg = useMemo(() => {
    const byProduct = new Map<
      string,
      { name: string; qty: number; value: number }
    >();
    for (const row of summaryRows) {
      const product = products.find((p) => p.id === row.productId);
      const packSize = product?.presentationQuantity ?? 0;
      const unitValue =
        product == null
          ? 0
          : packSize > 0
            ? product.price / packSize
            : product.price;
      const prev = byProduct.get(row.productId);
      const name = product?.name ?? row.productName ?? row.productId;
      byProduct.set(row.productId, {
        name,
        qty: (prev?.qty ?? 0) + row.qty,
        value: (prev?.value ?? 0) + row.qty * unitValue,
      });
    }
    const rows = Array.from(byProduct.values()).sort(
      (a, b) => b.value - a.value,
    );
    return {
      rows,
      totalUnits: rows.reduce((s, r) => s + r.qty, 0),
      totalValue: rows.reduce((s, r) => s + r.value, 0),
    };
  }, [summaryRows, products]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const stationLabel =
    station === 'KITCHEN' ? 'Cocina' : station === 'PIZZA' ? 'Pizza' : 'Barra';
  const stationIcon =
    station === 'KITCHEN'
      ? 'restaurant'
      : station === 'PIZZA'
        ? 'pizza'
        : 'wine';

  return (
    <View style={styles.container}>
      {/* Header con totales y logout */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name={stationIcon as 'restaurant' | 'wine'}
            size={28}
            color={COLORS.primary}
          />
          <View style={styles.headerTextos}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {stationLabel}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {totalPendingUnits} pendientes · {groups.length} orden(es) ·{' '}
              {user?.name ?? '...'}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => void openInsumos()}
            style={styles.logoutBtn}
          >
            <Ionicons name="cube-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void openHistory()}
            style={styles.logoutBtn}
          >
            <Ionicons name="receipt-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void openSummary()}
            style={styles.logoutBtn}
          >
            <Ionicons
              name="stats-chart-outline"
              size={22}
              color={COLORS.primary}
            />
          </TouchableOpacity>
          {/* Inventario de la estacion: stock, conteo y lo que elabora */}
          <TouchableOpacity
            onPress={() => navigation.navigate('InventoryHub')}
            style={styles.logoutBtn}
          >
            <Ionicons name="cube-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          {/* Asistencia: cocina/barra/pizza tambien fichan entrada y salida */}
          <TouchableOpacity
            onPress={() => navigation.navigate('StationAttendance')}
            style={styles.logoutBtn}
          >
            <Ionicons
              name="finger-print-outline"
              size={22}
              color={COLORS.primary}
            />
          </TouchableOpacity>
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

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
          <Text style={styles.emptyTitle}>Todo al dia</Text>
          <Text style={styles.emptySubtitle}>
            No hay items pendientes de {stationLabel.toLowerCase()}.
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
                {/* Cabecera de la orden */}
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
                  const isPack = (item.presentationQty ?? 0) > 0;

                  if (isPack) {
                    // ── UI de rondas para tobos/cajas ──
                    const totalUnits = item.quantity;
                    const delivered = item.deliveredQty;
                    const pending = item.pendingQty;
                    const progress =
                      totalUnits > 0 ? delivered / totalUnits : 0;
                    const completedRounds =
                      delivered > 0 ? Math.ceil(delivered / ROUND_SIZE) : 0;
                    const nextRoundUnits = Math.min(ROUND_SIZE, pending);
                    return (
                      <View key={item.itemId} style={styles.packRow}>
                        {/* Header del pack */}
                        <View style={styles.packHeader}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.packTitleRow}>
                              <Ionicons
                                name="beer-outline"
                                size={16}
                                color={COLORS.primary}
                              />
                              <Text style={styles.packName}>
                                {item.productName}
                              </Text>
                              {completedRounds > 0 && (
                                <View style={styles.rondaBadge}>
                                  <Text style={styles.rondaBadgeText}>
                                    Ronda #{completedRounds}
                                  </Text>
                                </View>
                              )}
                            </View>
                            {item.notes ? (
                              <Text style={styles.itemNotes}>{item.notes}</Text>
                            ) : null}
                          </View>
                          <Text style={styles.packProgress}>
                            {delivered}/{totalUnits}
                          </Text>
                        </View>
                        {/* Barra de progreso */}
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${progress * 100}%` as `${number}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.packSubtitle}>
                          {pending} cervezas pendientes · siguiente ronda:{' '}
                          {nextRoundUnits}
                        </Text>
                        {/* Botones de ronda — visibles en las tres estaciones
                            desde el 23/09/2026, igual que el resto de la card */}
                        <View style={styles.packActions}>
                          <Button
                            variant="primary"
                            size="md"
                            label={`Servir ronda (${nextRoundUnits})`}
                            icon={
                              <Ionicons name="beer" size={14} color="#fff" />
                            }
                            loading={itemBusy}
                            disabled={itemBusy || pending === 0}
                            onPress={() => void handleDeliverRound(item)}
                            style={{ flex: 1 }}
                          />
                          {pending > ROUND_SIZE && (
                            <Button
                              variant="secondary"
                              size="md"
                              label="Todo"
                              disabled={itemBusy}
                              onPress={() => void handleDeliverAllOfItem(item)}
                            />
                          )}
                          <Button
                            variant="danger"
                            size="md"
                            label="Rechazar"
                            icon={
                              <Ionicons name="close" size={14} color="#fff" />
                            }
                            disabled={itemBusy}
                            onPress={() => setItemARechazar(item)}
                          />
                        </View>
                      </View>
                    );
                  }

                  // ── UI normal para items individuales ──
                  return (
                    <View key={item.itemId} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.productName}</Text>
                        <Text style={styles.itemQty}>
                          Pendientes:{' '}
                          <Text style={styles.itemQtyHighlight}>
                            {item.pendingQty}
                          </Text>{' '}
                          de {item.quantity}
                        </Text>
                        {item.notes ? (
                          <Text style={styles.itemNotes}>{item.notes}</Text>
                        ) : null}
                      </View>
                      {/* Los mismos botones que el despacho del admin, con
                          Rechazar incluido (decision del dueno 23/09/2026).
                          Ya no cuelgan de `isStrict`: la ficha sigue siendo la
                          via normal, pero la estacion necesita poder sacar de
                          su pantalla lo que nunca se va a preparar. */}
                      <View style={styles.itemActions}>
                        <AccionesDeItem
                          item={item}
                          ocupado={itemBusy}
                          onEntregarUno={() => void handleDeliverOne(item)}
                          onEntregarTodos={() =>
                            void handleDeliverAllOfItem(item)
                          }
                          onRechazar={() => setItemARechazar(item)}
                        />
                      </View>
                    </View>
                  );
                })}

                {/* Boton Listo todo — visible en las tres estaciones desde
                    el 23/09/2026, igual que en el despacho del admin */}
                <Button
                  variant="secondary"
                  size="md"
                  label={`Listo todo (${group.totalPendingUnits} items)`}
                  icon={
                    <Ionicons
                      name="checkmark-done"
                      size={16}
                      color={COLORS.primary}
                    />
                  }
                  loading={orderBusy}
                  disabled={orderBusy}
                  onPress={() => void handleDeliverAllOrder(group)}
                  style={{ marginTop: SPACING.md }}
                />
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* FAB escanear → entrega.
          Se separa del borde con un MINIMO garantizado: varios Android con
          barra de gestos reportan insets.bottom = 0, y sumar solo el inset
          dejaba el boton pegado abajo, tapado por la barra y dificil de
          alcanzar. Math.max asegura el margen aunque el inset venga vacio. */}
      <TouchableOpacity
        style={[styles.scanFab, { bottom: Math.max(insets.bottom, 16) + 28 }]}
        onPress={() => setShowScanner(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="barcode-outline" size={26} color="#fff" />
      </TouchableOpacity>

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={handleScanned}
      />

      {/* La lista se refresca sola por WebSocket: el rechazo no necesita
          recargar nada a mano. */}
      <ModalDeRechazoDeItem
        item={itemARechazar}
        onCerrar={() => setItemARechazar(null)}
      />

      <FichaDeliveryModal
        visible={fichaModal !== null}
        ficha={fichaModal}
        station={station}
        onClose={() => setFichaModal(null)}
        onChanged={(updated) =>
          setFichaModal(
            updated.items.some((i) => i.station === station) ? updated : null,
          )
        }
      />

      <PinModal
        visible={solicitudParaAutorizar !== null}
        titulo="Autorizar reposicion"
        descripcion="El jefe teclea su PIN y el traslado del deposito ocurre al instante, a su nombre."
        onCancelar={() => setSolicitudParaAutorizar(null)}
        onConfirmar={async (pin) => {
          if (!solicitudParaAutorizar) return null;
          try {
            await inventoryService.approveInsumoRequest(
              solicitudParaAutorizar,
              pin,
            );
            setSolicitudParaAutorizar(null);
            showAlert('Autorizada', 'El stock ya se trasladó a la estación.');
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : 'No se pudo autorizar';
          }
        }}
      />

      {/* Picker: varias mesas esperando el producto escaneado */}
      <Modal
        visible={scanTargets.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setScanTargets([])}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{scanProductName}</Text>
            <Text style={styles.modalSubtitle}>
              Varias órdenes lo esperan — ¿a cuál lo entregas?
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {scanTargets.map((t) => (
                <TouchableOpacity
                  key={`${t.orderId}:${t.itemId}`}
                  style={styles.targetRow}
                  onPress={() => {
                    setScanTargets([]);
                    deliverScanned(t);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.targetTitle}>
                      {t.tableName ?? t.sector ?? 'Para llevar'}
                    </Text>
                    <Text style={styles.targetSubtitle}>
                      {t.waiterName ?? ''}
                      {t.customerAlias ? ` · ${t.customerAlias}` : ''} ·{' '}
                      {t.pendingQty} pendiente{t.pendingQty !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setScanTargets([])}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Mi resumen del día */}
      <Modal
        visible={showSummary}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSummary(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="stats-chart" size={20} color={COLORS.primary} />
              <Text style={styles.modalTitle}>
                Mi resumen de hoy · {user?.name ?? ''}
              </Text>
            </View>
            {summaryLoading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={{ marginVertical: SPACING.xl }}
              />
            ) : summaryAgg.rows.length === 0 ? (
              <Text style={styles.modalSubtitle}>
                Aún no has despachado nada en esta jornada.
              </Text>
            ) : (
              <>
                <ScrollView style={{ maxHeight: 360 }}>
                  {summaryAgg.rows.map((r) => (
                    <View key={r.name} style={styles.summaryRow}>
                      <Text style={styles.summaryQty}>{r.qty}×</Text>
                      <Text style={styles.summaryName} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={styles.summaryValue}>
                        {formatearUsd(r.value)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>
                    {summaryAgg.totalUnits} unidades gestionadas
                  </Text>
                  <Text style={styles.summaryTotalValue}>
                    {formatearUsd(summaryAgg.totalValue)}
                  </Text>
                </View>
              </>
            )}
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowSummary(false)}
            >
              <Text style={styles.modalCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Histórico de despachos de la estación (con "a quién") */}
      <Modal
        visible={showHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="receipt" size={20} color={COLORS.primary} />
              <Text style={styles.modalTitle}>
                Despachos de hoy · {stationLabel}
              </Text>
            </View>
            {historyLoading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={{ marginVertical: SPACING.xl }}
              />
            ) : historyRows.length === 0 ? (
              <Text style={styles.modalSubtitle}>
                Aún no se despachó nada en esta jornada.
              </Text>
            ) : (
              <>
                <ScrollView style={{ maxHeight: 400 }}>
                  {historyRows.map((r, i) => (
                    <View key={`${r.orderId}-${i}`} style={styles.histRow}>
                      <Text style={styles.histTime}>
                        {new Date(r.occurredAt).toLocaleTimeString('es-VE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.histName} numberOfLines={1}>
                          {r.qty}× {r.productName}
                        </Text>
                        <Text style={styles.histMeta} numberOfLines={1}>
                          {r.tableName ?? `#${r.orderNumber}`}
                          {r.waiterName ? ` · ${r.waiterName}` : ''}
                          {r.actorName ? `  ›  ${r.actorName}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>
                    {historyRows.reduce((s, r) => s + r.qty, 0)} unidades
                    despachadas
                  </Text>
                </View>
              </>
            )}
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowHistory(false)}
            >
              <Text style={styles.modalCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Insumos disponibles en el almacén de la estación */}
      <Modal
        visible={showInsumos}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInsumos(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="cube" size={20} color={COLORS.primary} />
              <Text style={styles.modalTitle}>
                Insumos disponibles · {stationLabel}
              </Text>
            </View>
            {insumosLoading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={{ marginVertical: SPACING.xl }}
              />
            ) : insumosRows.length === 0 ? (
              <Text style={styles.modalSubtitle}>
                No hay insumos registrados para esta estación.
              </Text>
            ) : (
              <>
                <Text style={styles.reqHint}>
                  Disponible en tu almacén · usa +/− para pedir reposición al
                  depósito
                </Text>
                <ScrollView style={{ maxHeight: 340 }}>
                  {insumosRows.map((r) => {
                    const q = reqQtyById[r.productId] ?? 0;
                    return (
                      <View key={r.productId} style={styles.insumoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.summaryName} numberOfLines={1}>
                            {r.productName}
                          </Text>
                          <Text
                            style={[
                              styles.insumoStock,
                              r.qty <= 0 && { color: COLORS.error },
                            ]}
                          >
                            Disponible: {r.qty} {r.unit}
                          </Text>
                        </View>
                        <View style={styles.reqStepper}>
                          <TouchableOpacity
                            style={styles.reqStepBtn}
                            onPress={() => setReqQty(r.productId, q - 1)}
                            disabled={q <= 0}
                          >
                            <Ionicons
                              name="remove"
                              size={18}
                              color={COLORS.textWhite}
                            />
                          </TouchableOpacity>
                          <Text style={styles.reqStepValue}>{q}</Text>
                          <TouchableOpacity
                            style={styles.reqStepBtn}
                            onPress={() => setReqQty(r.productId, q + 1)}
                          >
                            <Ionicons
                              name="add"
                              size={18}
                              color={COLORS.textWhite}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
                <TextInput
                  style={styles.reqNoteInput}
                  placeholder="Nota para el admin (opcional)"
                  placeholderTextColor={COLORS.textSecondary}
                  value={reqNote}
                  onChangeText={setReqNote}
                />
                <Button
                  variant="primary"
                  size="md"
                  label={`Solicitar al depósito${Object.keys(reqQtyById).length ? ` (${Object.keys(reqQtyById).length})` : ''}`}
                  loading={reqBusy}
                  disabled={reqBusy || Object.keys(reqQtyById).length === 0}
                  onPress={() => void submitInsumoRequest()}
                  style={{ marginTop: SPACING.md }}
                />
              </>
            )}
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowInsumos(false)}
            >
              <Text style={styles.modalCancelText}>Cerrar</Text>
            </TouchableOpacity>
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
  // ── Cabecera que sobrevive a telefonos chicos (26/08/2026) ──
  // En React Native `flexShrink` es 0 por defecto (al reves que en web), asi
  // que este bloque pedia el ancho completo de su texto y empujaba los botones
  // fuera de pantalla. La fila necesitaba ~500px y un telefono comun tiene 360:
  // los dos ultimos botones —ASISTENCIA y cerrar sesion— quedaban afuera, y el
  // personal de cocina/barra/pizza no podia fichar. Peor aun, dependia del
  // largo del nombre: el mismo telefono fallaba con un usuario y con otro no.
  //
  // `flex: 1` + `minWidth: 0` hacen que el texto ceda; los botones mandan.
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
    minWidth: 0,
  },
  headerTextos: { flex: 1, minWidth: 0 },
  headerTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  logoutBtn: { padding: SPACING.sm },
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
  // Items normales
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
  itemActions: { flexDirection: 'row', gap: SPACING.xs },
  // Botones normales
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 80,
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  btnDisabled: { opacity: 0.5 },
  btnDeliverAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}10`,
  },
  btnDeliverAllText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  // Pack products (tobos/cajas)
  packRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}40`,
  },
  packHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  packTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  packName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  rondaBadge: {
    backgroundColor: `${COLORS.primary}25`,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  rondaBadgeText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  packProgress: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    marginLeft: SPACING.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: `${COLORS.border}80`,
    borderRadius: 3,
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  packSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.sm,
  },
  packActions: { flexDirection: 'row', gap: SPACING.sm },
  btnRound: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  btnRoundText: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  // Scan + resumen
  // Los botones NUNCA se comprimen ni se salen: son la unica via a asistencia,
  // inventario e historial para las estaciones.
  headerActions: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  scanFab: {
    position: 'absolute',
    bottom: 20,
    left: 20,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}60`,
  },
  targetTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  targetSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  modalCancelBtn: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}40`,
    gap: SPACING.sm,
  },
  summaryQty: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    minWidth: 40,
  },
  summaryName: { color: COLORS.text, fontSize: FONT_SIZE.md, flex: 1 },
  summaryValue: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}40`,
    gap: SPACING.md,
  },
  histTime: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    minWidth: 44,
  },
  histName: { color: COLORS.text, fontSize: FONT_SIZE.md },
  histMeta: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },
  reqHint: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.sm,
  },
  insumoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}40`,
    gap: SPACING.sm,
  },
  insumoStock: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },
  reqStepper: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  reqStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reqStepValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    minWidth: 24,
    textAlign: 'center',
  },
  reqNoteInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.sm,
  },
  reqSubmit: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  reqSubmitDisabled: { opacity: 0.5 },
  reqSubmitText: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
  },
  summaryTotalLabel: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  summaryTotalValue: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
  },
});

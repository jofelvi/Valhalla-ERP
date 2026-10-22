import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  SHADOWS,
  BORDER_RADIUS,
} from '../../constants';
import {
  waiterSalesService,
  WaiterPayment,
  DailySalesResume,
} from '../../services/waiterSalesService';
import { getBcvRate, usdToBs } from '../../services/bcvRateService';
import { Order, PaymentStatusEnum, PaymentMethodEnum } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store';
import { Button } from '../../components/ui';
import { formatearUsd, formatearBs } from '../../utils/dinero';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const screenWidth = Dimensions.get('window').width;
const isBigScreen = screenWidth > 450;

/** Helper: verificar si una orden está pagada (case-insensitive) */
function isPaid(order: Order): boolean {
  return (order.paymentStatus ?? '').toLowerCase() === 'paid';
}

/** Formatea antigüedad (e.g., "hoy", "hace 2 días") */
function formatAntiquity(createdAt: Date | null | undefined): string {
  if (!createdAt) return '—';
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );

  if (diffDays === 0) {
    if (diffHours === 0) return 'hace minutos';
    return `hace ${diffHours}h`;
  }
  return `hace ${diffDays}d`;
}

/** Badge de estado de pago */
function PaymentStatusBadge(props: {
  status: PaymentStatusEnum;
}): React.ReactElement {
  let bgColor = COLORS.errorLight;
  let textColor = COLORS.errorLight;
  let icon: keyof typeof Ionicons.glyphMap = 'alert-circle-outline';
  let label = 'Pendiente';

  const normalized = (props.status ?? '').toLowerCase();

  if (normalized === 'paid') {
    bgColor = COLORS.successLight;
    textColor = COLORS.successLight;
    icon = 'checkmark-circle-outline';
    label = 'Pagada';
  } else if (normalized === 'pending_verification') {
    bgColor = COLORS.warningLight;
    textColor = COLORS.primaryDark;
    icon = 'time-outline';
    label = 'Por verificar';
  } else if (normalized === 'partial') {
    bgColor = COLORS.orangeLight;
    textColor = COLORS.orange;
    icon = 'swap-horizontal-outline';
    label = 'Parcial';
  }

  return (
    <View style={[styles.paymentStatusBadge, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={12} color={textColor} />
      <Text style={[styles.paymentStatusText, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

/** Card de resumen (Vendido, Órdenes, Propinas, Servicio) */
function SummaryCard(props: {
  label: string;
  value: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}): React.ReactElement {
  return (
    <View style={[styles.summaryCard, { flex: 1 }]}>
      <View style={styles.summaryCardHeader}>
        <Ionicons name={props.icon} size={16} color={props.color} />
        <Text style={styles.summaryLabel}>{props.label}</Text>
      </View>
      <Text style={[styles.summaryValue, { color: props.color }]}>
        {props.value}
      </Text>
    </View>
  );
}

/** Orden row para listados */
function OrderRow(props: {
  order: Order;
  bcvRate: number;
  onPress: (order: Order) => void;
}): React.ReactElement {
  const timeStr = props.order.createdAt
    ? props.order.createdAt.toLocaleTimeString('es-VE', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const orderNumShort = props.order.orderNumber
    ? props.order.orderNumber.slice(-4).toUpperCase()
    : `#${props.order.id.slice(-4).toUpperCase()}`;

  const locationStr =
    props.order.tableName || props.order.sector || 'Para llevar';

  return (
    <TouchableOpacity
      style={styles.orderRow}
      onPress={() => props.onPress(props.order)}
      activeOpacity={0.7}
    >
      <View style={styles.orderRowLeft}>
        <Text style={styles.orderTime}>{timeStr}</Text>
        <Text style={styles.orderNumber}>{orderNumShort}</Text>
        <Text style={styles.orderLocation}>{locationStr}</Text>
      </View>
      <View style={styles.orderRowRight}>
        <Text style={styles.orderTotal}>{formatearUsd(props.order.total)}</Text>
        {props.bcvRate > 0 ? (
          <Text style={styles.orderBs}>
            Bs. {usdToBs(props.order.total, props.bcvRate).toFixed(0)}
          </Text>
        ) : null}
        <PaymentStatusBadge status={props.order.paymentStatus} />
      </View>
    </TouchableOpacity>
  );
}

/** Orden row con antigüedad (para "Por cobrar") */
function PendingOrderRow(props: {
  order: Order;
  bcvRate: number;
  onPress: (order: Order) => void;
}): React.ReactElement {
  const orderNumShort = props.order.orderNumber
    ? props.order.orderNumber.slice(-4).toUpperCase()
    : `#${props.order.id.slice(-4).toUpperCase()}`;

  const locationStr =
    props.order.tableName || props.order.sector || 'Para llevar';

  return (
    <TouchableOpacity
      style={styles.orderRow}
      onPress={() => props.onPress(props.order)}
      activeOpacity={0.7}
    >
      <View style={styles.orderRowLeft}>
        <Text style={styles.orderNumber}>{orderNumShort}</Text>
        <Text style={styles.orderLocation}>{locationStr}</Text>
        <Text style={styles.antiquityChip}>
          {formatAntiquity(props.order.createdAt)}
        </Text>
      </View>
      <View style={styles.orderRowRight}>
        <Text style={styles.orderTotal}>{formatearUsd(props.order.total)}</Text>
        {props.bcvRate > 0 ? (
          <Text style={styles.orderBs}>
            Bs. {usdToBs(props.order.total, props.bcvRate).toFixed(0)}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export const WaiterSalesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((s) => s.user);
  const [segment, setSegment] = useState<'today' | 'pending'>('today');
  const [bcvRate, setBcvRate] = useState(0);
  const [ordersToday, setOrdersToday] = useState<Order[]>([]);
  const [paymentsToday, setPaymentsToday] = useState<WaiterPayment[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [resume, setResume] = useState<DailySalesResume | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waiterId = user?.uid ?? '';

  const load = useCallback(async () => {
    if (!waiterId) return;
    setError(null);
    try {
      const rate = await getBcvRate().catch(() => 0);
      setBcvRate(rate);

      // Cargar órdenes de hoy
      const now = new Date();
      const today00 = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const isoFrom = today00.toISOString();
      const isoTo = now.toISOString();

      const [todayOrdersRaw, todayPayments, allOrdersData] = await Promise.all([
        waiterSalesService.getOrdersByWaiter(waiterId, isoFrom, isoTo),
        waiterSalesService.getPaymentsByWaiter(waiterId, isoFrom, isoTo),
        waiterSalesService.getOrdersByWaiter(waiterId), // sin fechas
      ]);

      // El API matchea órdenes creadas O actualizadas en el rango (una orden
      // vieja re-tocada hoy entraría); las ventas del día son solo las CREADAS hoy
      const todayOrders = todayOrdersRaw.filter(
        (o) => o.createdAt !== null && o.createdAt >= today00,
      );

      setOrdersToday(todayOrders);
      setPaymentsToday(todayPayments);
      setAllOrders(allOrdersData);

      // Calcular resumen del día
      const dayResume = await waiterSalesService.calculateDailySalesResume(
        todayOrders,
        todayPayments,
      );
      setResume(dayResume);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudieron cargar las ventas';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [waiterId]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void load();
  }, [load]);

  const handleOrderPress = (order: Order) => {
    navigation.navigate('WaiterSaleDetail', { orderId: order.id });
  };

  const handleCommissionsPress = () => {
    navigation.navigate('WaiterCommissions');
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Inicia sesión para ver tus ventas.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando ventas...</Text>
      </View>
    );
  }

  // Órdenes a mostrar según el segmento
  const displayOrders =
    segment === 'today'
      ? ordersToday
      : allOrders.filter((o) => !isPaid(o) && o.status !== 'CANCELLED');

  // Totales por cobrar
  const pendingTotal = displayOrders.reduce((sum, o) => sum + o.total, 0);

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.bannerError}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={COLORS.error}
          />
          <Text style={styles.bannerErrorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Segment Control */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              segment === 'today' && styles.segmentButtonActive,
            ]}
            onPress={() => setSegment('today')}
          >
            <Text
              style={[
                styles.segmentText,
                segment === 'today' && styles.segmentTextActive,
              ]}
            >
              Hoy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              segment === 'pending' && styles.segmentButtonActive,
            ]}
            onPress={() => setSegment('pending')}
          >
            <Text
              style={[
                styles.segmentText,
                segment === 'pending' && styles.segmentTextActive,
              ]}
            >
              Por cobrar
            </Text>
          </TouchableOpacity>
        </View>

        {segment === 'today' ? (
          <>
            {/* Botón Mis comisiones */}
            <Button
              label="Mis comisiones"
              variant="secondary"
              size="md"
              icon={
                <Ionicons name="wallet-outline" size={16} color={COLORS.text} />
              }
              iconPosition="left"
              onPress={handleCommissionsPress}
              style={styles.commissionsButton}
            />

            {/* Cards de resumen */}
            {resume ? (
              <>
                <View style={styles.summaryRow}>
                  <SummaryCard
                    label="Vendido"
                    value={formatearUsd(resume.totalSales)}
                    color={COLORS.primary}
                    icon="cart-outline"
                  />
                  <SummaryCard
                    label="Órdenes"
                    value={String(resume.orderCount)}
                    color={COLORS.primary}
                    icon="receipt-outline"
                  />
                  <SummaryCard
                    label="Propinas"
                    value={formatearUsd(resume.tips)}
                    color="COLORS.primaryDark"
                    icon="hand-right-outline"
                  />
                  <SummaryCard
                    label="Servicio"
                    value={formatearUsd(resume.serviceCharge)}
                    color="COLORS.cyan"
                    icon="checkmark-circle-outline"
                  />
                </View>

                {/* Split: Cobrado vs Por cobrar */}
                <View style={styles.splitRow}>
                  <View style={styles.splitCard}>
                    <Text style={styles.splitLabel}>Cobrado</Text>
                    <Text
                      style={[styles.splitAmount, { color: COLORS.success }]}
                    >
                      {formatearUsd(resume.collected)}
                    </Text>
                    <Text style={styles.splitCount}>
                      {resume.collectedCount} orden
                      {resume.collectedCount !== 1 ? 'es' : ''}
                    </Text>
                  </View>
                  <View style={styles.splitDivider} />
                  <View style={styles.splitCard}>
                    <Text style={styles.splitLabel}>Por cobrar</Text>
                    <Text
                      style={[styles.splitAmount, { color: COLORS.warning }]}
                    >
                      {formatearUsd(resume.pending)}
                    </Text>
                    <Text style={styles.splitCount}>
                      {resume.pendingCount} orden
                      {resume.pendingCount !== 1 ? 'es' : ''}
                    </Text>
                  </View>
                </View>

                {/* Desglose por método */}
                {resume.paymentsByMethod.length > 0 ? (
                  <View style={styles.methodsBlock}>
                    <Text style={styles.blockTitle}>Métodos del día</Text>
                    {resume.paymentsByMethod.map((m) => (
                      <View key={m.method} style={styles.methodRow}>
                        <Text style={styles.methodLabel}>{m.label}</Text>
                        <View style={styles.methodRight}>
                          <Text style={styles.methodAmount}>
                            {formatearUsd(m.amount)}
                          </Text>
                          <Text style={styles.methodCount}>×{m.count}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {/* Órdenes de hoy */}
            <View style={styles.ordersSection}>
              <Text style={styles.sectionTitle}>
                Órdenes ({ordersToday.length})
              </Text>
              {ordersToday.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="receipt-outline"
                    size={48}
                    color={`${COLORS.primary}50`}
                  />
                  <Text style={styles.emptyTitle}>Sin ventas hoy todavía</Text>
                  <Text style={styles.emptySubtitle}>
                    Cuando se registren órdenes, aparecerán aquí
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={ordersToday}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <OrderRow
                      order={item}
                      bcvRate={bcvRate}
                      onPress={handleOrderPress}
                    />
                  )}
                  ItemSeparatorComponent={() => (
                    <View style={styles.orderSeparator} />
                  )}
                />
              )}
            </View>
          </>
        ) : (
          <>
            {/* Por cobrar */}
            <View style={styles.pendingTotalCard}>
              <Text style={styles.pendingLabel}>Por cobrar</Text>
              <Text style={styles.pendingAmount}>
                {formatearUsd(pendingTotal)}
              </Text>
              <Text style={styles.pendingCount}>
                {displayOrders.length} orden
                {displayOrders.length !== 1 ? 'es' : ''}
              </Text>
            </View>

            {displayOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={48}
                  color={`${COLORS.primary}50`}
                />
                <Text style={styles.emptyTitle}>
                  No tienes órdenes por cobrar 🎉
                </Text>
                <Text style={styles.emptySubtitle}>
                  Todas tus órdenes han sido pagadas
                </Text>
              </View>
            ) : (
              <View style={styles.ordersSection}>
                <FlatList
                  data={displayOrders}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <PendingOrderRow
                      order={item}
                      bcvRate={bcvRate}
                      onPress={handleOrderPress}
                    />
                  )}
                  ItemSeparatorComponent={() => (
                    <View style={styles.orderSeparator} />
                  )}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
  errorText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: FONT_SIZE.md,
  },
  bannerError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: `${COLORS.error}18`,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.error}35`,
  },
  bannerErrorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: FONT_SIZE.sm,
  },

  /* Segment control */
  segmentContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.background,
  },

  /* Comisiones button */
  commissionsButton: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    alignSelf: 'center',
  },

  /* Summary row */
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },
  summaryValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },

  /* Split row */
  splitRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  splitCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  splitDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  splitLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.xs,
  },
  splitAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.xs,
  },
  splitCount: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },

  /* Methods block */
  methodsBlock: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  blockTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  methodLabel: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  methodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  methodAmount: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  methodCount: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },

  /* Orders section */
  ordersSection: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  orderRowLeft: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  orderRowRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
    marginLeft: SPACING.md,
  },
  orderTime: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  orderNumber: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  orderLocation: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  orderTotal: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  orderBs: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  antiquityChip: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontStyle: 'italic',
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: 2,
  },
  paymentStatusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  orderSeparator: {
    height: SPACING.sm,
  },

  /* Pending section */
  pendingTotalCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  pendingLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.xs,
  },
  pendingAmount: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.xs,
  },
  pendingCount: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.lg,
  },
});

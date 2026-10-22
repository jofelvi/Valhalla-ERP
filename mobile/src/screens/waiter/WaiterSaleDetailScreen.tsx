import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import {
  waiterSalesService,
  WaiterPayment,
} from '../../services/waiterSalesService';
import { getBcvRate, usdToBs } from '../../services/bcvRateService';
import { Order, PaymentStatusEnum } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui';
import { packCountLabel } from '../../services/packPricing';
import { useTarifas } from '../../config/hooks';
import { pctTexto } from '../../config/totalesDeOrden';
import { tarifasDeOrden } from '../../config/tarifasDeOrden';
import { formatearUsd, formatearBs } from '../../utils/dinero';

type RouteProps = RouteProp<RootStackParamList, 'WaiterSaleDetail'>;
type NavProp = NativeStackNavigationProp<
  RootStackParamList,
  'WaiterSaleDetail'
>;

/** Helper: verificar si una orden está pagada (case-insensitive) */
function isPaid(order: Order): boolean {
  return (order.paymentStatus ?? '').toLowerCase() === 'paid';
}

/** Formatea método de pago */
function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    CASH_USD: 'Efectivo USD',
    CASH_BS: 'Efectivo Bs',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    PAGO_MOVIL: 'Pago Móvil',
    MIXED: 'Mixto',
    PENDING: 'Pendiente',
  };
  return map[method] ?? method;
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
    <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={14} color={textColor} />
      <Text style={[styles.statusBadgeText, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

/** Row generic (icono + label + valor) */
function Row(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <Ionicons
        name={props.icon}
        size={18}
        color={COLORS.textSecondary}
        style={styles.rowIcon}
      />
      <View style={styles.rowTextCol}>
        <Text style={styles.rowLabel}>{props.label}</Text>
        <Text style={styles.rowValue}>{props.value}</Text>
      </View>
    </View>
  );
}

export const WaiterSaleDetailScreen: React.FC = () => {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<NavProp>();
  const [order, setOrder] = useState<Order | null>(null);
  const tarifasVigentes = useTarifas();
  const [payments, setPayments] = useState<WaiterPayment[]>([]);
  const [bcvRate, setBcvRate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [orderData, paymentsData, rate] = await Promise.all([
        waiterSalesService.getOrderById(params.orderId),
        waiterSalesService.getPaymentsByOrderId(params.orderId),
        getBcvRate().catch(() => 0),
      ]);
      setOrder(orderData);
      setPayments(paymentsData);
      setBcvRate(rate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el detalle');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [params.orderId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.muted}>Cargando detalle...</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
        <Text style={styles.errorText}>{error ?? 'No encontrado'}</Text>
        <Button
          label="Reintentar"
          variant="primary"
          size="md"
          onPress={() => void load()}
        />
        <Button
          label="Volver"
          variant="ghost"
          size="md"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const orderNumShort =
    order.orderNumber?.slice(-6).toUpperCase() ||
    `#${order.id.slice(-6).toUpperCase()}`;
  const locationStr = order.tableName || order.sector || 'Para llevar';
  const dateStr = order.createdAt
    ? order.createdAt.toLocaleString('es-VE', {
        weekday: 'short',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const orderIsNew = !isPaid(order);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Hero card */}
      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroOrderNumber}>{orderNumShort}</Text>
            <Text style={styles.heroLocation}>{locationStr}</Text>
          </View>
          <PaymentStatusBadge status={order.paymentStatus} />
        </View>

        <View style={styles.heroFooter}>
          <View>
            <Text style={styles.heroLabel}>Total</Text>
            <Text style={styles.heroAmount}>{formatearUsd(order.total)}</Text>
          </View>
          {bcvRate > 0 ? (
            <View style={styles.heroBsCol}>
              <Text style={styles.heroLabel}>≈ Bs</Text>
              <Text style={styles.heroBsAmount}>
                {usdToBs(order.total, bcvRate).toFixed(0)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Información de orden */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Información</Text>
        <Row icon="calendar-outline" label="Fecha y hora" value={dateStr} />
        <Row icon="restaurant-outline" label="Ubicación" value={locationStr} />
        {order.customerName ? (
          <Row
            icon="person-circle-outline"
            label="Cliente"
            value={order.customerName}
          />
        ) : null}
        {order.orderType ? (
          <Row
            icon="location-outline"
            label="Tipo de orden"
            value={String(order.orderType)
              .replace('dine-in', 'Para comer aquí')
              .replace('takeaway', 'Para llevar')}
          />
        ) : null}
      </View>

      {/* Productos */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Productos ({order.items.length})</Text>
        {order.items.length === 0 ? (
          <Text style={styles.emptyItems}>Sin productos</Text>
        ) : (
          order.items.map((item, idx) => {
            const noCharge =
              (item as unknown as Record<string, unknown>).noCharge === true;
            return (
              <View key={`${item.productId}-${idx}`} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemQty}>
                    {packCountLabel(
                      item.quantity,
                      item.productId,
                      item.presentationQty,
                    )}
                    ×
                  </Text>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.productName}
                  </Text>
                </View>
                <View style={styles.itemRight}>
                  {noCharge ? (
                    <Text style={styles.itemNoCharge}>Cortesía</Text>
                  ) : (
                    <>
                      <Text style={styles.itemPrice}>
                        {formatearUsd(item.totalPrice)}
                      </Text>
                      <Text style={styles.itemUnitPrice}>
                        {formatearUsd(item.unitPrice)}/u
                      </Text>
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Totales */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Totales</Text>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatearUsd(order.subtotal)}</Text>
        </View>
        {(order.serviceCharge ?? 0) > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Servicio (
              {pctTexto(tarifasDeOrden(order, tarifasVigentes).serviceRate)}%)
            </Text>
            <Text style={styles.totalValue}>
              {formatearUsd(order.serviceCharge)}
            </Text>
          </View>
        ) : null}
        {(order.tax ?? 0) > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA</Text>
            <Text style={styles.totalValue}>{formatearUsd(order.tax)}</Text>
          </View>
        ) : null}
        <View style={[styles.totalRow, styles.totalRowMain]}>
          <Text style={styles.totalLabelMain}>Total</Text>
          <Text style={styles.totalValueMain}>{formatearUsd(order.total)}</Text>
        </View>
        {(order.tipAmount ?? 0) > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Propina</Text>
            <Text style={[styles.totalValue, { color: COLORS.primaryDark }]}>
              {formatearUsd(order.tipAmount)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Pagos */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Pagos</Text>
        {payments.length === 0 ? (
          orderIsNew ? (
            <Text style={styles.emptyItems}>Sin pagos registrados aún</Text>
          ) : (
            <>
              <Text style={styles.emptyItems}>Según la orden:</Text>
              <View style={styles.embeddedPayment}>
                <Row
                  icon="card-outline"
                  label="Método"
                  value={formatPaymentMethod(order.paymentMethod ?? 'CASH_USD')}
                />
                <Row
                  icon="cash-outline"
                  label="Monto USD"
                  value={formatearUsd(order.total)}
                />
                {bcvRate > 0 && order.bcvRate ? (
                  <Row
                    icon="trending-down-outline"
                    label="Tasa BCV"
                    value={`${order.bcvRate.toFixed(2)}`}
                  />
                ) : null}
                {order.paymentReference ? (
                  <Row
                    icon="receipt-outline"
                    label="Referencia"
                    value={order.paymentReference}
                  />
                ) : null}
              </View>
            </>
          )
        ) : (
          payments.map((payment) => {
            const expectedBs =
              payment.expectedAmountBS ??
              (payment.bcvRate ? payment.amount * payment.bcvRate : 0);
            const usedRate = payment.bcvRate ?? bcvRate;
            const timeStr = payment.createdAt
              ? payment.createdAt.toLocaleTimeString('es-VE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—';

            return (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentMethod}>
                    {formatPaymentMethod(payment.method)}
                  </Text>
                  <Text style={styles.paymentTime}>{timeStr}</Text>
                </View>
                <View style={styles.paymentAmount}>
                  <Text style={styles.paymentUsd}>
                    {formatearUsd(payment.amount)}
                  </Text>
                  {expectedBs > 0 ? (
                    <Text style={styles.paymentBs}>
                      ≈ Bs. {expectedBs.toFixed(0)}
                    </Text>
                  ) : null}
                </View>
                {usedRate > 0 ? (
                  <Text style={styles.paymentRate}>
                    Tasa: {usedRate.toFixed(2)}{' '}
                    {payment.bcvRate ? '' : '(tasa actual)'}
                  </Text>
                ) : null}
                {payment.reference ? (
                  <Text style={styles.paymentRef}>
                    Ref: {payment.reference}
                  </Text>
                ) : null}
                {payment.notes ? (
                  <Text style={styles.paymentNotes}>{payment.notes}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  muted: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
  errorText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: FONT_SIZE.md,
  },

  /* Hero */
  hero: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  heroOrderNumber: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  heroLocation: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.xs,
  },
  heroAmount: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: FONT_WEIGHT.bold,
  },
  heroBsCol: {
    alignItems: 'flex-end',
  },
  heroBsAmount: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },

  /* Block */
  block: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  blockTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    marginBottom: SPACING.sm,
  },

  /* Row */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  rowIcon: {
    marginTop: 2,
    marginRight: SPACING.sm,
  },
  rowTextCol: {
    flex: 1,
  },
  rowLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginBottom: 2,
  },
  rowValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },

  /* Items */
  emptyItems: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    marginRight: SPACING.md,
  },
  itemQty: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  itemName: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  itemUnitPrice: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  itemNoCharge: {
    color: COLORS.primaryDark,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },

  /* Totales */
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  totalRowMain: {
    borderBottomWidth: 0,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  totalLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
  totalLabelMain: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  totalValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  totalValueMain: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },

  /* Pagos */
  embeddedPayment: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  paymentCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  paymentMethod: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  paymentTime: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  paymentAmount: {
    marginBottom: SPACING.xs,
  },
  paymentUsd: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  paymentBs: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  paymentRate: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
  },
  paymentRef: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
    fontFamily: 'monospace',
  },
  paymentNotes: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
});

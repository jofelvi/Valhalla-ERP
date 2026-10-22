import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { Button } from '../../components/ui/Button';
import { orderService } from '../../services';
import { useOrdenesPendientesDeCobro } from '../../queries/useOrdenes';
import { getBcvRate, usdToBs } from '../../services/bcvRateService';
import {
  cashRegisterService,
  CashRegisterSession,
} from '../../services/cashRegisterService';
import { Order, PaymentStatusEnum, OrderStatusEnum } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store';
import { UserRoleEnum } from '../../types';
import { formatearUsd, formatearBs } from '../../utils/dinero';

import { useVocab } from '../../config/hooks';
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type SectionType = 'verification' | 'active' | 'partial';

interface Section {
  type: SectionType;
  title: string;
  icon: string;
  color: string;
  orders: Order[];
}

const getTimeSince = (date: Date | null): string => {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}min`;
  return `${Math.floor(hours / 24)}d`;
};

const formatTime = (date: Date | null): string => {
  if (!date) return '--:--';
  return date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const CashierOrdersScreen: React.FC = () => {
  const vocab = useVocab();
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const [bcvRate, setBcvRate] = useState(0);

  // Session state
  const [session, setSession] = useState<
    CashRegisterSession | null | undefined
  >(undefined); // undefined = loading
  const [isOpeningSession, setIsOpeningSession] = useState(false);

  useEffect(() => {
    getBcvRate().then(setBcvRate);
  }, []);

  // Subscribe to active session
  useEffect(() => {
    if (!user) return;
    const unsubscribe = cashRegisterService.subscribeToActiveSession(
      user.uid,
      (s) => {
        setSession(s);
      },
    );
    return () => unsubscribe();
  }, [user]);

  // Las ordenes las trae React Query y las mantiene al dia el socket, que se
  // monta UNA vez arriba de todo (`useSincronizarOrdenesPorSocket`).
  //
  // Antes esto era un efecto con `[session]` en las dependencias, y `session`
  // era un objeto NUEVO cada 5 segundos porque la caja se polleaba. React veia
  // otra referencia, desmontaba la suscripcion y la volvia a montar: 12
  // peticiones por minuto de 1,57 MB cada una, y —peor— 3,6 segundos de cada 5
  // sin escuchar `order:created`, porque los listeners del socket se enganchan
  // despues del fetch inicial. Una orden que entrara en esa ventana no se veia.
  //
  // `session?.id` es primitivo a proposito: es lo unico que de verdad cambia
  // cuando se abre o se cierra la caja.
  const {
    data: orders = [],
    isLoading,
    isFetching: refreshing,
    refetch: recargarOrdenes,
  } = useOrdenesPendientesDeCobro(Boolean(session?.id));

  const onRefresh = () => {
    void recargarOrdenes();
    getBcvRate().then(setBcvRate);
  };

  const handleOpenSession = async () => {
    if (!user) return;
    setIsOpeningSession(true);
    try {
      await cashRegisterService.openSession(
        user.uid,
        user.displayName ?? vocab.cashier,
      );
    } catch (error) {
      console.error('Error abriendo caja:', error);
    } finally {
      setIsOpeningSession(false);
    }
  };

  const handleCloseSession = () => {
    if (!session) return;
    navigation.navigate('CashierClose', { sessionId: session.id });
  };

  const handleHistory = () => {
    navigation.navigate('CashierHistory' as never);
  };

  const sections = useMemo((): Section[] => {
    const verification = orders.filter(
      (o) => o.paymentStatus === PaymentStatusEnum.PENDING_VERIFICATION,
    );
    const partial = orders.filter(
      (o) => o.paymentStatus === PaymentStatusEnum.PARTIAL,
    );
    const active = orders.filter(
      (o) =>
        o.paymentStatus === PaymentStatusEnum.PENDING &&
        o.status !== OrderStatusEnum.DELIVERED &&
        o.status !== OrderStatusEnum.CREDIT,
    );

    const result: Section[] = [];
    if (verification.length > 0) {
      result.push({
        type: 'verification',
        title: 'Pagos por Verificar',
        icon: 'alert-circle',
        color: COLORS.warning,
        orders: verification,
      });
    }
    if (partial.length > 0) {
      result.push({
        type: 'partial',
        title: 'Pagos Parciales',
        icon: 'pie-chart',
        color: COLORS.info,
        orders: partial,
      });
    }
    if (active.length > 0) {
      result.push({
        type: 'active',
        title: 'Ordenes Activas',
        icon: 'receipt',
        color: COLORS.primary,
        orders: active,
      });
    }
    return result;
  }, [orders]);

  const handleCobrar = (order: Order) => {
    navigation.navigate('CashierPayment', {
      orderId: order.id,
      tableId: order.tableId ?? undefined,
    });
  };

  const handleViewDetail = (order: Order) => {
    navigation.navigate('OrderDetail', { orderId: order.id });
  };

  const renderOrderCard = (order: Order, sectionType: SectionType) => {
    const locationLabel = order.tableName
      ? order.tableName
      : order.sector
        ? order.sector.charAt(0).toUpperCase() + order.sector.slice(1)
        : 'Para Llevar';

    const hasPendingPayments = (order.pendingPayments?.length ?? 0) > 0;

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          sectionType === 'verification' && styles.orderCardVerification,
        ]}
        onPress={() => handleViewDetail(order)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.orderId}>
              #{order.id.slice(-6).toUpperCase()}
            </Text>
            <View style={styles.locationBadge}>
              <Ionicons
                name={
                  order.tableId
                    ? 'restaurant-outline'
                    : order.sector
                      ? 'map-outline'
                      : 'bag-handle-outline'
                }
                size={12}
                color={COLORS.primary}
              />
              <Text style={styles.locationText}>{locationLabel}</Text>
            </View>
          </View>
          <Text style={styles.timeText}>{getTimeSince(order.createdAt)}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.itemsSummary}>
            <Text style={styles.itemsCount}>
              {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
            </Text>
            {order.waiterName && (
              <Text style={styles.waiterText}>
                <Ionicons
                  name="person-outline"
                  size={11}
                  color={COLORS.textSecondary}
                />{' '}
                {order.waiterName}
              </Text>
            )}
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.totalUsd}>{formatearUsd(order.total)}</Text>
            {bcvRate > 0 && (
              <Text style={styles.totalBs}>
                {formatearBs(usdToBs(order.total, bcvRate))}
              </Text>
            )}
          </View>
        </View>

        {hasPendingPayments && sectionType === 'verification' && (
          <View style={styles.pendingPaymentsInfo}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={COLORS.warning}
            />
            <Text style={styles.pendingPaymentsText}>
              {order.pendingPayments!.length}{' '}
              {order.pendingPayments!.length === 1
                ? 'pago registrado'
                : 'pagos registrados'}{' '}
              por mesonero
            </Text>
          </View>
        )}

        <Button
          label={
            sectionType === 'verification' ? 'Verificar y Cobrar' : 'Cobrar'
          }
          variant={sectionType === 'verification' ? 'danger' : 'primary'}
          size="md"
          onPress={() => handleCobrar(order)}
          icon={
            <Ionicons
              name={
                sectionType === 'verification'
                  ? 'checkmark-done'
                  : 'cash-outline'
              }
              size={18}
              color={COLORS.background}
            />
          }
          iconPosition="left"
          style={styles.cobrarBtn}
        />
      </TouchableOpacity>
    );
  };

  // Loading state (checking session)
  if (session === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="cash-outline" size={36} color={COLORS.primary} />
        </View>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: SPACING.lg }}
        />
        <Text style={styles.loadingText}>Cargando caja...</Text>
      </View>
    );
  }

  // No active session — show "Abrir Caja"
  if (!session) {
    return (
      <View style={styles.container}>
        <View style={styles.openCajaContainer}>
          <View style={styles.openCajaIcon}>
            <Ionicons
              name="lock-closed-outline"
              size={56}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.openCajaTitle}>Caja Cerrada</Text>
          <Text style={styles.openCajaSubtitle}>
            Abre la caja para comenzar a recibir y cobrar ordenes
          </Text>

          <Button
            label="Abrir Caja"
            variant="primary"
            size="lg"
            loading={isOpeningSession}
            disabled={isOpeningSession}
            onPress={handleOpenSession}
            icon={
              <Ionicons
                name="lock-open-outline"
                size={22}
                color={COLORS.background}
              />
            }
            iconPosition="left"
            style={{ width: '100%', maxWidth: 280 }}
          />

          <Button
            label="Ver historial de sesiones"
            variant="ghost"
            size="md"
            onPress={handleHistory}
            icon={
              <Ionicons
                name="time-outline"
                size={16}
                color={COLORS.primaryLight}
              />
            }
            iconPosition="left"
            style={{ marginTop: SPACING.xl }}
          />
        </View>
      </View>
    );
  }

  // Active session — show orders
  const isAdminOrManager =
    role === UserRoleEnum.ADMIN || role === UserRoleEnum.MANAGER;

  return (
    <View style={styles.container}>
      {/* Session header */}
      <View style={styles.sessionBar}>
        <View style={styles.sessionBarLeft}>
          <View style={styles.sessionDot} />
          <Text style={styles.sessionBarText}>
            Caja abierta desde {formatTime(session.openedAt)}
          </Text>
        </View>
        <View style={styles.sessionBarRight}>
          <TouchableOpacity
            onPress={handleHistory}
            style={styles.sessionBarBtn}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={COLORS.primaryLight}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCloseSession}
            style={styles.closeSessionBtn}
          >
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={COLORS.error}
            />
            <Text style={styles.closeSessionText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: COLORS.warning }]}>
          <Text style={styles.statNumber}>
            {
              orders.filter(
                (o) =>
                  o.paymentStatus === PaymentStatusEnum.PENDING_VERIFICATION,
              ).length
            }
          </Text>
          <Text style={styles.statLabel}>Por verificar</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.info }]}>
          <Text style={styles.statNumber}>
            {
              orders.filter(
                (o) => o.paymentStatus === PaymentStatusEnum.PARTIAL,
              ).length
            }
          </Text>
          <Text style={styles.statLabel}>Parciales</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
          <Text style={styles.statNumber}>
            {
              orders.filter(
                (o) =>
                  o.paymentStatus === PaymentStatusEnum.PENDING &&
                  o.status !== OrderStatusEnum.DELIVERED &&
                  o.status !== OrderStatusEnum.CREDIT,
              ).length
            }
          </Text>
          <Text style={styles.statLabel}>Activas</Text>
        </View>
      </View>

      {bcvRate > 0 && (
        <View style={styles.rateBar}>
          <Ionicons name="trending-up" size={14} color={COLORS.primaryLight} />
          <Text style={styles.rateBarText}>
            Tasa BCV: {bcvRate.toFixed(2)} Bs/$
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="checkmark-circle-outline"
              size={48}
              color={COLORS.success}
            />
          </View>
          <Text style={styles.emptyTitle}>Sin ordenes pendientes</Text>
          <Text style={styles.emptySubtitle}>
            Todas las ordenes han sido cobradas
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.type}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item: section }) => (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name={section.icon as 'alert-circle'}
                  size={18}
                  color={section.color}
                />
                <Text style={[styles.sectionTitle, { color: section.color }]}>
                  {section.title}
                </Text>
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: `${section.color}20` },
                  ]}
                >
                  <Text style={[styles.countText, { color: section.color }]}>
                    {section.orders.length}
                  </Text>
                </View>
              </View>
              {section.orders.map((order) => (
                <View key={order.id}>
                  {renderOrderCard(order, section.type)}
                </View>
              ))}
            </View>
          )}
        />
      )}

      {isAdminOrManager && (
        <TouchableOpacity
          style={styles.dispatchButton}
          onPress={() => navigation.navigate('Dispatch' as never)}
        >
          <Ionicons name="paper-plane" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },

  // Open Caja state
  openCajaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  openCajaIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  openCajaTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  openCajaSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },

  // Session bar
  sessionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: `${COLORS.success}10`,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.success}20`,
  },
  sessionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  sessionBarText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.medium,
  },
  sessionBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sessionBarBtn: { padding: SPACING.xs },
  closeSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: `${COLORS.error}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  closeSessionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    ...SHADOWS.small,
  },
  statNumber: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  rateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  rateBarText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primaryLight,
    fontWeight: FONT_WEIGHT.medium,
  },

  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  sectionContainer: { marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  orderCardVerification: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  orderId: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: 3,
  },
  locationText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  timeText: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },

  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
  },
  itemsSummary: { flex: 1 },
  itemsCount: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  waiterText: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 2 },

  priceRow: { alignItems: 'flex-end' },
  totalUsd: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  totalBs: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  pendingPaymentsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: `${COLORS.warning}10`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  pendingPaymentsText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.warning,
    fontWeight: FONT_WEIGHT.medium,
  },

  cobrarBtn: {},

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.success}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },

  dispatchButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
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
});

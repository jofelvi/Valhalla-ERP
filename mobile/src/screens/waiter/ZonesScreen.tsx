import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import { orderService } from '../../services';
import { getBcvRate, usdToBs } from '../../services/bcvRateService';
import {
  Order,
  OrderStatusEnum,
  PaymentStatusEnum,
  ZoneSectorEnum,
} from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store';
import { TransferModal } from '../../components';
import { Button, Card } from '../../components/ui';
import { getOrderDisplayStatus } from '../../utils/orderStatusHelpers';
import { formatearUsd, formatearBs } from '../../utils/dinero';

import { useVocab } from '../../config/hooks';
import { esZonaVisible } from '../../config/zonas';
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SectorInfo {
  key: ZoneSectorEnum;
  label: string;
  emoji: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Catálogo completo de zonas: las ocultas (ZONAS_VISIBLES) siguen con etiqueta para
// los pedidos que aún están en ellas. Solo el selector de nueva orden se filtra.
const SECTORS: SectorInfo[] = [
  {
    key: ZoneSectorEnum.EVENTO,
    label: 'Evento',
    emoji: '\u{1F389}',
    icon: 'calendar-outline',
  },
  {
    key: ZoneSectorEnum.PISCINA,
    label: 'Piscina',
    emoji: '\u{1F3CA}',
    icon: 'water-outline',
  },
  {
    key: ZoneSectorEnum.TENIS,
    label: 'Tenis',
    emoji: '\u{1F3BE}',
    icon: 'tennisball-outline',
  },
  {
    key: ZoneSectorEnum.FUTBOL,
    label: 'Futbol',
    emoji: '\u26BD',
    icon: 'football-outline',
  },
  {
    key: ZoneSectorEnum.BEISBOL,
    label: 'Beisbol',
    emoji: '\u26BE',
    icon: 'baseball-outline',
  },
  {
    key: ZoneSectorEnum.SALON_PRINCIPAL,
    label: 'Salon Principal',
    emoji: '\u{1F3DB}\uFE0F',
    icon: 'business-outline',
  },
  {
    key: ZoneSectorEnum.CANCHAS,
    label: 'Canchas',
    emoji: '\u{1F3DF}\uFE0F',
    icon: 'trophy-outline',
  },
];

const getSectorInfo = (sector: ZoneSectorEnum): SectorInfo => {
  return SECTORS.find((s) => s.key === sector) ?? SECTORS[0];
};

const ACTIVE_STATUSES = [
  OrderStatusEnum.PENDING,
  OrderStatusEnum.IN_PROGRESS,
  OrderStatusEnum.READY,
  OrderStatusEnum.DELIVERED,
];

interface SectorGroup {
  sector: SectorInfo;
  orders: Order[];
  totalAmount: number;
}

export const ZonesScreen: React.FC = () => {
  const vocab = useVocab();
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((s) => s.user);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<Set<ZoneSectorEnum>>(
    new Set(Object.values(ZoneSectorEnum)),
  );
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [bcvRate, setBcvRate] = useState(0);
  const [transferSource, setTransferSource] = useState<{
    id: string;
    tableId?: string | null;
    tableName?: string | null;
    sector?: ZoneSectorEnum | null;
  } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = orderService.subscribeToZoneOrders(
      user.uid,
      (orders) => {
        setAllOrders(orders);
        setIsLoading(false);
        setIsRefreshing(false);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      },
    );

    getBcvRate()
      .then(setBcvRate)
      .catch(() => setBcvRate(0));

    return () => unsubscribe();
  }, [fadeAnim, user]);

  const activeOrders = allOrders.filter((o) =>
    ACTIVE_STATUSES.includes(o.status),
  );

  const sectorGroups: SectorGroup[] = SECTORS.map((sector) => {
    const orders = activeOrders.filter((o) => o.sector === sector.key);
    const totalAmount = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
    return { sector, orders, totalAmount };
  }).filter((g) => g.orders.length > 0);

  const totalActiveOrders = activeOrders.length;
  const totalAmount = activeOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);

  const toggleSector = (sectorKey: ZoneSectorEnum) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sectorKey)) {
        next.delete(sectorKey);
      } else {
        next.add(sectorKey);
      }
      return next;
    });
  };

  const handleNewOrder = (sector: ZoneSectorEnum) => {
    setShowSectorModal(false);
    navigation.navigate('WaiterCreateOrder', { sector });
  };

  const handleOrderPress = (orderId: string) => {
    navigation.navigate('OrderDetail', { orderId });
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
  }, []);

  const onFabPressIn = () => {
    Animated.spring(fabScale, {
      toValue: 0.9,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const onFabPressOut = () => {
    Animated.spring(fabScale, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const renderOrderCard = (order: Order) => {
    const estado = getOrderDisplayStatus(order, {
      avisoDeVerificacionAparte: true,
    });
    const statusColor = estado.color;
    return (
      <TouchableOpacity
        key={order.id}
        style={styles.orderCard}
        onPress={() => handleOrderPress(order.id)}
        activeOpacity={0.7}
      >
        <View style={styles.orderCardHeader}>
          <View style={styles.orderIdRow}>
            <Ionicons name="receipt-outline" size={13} color={COLORS.primary} />
            <Text style={styles.orderIdText}>
              #{order.id.slice(-6).toUpperCase()}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusColor}20` },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {estado.label}
            </Text>
          </View>
        </View>

        {(order.customerAlias || order.customerName) && (
          <View style={styles.customerRow}>
            <Ionicons
              name="person-circle-outline"
              size={13}
              color={COLORS.primary}
            />
            <Text style={styles.customerText} numberOfLines={1}>
              {order.customerAlias || order.customerName}
            </Text>
          </View>
        )}

        <Text style={styles.orderItems} numberOfLines={1}>
          {order.items.map((i) => i.productName).join(', ')}
        </Text>

        {order.paymentStatus === PaymentStatusEnum.PENDING_VERIFICATION && (
          <View style={styles.verificationBadge}>
            <Ionicons name="time-outline" size={12} color={COLORS.warning} />
            <Text style={styles.verificationText}>Pago en verificacion</Text>
          </View>
        )}

        <View style={styles.orderCardFooter}>
          <View>
            <Text style={styles.orderAmount}>{formatearUsd(order.total)}</Text>
            {bcvRate > 0 && (
              <Text style={styles.orderAmountBs}>
                {formatearBs(usdToBs(order.total ?? 0, bcvRate))}
              </Text>
            )}
          </View>
          <View style={styles.orderCardActions}>
            <TouchableOpacity
              style={styles.transferButton}
              onPress={() =>
                setTransferSource({
                  id: order.id,
                  tableId: order.tableId,
                  tableName: order.tableName,
                  sector: order.sector,
                })
              }
              activeOpacity={0.7}
            >
              <Ionicons
                name="swap-horizontal"
                size={14}
                color={COLORS.primary}
              />
              <Text style={styles.transferButtonText}>Traspasar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectorGroup = ({ item: group }: { item: SectorGroup }) => {
    const isExpanded = expandedSectors.has(group.sector.key);

    return (
      <View style={styles.sectorCard}>
        <TouchableOpacity
          style={styles.sectorHeader}
          onPress={() => toggleSector(group.sector.key)}
          activeOpacity={0.7}
        >
          <View style={styles.sectorHeaderLeft}>
            <Text style={styles.sectorEmoji}>{group.sector.emoji}</Text>
            <View>
              <Text style={styles.sectorName}>{group.sector.label}</Text>
              <Text style={styles.sectorStats}>
                {group.orders.length} pedido
                {group.orders.length !== 1 ? 's' : ''} &bull;{' '}
                {formatearUsd(group.totalAmount)}
              </Text>
            </View>
          </View>
          <View style={styles.sectorHeaderRight}>
            <View style={styles.sectorCountBadge}>
              <Text style={styles.sectorCountText}>{group.orders.length}</Text>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectorContent}>
            {group.orders.map(renderOrderCard)}
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="map-outline" size={36} color={COLORS.primary} />
        </View>
        <Text style={styles.loadingText}>Cargando zonas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Pedidos por {vocab.zone}</Text>
            <Text style={styles.subtitle}>
              {totalActiveOrders} pedido{totalActiveOrders !== 1 ? 's' : ''}{' '}
              activo{totalActiveOrders !== 1 ? 's' : ''}
              {totalAmount > 0 ? ` \u2022 ${formatearUsd(totalAmount)}` : ''}
            </Text>
          </View>
        </View>

        <FlatList
          data={sectorGroups}
          keyExtractor={(item) => item.sector.key}
          renderItem={renderSectorGroup}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons
                  name="map-outline"
                  size={48}
                  color={`${COLORS.primary}60`}
                />
              </View>
              <Text style={styles.emptyTitle}>Sin pedidos en zonas</Text>
              <Text style={styles.emptyText}>
                Presiona el boton + para crear un pedido en una zona
              </Text>
            </View>
          }
        />
      </Animated.View>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowSectorModal(true)}
        onPressIn={onFabPressIn}
        onPressOut={onFabPressOut}
        activeOpacity={1}
        style={styles.fabTouchable}
      >
        <Animated.View
          style={[styles.fabWrapper, { transform: [{ scale: fabScale }] }]}
        >
          <LinearGradient
            colors={[COLORS.gradientStart, COLORS.gradientEnd]}
            style={styles.fab}
          >
            <Ionicons name="add" size={28} color={COLORS.background} />
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>

      {transferSource && (
        <TransferModal
          visible={!!transferSource}
          onClose={() => setTransferSource(null)}
          sourceOrder={transferSource}
          onTransferComplete={() => setTransferSource(null)}
        />
      )}

      {/* Modal selector de zona */}
      <Modal
        visible={showSectorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSectorModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSectorModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar {vocab.zone}</Text>
            <Text style={styles.modalSubtitle}>
              Elige la zona para el nuevo pedido
            </Text>

            <View style={styles.sectorGrid}>
              {SECTORS.filter((sector) => esZonaVisible(sector.key)).map(
                (sector) => (
                  <TouchableOpacity
                    key={sector.key}
                    style={styles.sectorOption}
                    onPress={() => handleNewOrder(sector.key)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sectorOptionIcon}>
                      <Text style={styles.sectorOptionEmoji}>
                        {sector.emoji}
                      </Text>
                    </View>
                    <Text style={styles.sectorOptionLabel}>{sector.label}</Text>
                  </TouchableOpacity>
                ),
              )}
            </View>

            <Button
              label="Cancelar"
              variant="ghost"
              size="md"
              onPress={() => setShowSectorModal(false)}
              style={styles.modalCancelButton}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.lg,
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
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  // Sector accordion
  sectorCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  sectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  sectorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  sectorEmoji: {
    fontSize: 28,
  },
  sectorName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  sectorStats: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectorHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectorCountBadge: {
    backgroundColor: COLORS.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectorCountText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  sectorContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  // Order cards inside sectors
  orderCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  orderIdText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  orderItems: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  customerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.semibold,
    flex: 1,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${COLORS.warning}22`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 4,
  },
  verificationText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.warning,
    fontWeight: FONT_WEIGHT.semibold,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  orderAmountBs: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  orderItemCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  orderCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}12`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
    borderWidth: 1,
    borderColor: `${COLORS.primary}25`,
  },
  transferButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.md,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  // FAB
  fabTouchable: {
    position: 'absolute',
    bottom: 24,
    right: 20,
  },
  fabWrapper: {
    ...SHADOWS.large,
    borderRadius: 30,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xxl,
    width: SCREEN_WIDTH - SPACING.xxl * 2,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  sectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  sectorOption: {
    width: (SCREEN_WIDTH - SPACING.xxl * 2 - SPACING.xxl * 2 - SPACING.md) / 2,
    maxWidth: 160,
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectorOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectorOptionEmoji: {
    fontSize: 24,
  },
  sectorOptionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    textAlign: 'center',
  },
  modalCancelButton: {
    marginTop: SPACING.xl,
    alignSelf: 'center',
  },
});

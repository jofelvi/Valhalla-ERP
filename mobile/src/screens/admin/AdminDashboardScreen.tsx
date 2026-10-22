import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import {
  analyticsService,
  SalesMetric,
  TopProduct,
  TopWaiter,
} from '../../services/analyticsService';
import {
  alertsService,
  Alert,
  AlertsResponse,
} from '../../services/alertsService';
import { RootStackParamList } from '../../navigation/types';
import { formatearUsd } from '../../utils/dinero';

import { useVocab } from '../../config/hooks';
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const AdminDashboardScreen: React.FC = () => {
  const vocab = useVocab();
  const navigation = useNavigation<NavigationProp>();
  const [salesToday, setSalesToday] = useState<SalesMetric | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topWaiters, setTopWaiters] = useState<TopWaiter[]>([]);
  const [alerts, setAlerts] = useState<AlertsResponse>({
    margins: [],
    pending: [],
    outOfStock: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [today, _weekly, products, waiters, allAlerts] = await Promise.all([
        analyticsService.getSalesToday(),
        analyticsService.getSalesWeekly(),
        analyticsService.getTopProducts(),
        analyticsService.getTopWaiters(),
        alertsService.getAlerts(),
      ]);
      setSalesToday(today);
      setTopProducts(products.slice(0, 3));
      setTopWaiters(waiters.slice(0, 3));
      setAlerts(allAlerts);
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderKPICard = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    value: string,
    color: string,
  ) => (
    <View style={[styles.kpiCard, { borderLeftColor: color }]}>
      <View
        style={[styles.kpiIconContainer, { backgroundColor: `${color}15` }]}
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.kpiContent}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={styles.kpiValue}>{value}</Text>
      </View>
    </View>
  );

  const renderAlert = (alert: Alert) => (
    <View key={alert.id} style={styles.alertItem}>
      <View
        style={[
          styles.alertIcon,
          {
            backgroundColor:
              alert.severity === 'high'
                ? `${COLORS.error}15`
                : alert.severity === 'medium'
                  ? `${COLORS.warning}15`
                  : `${COLORS.info}15`,
          },
        ]}
      >
        <Ionicons
          name="warning"
          size={16}
          color={
            alert.severity === 'high'
              ? COLORS.error
              : alert.severity === 'medium'
                ? COLORS.warning
                : COLORS.info
          }
        />
      </View>
      <View style={styles.alertContent}>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.alertMessage}>{alert.message}</Text>
      </View>
    </View>
  );

  const renderProductRow = (product: TopProduct) => (
    <View key={product.id} style={styles.productRow}>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.productQty}>{product.quantity} unidades</Text>
      </View>
      <Text style={styles.productRevenue}>{formatearUsd(product.revenue)}</Text>
    </View>
  );

  const renderWaiterRow = (waiter: TopWaiter) => (
    <View key={waiter.id} style={styles.waiterRow}>
      <View style={styles.waiterInfo}>
        <Text style={styles.waiterName} numberOfLines={1}>
          {waiter.name}
        </Text>
        <Text style={styles.waiterOrders}>{waiter.orderCount} pedidos</Text>
      </View>
      <Text style={styles.waiterCommission}>
        {formatearUsd(waiter.commission)}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Cards */}
        <View style={styles.kpiContainer}>
          {renderKPICard(
            'cash-outline',
            'Ventas Hoy',
            formatearUsd(salesToday?.totalSales ?? 0),
            COLORS.success,
          )}
          {renderKPICard(
            'receipt-outline',
            'Órdenes',
            String(salesToday?.orderCount ?? 0),
            COLORS.primary,
          )}
          {renderKPICard(
            'trending-up-outline',
            'Ticket Promedio',
            formatearUsd(salesToday?.averageOrderValue ?? 0),
            COLORS.info,
          )}
        </View>

        {/* Top Productos */}
        {topProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Productos Más Vendidos</Text>
            </View>
            <View style={styles.sectionCard}>
              {topProducts.map(renderProductRow)}
            </View>
          </View>
        )}

        {/* Top Mesoneros */}
        {topWaiters.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="person-outline"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>{vocab.waiters} Top</Text>
            </View>
            <View style={styles.sectionCard}>
              {topWaiters.map(renderWaiterRow)}
            </View>
          </View>
        )}

        {/* Alertas */}
        {(alerts.margins?.length ?? 0) +
          (alerts.pending?.length ?? 0) +
          (alerts.outOfStock?.length ?? 0) >
          0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={COLORS.warning}
              />
              <Text style={styles.sectionTitle}>Alertas</Text>
            </View>
            <View style={styles.alertsContainer}>
              {[
                ...(alerts.margins ?? []),
                ...(alerts.pending ?? []),
                ...(alerts.outOfStock ?? []),
              ].map(renderAlert)}
            </View>
          </View>
        )}

        {/* Accesos Rápidos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Accesos Rápidos</Text>
          </View>
          <View style={styles.quickAccessGrid}>
            <TouchableOpacity
              style={styles.quickAccessButton}
              onPress={() => {
                navigation.navigate('InventoryHub');
              }}
            >
              <Ionicons name="bag-outline" size={28} color={COLORS.primary} />
              <Text style={styles.quickAccessLabel}>Compras</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAccessButton}
              onPress={() => {
                navigation.navigate('InventoryHub');
              }}
            >
              <Ionicons name="cube-outline" size={28} color={COLORS.primary} />
              <Text style={styles.quickAccessLabel}>Inventario</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  kpiContainer: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  kpiCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    ...SHADOWS.small,
  },
  kpiIconContainer: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  kpiContent: {
    flex: 1,
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  kpiValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  productQty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  productRevenue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.success,
  },
  waiterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  waiterInfo: {
    flex: 1,
  },
  waiterName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  waiterOrders: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  waiterCommission: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  alertsContainer: {
    gap: SPACING.md,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  alertMessage: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  quickAccessButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    ...SHADOWS.small,
  },
  quickAccessLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    textAlign: 'center',
  },
});

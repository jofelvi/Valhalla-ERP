import { PROPINA_HABILITADA } from '../../config/funciones';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
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
  comisionesService,
  PagoComision,
  ComisionResumen,
} from '../../services/comisionesService';
import { getBcvRate, usdToBs } from '../../services/bcvRateService';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store';
import { formatearUsd, formatearBs } from '../../utils/dinero';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function parseDate(value: string | Date | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatFechaCorta(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const WaiterCommissionsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((s) => s.user);
  const [resumen, setResumen] = useState<ComisionResumen | null>(null);
  const [historial, setHistorial] = useState<PagoComision[]>([]);
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waiterId = user?.uid ?? '';

  const load = useCallback(async () => {
    if (!waiterId) return;
    setError(null);
    try {
      const [r, h, rate] = await Promise.all([
        comisionesService.getResumen(waiterId),
        comisionesService.getHistorial(waiterId),
        getBcvRate().catch(() => 0),
      ]);
      setResumen(r);
      setHistorial(h);
      setBcvRate(rate);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudieron cargar las comisiones';
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

  const openDetail = (pago: PagoComision) => {
    navigation.navigate('WaiterCommissionDetail', { pagoId: pago.id });
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Inicia sesión para ver tus comisiones.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando comisiones...</Text>
      </View>
    );
  }

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

      {resumen ? (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { flex: 1.1 }]}>
            <Text style={styles.summaryLabel}>Total liquidado</Text>
            <Text style={styles.summaryValue}>
              {formatearUsd(resumen.totalAmount)}
            </Text>
            {bcvRate > 0 ? (
              <Text style={styles.summaryBs}>
                {formatearBs(usdToBs(resumen.totalAmount, bcvRate))}
              </Text>
            ) : null}
          </View>
          {PROPINA_HABILITADA ? (
            <View style={[styles.summaryCard, { flex: 1 }]}>
              <Text style={styles.summaryLabel}>Propinas</Text>
              <Text style={styles.summaryValue}>
                {formatearUsd(resumen.totalTip)}
              </Text>
              {bcvRate > 0 ? (
                <Text style={styles.summaryBs}>
                  {formatearBs(usdToBs(resumen.totalTip, bcvRate))}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={[styles.summaryCard, { flex: 0.75 }]}>
            <Text style={styles.summaryLabel}>Pagos</Text>
            <Text style={styles.summaryValue}>{resumen.paymentCount}</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Historial de liquidaciones</Text>

      <FlatList
        data={historial}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          historial.length === 0 ? styles.emptyList : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="wallet-outline"
              size={48}
              color={`${COLORS.primary}50`}
            />
            <Text style={styles.emptyTitle}>Sin liquidaciones aún</Text>
            <Text style={styles.emptySubtitle}>
              Cuando administración registre un pago de comisiones, aparecerá
              aquí con el detalle.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const fecha = parseDate(item.fechaPago);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openDetail(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.cardDate}>{formatFechaCorta(fecha)}</Text>
                  <Text style={styles.cardMeta}>
                    {item.orderIds.length} orden
                    {item.orderIds.length === 1 ? '' : 'es'}
                  </Text>
                </View>
                <View style={styles.cardAmountCol}>
                  <Text style={styles.cardAmount}>
                    {formatearUsd(item.montoTotal)}
                  </Text>
                  {PROPINA_HABILITADA && (item.tipTotal ?? 0) > 0 ? (
                    <Text style={styles.cardTip}>
                      + {formatearUsd(item.tipTotal)} propina
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.textSecondary}
                />
              </View>
            </TouchableOpacity>
          );
        }}
      />
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
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  summaryBs: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardDate: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  cardMeta: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  cardAmountCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cardAmount: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  cardTip: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
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
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
});

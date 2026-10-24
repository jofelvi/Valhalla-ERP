import { PROPINA_HABILITADA } from '../../config/funciones';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
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
  comisionesService,
  PagoComision,
} from '../../services/comisionesService';
import { getBcvRate, usdToBs } from '../../services/bcvRateService';
import { Button } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';
import { formatearUsd, formatearBs } from '../../utils/dinero';

type RouteProps = RouteProp<RootStackParamList, 'WaiterCommissionDetail'>;
type NavProp = NativeStackNavigationProp<
  RootStackParamList,
  'WaiterCommissionDetail'
>;

function parseDate(value: string | Date | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatFechaLarga(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('es-VE', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const WaiterCommissionDetailScreen: React.FC = () => {
  const { params } = useRoute<RouteProps>();
  const navigation = useNavigation<NavProp>();
  const [pago, setPago] = useState<PagoComision | null>(null);
  const [bcvRate, setBcvRate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [data, rate] = await Promise.all([
        comisionesService.getPagoById(params.pagoId),
        getBcvRate().catch(() => 0),
      ]);
      setPago(data);
      setBcvRate(rate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el detalle');
    } finally {
      setLoading(false);
    }
  }, [params.pagoId]);

  React.useEffect(() => {
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

  if (error || !pago) {
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

  const desde = parseDate(pago.periodoDesde);
  const hasta = parseDate(pago.periodoHasta);
  const fechaPago = parseDate(pago.fechaPago);
  const tip = pago.tipTotal ?? 0;
  // La tasa la manda la API con el pago. Sin ella no se inventa un porcentaje: la fila no sale.
  const pct = pago.comisionPct;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Monto liquidado</Text>
        <Text style={styles.heroAmount}>{formatearUsd(pago.montoTotal)}</Text>
        {bcvRate > 0 ? (
          <Text style={styles.heroBs}>
            ≈ {formatearBs(usdToBs(pago.montoTotal, bcvRate))}
          </Text>
        ) : null}
        {PROPINA_HABILITADA && tip > 0 ? (
          <Text style={styles.heroTip}>
            Incluye {formatearUsd(tip)} en propinas registradas
          </Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <Row
          icon="calendar-outline"
          label="Fecha de pago"
          value={formatFechaLarga(fechaPago)}
        />
        <Row
          icon="time-outline"
          label="Período de órdenes"
          value={
            desde && hasta
              ? `${desde.toLocaleDateString('es-VE')} — ${hasta.toLocaleDateString('es-VE')}`
              : '—'
          }
        />
        <Row icon="person-outline" label="Mesonero" value={pago.waiterName} />
        {pct != null ? (
          <Row
            icon="pricetag-outline"
            label="% comisión aplicado"
            value={`${pct}%`}
          />
        ) : null}
        <Row
          icon="shield-checkmark-outline"
          label="Registrado por"
          value={pago.usuarioPago}
        />
        {pago.sesionesCubiertas != null ? (
          <Row
            icon="layers-outline"
            label="Sesiones cubiertas"
            value={String(pago.sesionesCubiertas)}
          />
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>
          Órdenes incluidas ({pago.orderIds.length})
        </Text>
        <View style={styles.orderChips}>
          {pago.orderIds.slice(0, 40).map((oid) => (
            <View key={oid} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                …{oid.slice(-8).toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
        {pago.orderIds.length > 40 ? (
          <Text style={styles.moreOrders}>
            + {pago.orderIds.length - 40} órdenes más
          </Text>
        ) : null}
      </View>

      {pago.notas ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Notas</Text>
          <Text style={styles.notes}>{pago.notas}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

function Row(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
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
  hero: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    ...SHADOWS.small,
    marginBottom: SPACING.md,
  },
  heroLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.xs,
  },
  heroAmount: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: FONT_WEIGHT.bold,
  },
  heroBs: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
  heroTip: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
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
  orderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: undefined,
    }),
  },
  moreOrders: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.sm,
  },
  monoLine: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: undefined,
    }),
    marginBottom: 4,
  },
  notes: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
});

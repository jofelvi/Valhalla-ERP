import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api/apiClient';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  SHADOWS,
  BORDER_RADIUS,
} from '../../constants';
import { getBcvRate, usdToBs } from '../../services/bcvRateService';
import {
  cashRegisterService,
  CashRegisterSession,
  PaymentMethodSummary,
  SessionSummary,
} from '../../services/cashRegisterService';
import { useQuery } from '@tanstack/react-query';
import { useResumenDeCaja } from '../../queries/useResumenDeCaja';
import { claves } from '../../queries/claves';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';

import { useVocab } from '../../config/hooks';
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'CashierClose'>;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  PAGO_MOVIL: 'Pago Movil',
  MIXED: 'Mixto',
  PENDING: 'Pendiente',
  // Estos dos faltaban y se veian crudos en el arqueo. En produccion son 387
  // pagos: PAGO_MOVIL_MANUAL 319 y PAYROLL_DEDUCTION 68 (medido 22/09/2026).
  PAGO_MOVIL_MANUAL: 'Pago Movil (manual)',
  PAYROLL_DEDUCTION: 'Descuento de nomina',
  DESCONOCIDO: 'Sin metodo registrado',
};

const formatTime = (date: Date | null): string => {
  if (!date) return '--:--';
  return date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const CashierCloseScreen: React.FC = () => {
  const vocab = useVocab();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { sessionId } = route.params;

  const [isClosing, setIsClosing] = useState(false);

  // ── Los tres datos, cada uno con su clave ──────────────────────────────
  // Antes esto era un solo `loadSummary()` dentro de un useEffect que, para
  // calcular el resumen, hacia `GET /api/payments` SIN filtros: 4.336 pagos y
  // 247.325 bytes para sumar los de una sesion. Ver `useResumenDeCaja`.
  const { data: session = null } = useQuery({
    queryKey: [...claves.caja.todas, 'sesion', sessionId] as const,
    queryFn: async () => {
      const sess = await api.get<{
        id: string;
        userId: string;
        userName: string;
        status: 'open' | 'closed';
        openedAt: string | null;
        closedAt: string | null;
      }>(`/api/cash-register/sessions/${sessionId}`);
      const parsed: CashRegisterSession = {
        id: sess.id,
        userId: sess.userId,
        userName: sess.userName,
        status: sess.status,
        openedAt: sess.openedAt ? new Date(sess.openedAt) : null,
        closedAt: sess.closedAt ? new Date(sess.closedAt) : null,
        summary: null,
      };
      return parsed;
    },
  });

  const { data: bcvRate = 0 } = useQuery({
    queryKey: claves.tasaBcv.actual(),
    queryFn: () => getBcvRate(),
    staleTime: 10 * 60 * 1000,
  });

  const {
    data: resumen,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useResumenDeCaja(sessionId);

  /**
   * El resumen con la forma que espera `closeSession`, que lo PERSISTE.
   *
   * La etiqueta se pone aca y no en el servidor: el idioma es de la pantalla.
   * Los bolivares tambien, porque la tasa ya esta en la mano y el servidor no
   * tiene por que saber a que tasa cerro este cajero.
   */
  const summary = useMemo<SessionSummary | null>(() => {
    if (!resumen) return null;
    const byPaymentMethod: PaymentMethodSummary[] = resumen.byPaymentMethod.map(
      (m) => ({
        method: m.method,
        methodLabel: PAYMENT_METHOD_LABELS[m.method] ?? m.method,
        count: m.count,
        amount: m.amount,
      }),
    );
    return {
      totalOrders: resumen.totalOrders,
      totalAmount: resumen.totalAmount,
      totalAmountBs: usdToBs(resumen.totalAmount, bcvRate),
      byPaymentMethod,
    };
  }, [resumen, bcvRate]);

  const handleConfirmClose = () => {
    showAlert(
      'Cerrar Caja',
      'Esta seguro que desea cerrar la caja? Esta accion no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Caja',
          style: 'destructive',
          onPress: async () => {
            if (!summary) return;
            setIsClosing(true);
            try {
              await cashRegisterService.closeSession(sessionId, summary);
              showAlert(
                'Caja Cerrada',
                'La sesion de caja ha sido cerrada exitosamente.',
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } catch (error) {
              console.error('Error cerrando caja:', error);
              showAlert(
                'Error',
                'No se pudo cerrar la caja. Intenta de nuevo.',
              );
            } finally {
              setIsClosing(false);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Calculando resumen...</Text>
      </View>
    );
  }

  // Antes esto no existia: el `catch` hacia `console.error` y la pantalla
  // quedaba con el resumen en cero, indistinguible de un turno sin ventas. Un
  // cajero cerrando caja con $0,00 por un fallo de red es dinero que se pierde
  // sin que nadie se entere.
  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons
          name="cloud-offline-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.loadingText}>
          No se pudo calcular el resumen. Revisa la conexion antes de cerrar la
          caja.
        </Text>
        <Button
          label="Reintentar"
          variant="secondary"
          size="md"
          loading={isFetching}
          onPress={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Ionicons
            name="lock-closed-outline"
            size={32}
            color={COLORS.warning}
          />
        </View>
        <Text style={styles.headerTitle}>Cerrar Caja</Text>
        <Text style={styles.headerSubtitle}>
          {session?.userName ?? vocab.cashier} &bull;{' '}
          {formatDate(session?.openedAt ?? null)}
        </Text>
        <View style={styles.timeRange}>
          {/* La ventana la decide el servidor y se muestra: antes el filtro por
              `openedAt` ocurria en silencio dentro del telefono y el cajero no
              tenia forma de saber desde cuando se estaba sumando. */}
          <Text style={styles.timeRangeText}>
            {formatTime(resumen ? new Date(resumen.desde) : null)} →{' '}
            {session?.closedAt
              ? formatTime(resumen ? new Date(resumen.hasta) : null)
              : 'Ahora'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.recalcular}
          onPress={() => void refetch()}
          disabled={isFetching}
          accessibilityRole="button"
          accessibilityLabel="Recalcular el resumen"
        >
          <Ionicons
            name="refresh-outline"
            size={14}
            color={COLORS.textSecondary}
          />
          <Text style={styles.recalcularTexto}>
            {isFetching ? 'Recalculando...' : 'Recalcular'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Totals */}
      <View style={styles.totalsCard}>
        <Text style={styles.totalsLabel}>Total Facturado</Text>
        <Text style={styles.totalsUsd}>
          ${(summary?.totalAmount ?? 0).toFixed(2)}
        </Text>
        {bcvRate > 0 && (
          <Text style={styles.totalsBs}>
            Bs. {(summary?.totalAmountBs ?? 0).toFixed(2)}
          </Text>
        )}
        <View style={styles.totalsDivider} />
        <View style={styles.totalsRow}>
          <Text style={styles.totalsRowLabel}>Ordenes procesadas</Text>
          <Text style={styles.totalsRowValue}>{summary?.totalOrders ?? 0}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsRowLabel}>Transacciones</Text>
          <Text style={styles.totalsRowValue}>
            {(summary?.byPaymentMethod ?? []).reduce(
              (sum, m) => sum + m.count,
              0,
            )}
          </Text>
        </View>
      </View>

      {/* Payment breakdown */}
      {(summary?.byPaymentMethod ?? []).length > 0 && (
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Desglose por Metodo de Pago</Text>
          {summary!.byPaymentMethod.map((pm) => (
            <View key={pm.method} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownMethod}>{pm.methodLabel}</Text>
                <Text style={styles.breakdownCount}>
                  {pm.count} pago{pm.count !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.breakdownAmount}>
                  ${pm.amount.toFixed(2)}
                </Text>
                {bcvRate > 0 && (
                  <Text style={styles.breakdownAmountBs}>
                    Bs. {usdToBs(pm.amount, bcvRate).toFixed(2)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Confirm button */}
      <Button
        label="Confirmar Cierre de Caja"
        variant="danger"
        size="lg"
        loading={isClosing}
        disabled={isClosing}
        onPress={handleConfirmClose}
        icon={
          <Ionicons name="lock-closed" size={20} color={COLORS.background} />
        }
        iconPosition="left"
        style={[styles.closeBtnWrapper, isClosing && { opacity: 0.6 }]}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },
  loadingText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },

  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${COLORS.warning}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  recalcular: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  recalcularTexto: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  timeRange: {
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  timeRangeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },

  totalsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  totalsLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  totalsUsd: {
    fontSize: 36,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  totalsBs: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  totalsDivider: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.lg,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: SPACING.xs,
  },
  totalsRowLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  totalsRowValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },

  breakdownCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  breakdownTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  breakdownLeft: {},
  breakdownMethod: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  breakdownCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  breakdownRight: { alignItems: 'flex-end' },
  breakdownAmount: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  breakdownAmountBs: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  closeBtnWrapper: { ...SHADOWS.medium },
});

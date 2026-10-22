import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { orderService } from '../../services';
import { on as onSocket } from '../../services/api/socketClient';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import {
  Order,
  CustomerRequest,
  CustomerRequestType,
  CustomerRequestStatus,
} from '../../types';
import type { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

type Rt = RouteProp<RootStackParamList, 'TableConnect'>;

/**
 * Pantalla del mesonero para "Mesa Conectada":
 *  - Muestra el QR (prefijo ARL1.) que el cliente escanea para vincularse.
 *  - Lista las solicitudes del cliente y permite aceptarlas / rechazarlas.
 */
export const TableConnectScreen: React.FC = () => {
  const route = useRoute<Rt>();
  const { orderId } = route.params;

  const [order, setOrder] = useState<Order | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyReqId, setBusyReqId] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    const fresh = await orderService.getOrderById(orderId);
    setOrder(fresh);
  }, [orderId]);

  const loadToken = useCallback(async () => {
    try {
      const t = await orderService.getLinkToken(orderId);
      setToken(t);
    } catch {
      setToken(null);
    }
  }, [orderId]);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadOrder(), loadToken()]);
      setLoading(false);
    })();
  }, [loadOrder, loadToken]);

  // El cliente pide algo -> order:updated -> refrescamos la lista.
  useEffect(() => {
    let off: (() => void) | undefined;
    void (async () => {
      off = await onSocket<{ id?: string; _id?: string }>(
        'order:updated',
        (raw) => {
          const id = String(raw.id ?? raw._id ?? '');
          if (id === orderId) void loadOrder();
        },
      );
    })();
    return () => off?.();
  }, [orderId, loadOrder]);

  const rotate = useCallback(() => {
    showAlert(
      'Nuevo codigo',
      'El QR anterior dejara de funcionar. ¿Generar uno nuevo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          onPress: async () => {
            try {
              const t = await orderService.rotateLinkToken(orderId);
              setToken(t);
            } catch {
              showAlert('Ups', 'No se pudo generar el codigo.');
            }
          },
        },
      ],
    );
  }, [orderId]);

  const resolve = useCallback(
    async (req: CustomerRequest, action: 'ACCEPT' | 'REJECT' | 'ACK') => {
      if (busyReqId) return;
      setBusyReqId(req.id);
      try {
        const updated = await orderService.resolveCustomerRequest(
          orderId,
          req.id,
          action,
        );
        setOrder(updated);
      } catch {
        showAlert('Ups', 'No se pudo procesar la solicitud.');
      } finally {
        setBusyReqId(null);
      }
    },
    [orderId, busyReqId],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const requests = order?.customerRequests ?? [];
  const pending = requests.filter(
    (r) => r.status === CustomerRequestStatus.PENDING,
  );
  const resolved = requests.filter(
    (r) => r.status !== CustomerRequestStatus.PENDING,
  );
  const linked = Boolean(order?.customerId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* QR */}
      <Card variant="elevated" padding="lg" style={styles.qrCard}>
        <Text style={styles.qrTitle}>Conectar cliente</Text>
        <Text style={styles.qrSubtitle}>
          El cliente escanea este QR desde la app para unirse a la mesa.
        </Text>
        <View style={styles.qrBox}>
          {token ? (
            <QRCode
              value={token}
              size={220}
              backgroundColor="COLORS.text"
              color="COLORS.shadow"
            />
          ) : (
            <Text style={styles.mutedText}>No disponible</Text>
          )}
        </View>
        <View style={styles.linkedRow}>
          <Ionicons
            name={linked ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={linked ? COLORS.success : COLORS.textSecondary}
          />
          <Text style={styles.linkedText}>
            {linked
              ? `Vinculado: ${order?.customerName ?? 'cliente'}`
              : 'Aun sin cliente conectado'}
          </Text>
        </View>
        <Button
          label="Generar nuevo codigo"
          variant="ghost"
          size="sm"
          icon={<Ionicons name="refresh" size={16} color={COLORS.primary} />}
          onPress={rotate}
        />
      </Card>

      {/* Cuenta pedida */}
      {order?.billRequested ? (
        <View style={styles.billBanner}>
          <Ionicons name="receipt" size={18} color={COLORS.background} />
          <Text style={styles.billText}>El cliente pidio la cuenta</Text>
        </View>
      ) : null}

      {/* Solicitudes pendientes */}
      <Text style={styles.sectionTitle}>
        Solicitudes {pending.length > 0 ? `(${pending.length})` : ''}
      </Text>
      {pending.length === 0 ? (
        <Text style={styles.mutedText}>No hay solicitudes pendientes.</Text>
      ) : (
        pending.map((r) => (
          <Card
            key={r.id}
            variant="outlined"
            padding="md"
            style={styles.reqCard}
          >
            <View style={styles.reqHeader}>
              <Ionicons
                name={reqIcon(r.type)}
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.reqTitle}>{reqTitle(r)}</Text>
            </View>
            {r.note ? <Text style={styles.reqNote}>{r.note}</Text> : null}
            <View style={styles.reqActions}>
              {r.type === CustomerRequestType.PRODUCT ? (
                <>
                  <Button
                    label="Rechazar"
                    variant="danger"
                    size="sm"
                    onPress={() => resolve(r, 'REJECT')}
                    disabled={busyReqId === r.id}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Aceptar y agregar"
                    variant="primary"
                    size="sm"
                    onPress={() => resolve(r, 'ACCEPT')}
                    disabled={busyReqId === r.id}
                    loading={busyReqId === r.id}
                    style={{ flex: 1 }}
                  />
                </>
              ) : (
                <Button
                  label="Marcar atendida"
                  variant="primary"
                  size="sm"
                  onPress={() => resolve(r, 'ACK')}
                  disabled={busyReqId === r.id}
                  loading={busyReqId === r.id}
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </Card>
        ))
      )}

      {/* Historial */}
      {resolved.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Historial</Text>
          {resolved.map((r) => (
            <View key={r.id} style={styles.resolvedRow}>
              <Ionicons
                name={reqIcon(r.type)}
                size={16}
                color={COLORS.textSecondary}
              />
              <Text style={styles.resolvedText} numberOfLines={1}>
                {reqTitle(r)}
              </Text>
              <Text
                style={[
                  styles.resolvedStatus,
                  { color: statusColor(r.status) },
                ]}
              >
                {statusLabel(r.status)}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

function reqIcon(type: CustomerRequestType): keyof typeof Ionicons.glyphMap {
  if (type === CustomerRequestType.PRODUCT) return 'fast-food-outline';
  if (type === CustomerRequestType.CALL_WAITER) return 'hand-left-outline';
  return 'chatbox-ellipses-outline';
}

function reqTitle(r: CustomerRequest): string {
  if (r.type === CustomerRequestType.PRODUCT) {
    return `${r.quantity ?? 1}x ${r.productName ?? 'producto'}`;
  }
  if (r.type === CustomerRequestType.CALL_WAITER) return 'El cliente te llama';
  return r.note ?? 'Solicitud';
}

function statusLabel(status: CustomerRequestStatus): string {
  switch (status) {
    case CustomerRequestStatus.ACCEPTED:
      return 'Aceptada';
    case CustomerRequestStatus.REJECTED:
      return 'Rechazada';
    case CustomerRequestStatus.ACK:
      return 'Atendida';
    default:
      return 'En espera';
  }
}

function statusColor(status: CustomerRequestStatus): string {
  switch (status) {
    case CustomerRequestStatus.ACCEPTED:
      return COLORS.success;
    case CustomerRequestStatus.REJECTED:
      return COLORS.error;
    default:
      return COLORS.textSecondary;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.sm,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  qrCard: {
    alignItems: 'center',
  },
  qrTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  qrSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
  },
  qrBox: {
    backgroundColor: COLORS.text,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginVertical: SPACING.sm,
    minWidth: 244,
    minHeight: 244,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  linkedText: { color: COLORS.text, fontSize: FONT_SIZE.sm },
  billBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.warning,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  billText: { color: COLORS.background, fontWeight: FONT_WEIGHT.bold },
  sectionTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.md,
  },
  mutedText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  reqCard: {
    gap: SPACING.sm,
  },
  reqHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  reqTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    flex: 1,
  },
  reqNote: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  reqActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'flex-end',
  },
  resolvedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  resolvedText: {
    color: COLORS.textSecondary,
    flex: 1,
    fontSize: FONT_SIZE.sm,
  },
  resolvedStatus: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
});

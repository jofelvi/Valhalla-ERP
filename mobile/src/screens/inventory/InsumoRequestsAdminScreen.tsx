import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import {
  inventoryService,
  InsumoRequest,
} from '../../services/inventoryService';
import { showAlert } from '../../utils/alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const STATION_LABEL: Record<string, string> = {
  BAR: 'Barra',
  KITCHEN: 'Cocina',
  PIZZA: 'Pizza',
};

export const InsumoRequestsAdminScreen: React.FC = () => {
  const [requests, setRequests] = useState<InsumoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await inventoryService.listInsumoRequests('PENDING'));
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = useCallback((req: InsumoRequest) => {
    showAlert(
      'Aprobar solicitud',
      `Se transferirá el stock del depósito a ${STATION_LABEL[req.station] ?? req.station}. ¿Confirmar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            setBusyId(req._id);
            try {
              await inventoryService.approveInsumoRequest(req._id);
              setRequests((prev) => prev.filter((r) => r._id !== req._id));
            } catch (e) {
              showAlert(
                'Error',
                e instanceof Error ? e.message : 'No se pudo aprobar',
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }, []);

  const reject = useCallback((req: InsumoRequest) => {
    showAlert('Rechazar solicitud', '¿Rechazar esta solicitud?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rechazar',
        style: 'destructive',
        onPress: async () => {
          setBusyId(req._id);
          try {
            await inventoryService.rejectInsumoRequest(req._id);
            setRequests((prev) => prev.filter((r) => r._id !== req._id));
          } catch (e) {
            showAlert(
              'Error',
              e instanceof Error ? e.message : 'No se pudo rechazar',
            );
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={load}
          tintColor={COLORS.primary}
        />
      }
    >
      {requests.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
          <Text style={styles.emptyText}>No hay solicitudes pendientes.</Text>
        </View>
      ) : (
        requests.map((req) => (
          <Card
            key={req._id}
            variant="elevated"
            padding="lg"
            style={styles.card}
          >
            <View style={styles.cardHead}>
              <Text style={styles.station}>
                {STATION_LABEL[req.station] ?? req.station}
              </Text>
              <Text style={styles.meta}>
                {req.requestedByName ?? 'Estación'}
                {req.createdAt
                  ? `  ·  ${new Date(req.createdAt).toLocaleTimeString(
                      'es-VE',
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}`
                  : ''}
              </Text>
            </View>

            {req.items.map((it) => (
              <View key={it.productId} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {it.productName}
                </Text>
                <Text style={styles.itemQty}>
                  {it.qty} {it.unit}
                </Text>
              </View>
            ))}

            {req.note ? <Text style={styles.note}>"{req.note}"</Text> : null}

            <View style={styles.actions}>
              <Button
                label="Rechazar"
                variant="secondary"
                size="sm"
                onPress={() => reject(req)}
                disabled={busyId === req._id}
                style={{ flex: 1 }}
              />
              <Button
                label="Aprobar y transferir"
                variant="primary"
                size="sm"
                onPress={() => approve(req)}
                disabled={busyId === req._id}
                loading={busyId === req._id}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, gap: SPACING.md },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  card: {
    gap: SPACING.sm,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  station: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  meta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}40`,
  },
  itemName: { color: COLORS.text, fontSize: FONT_SIZE.md, flex: 1 },
  itemQty: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  note: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
});

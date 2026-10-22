import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme';
import { kitchenInventoryService } from '../../services/kitchenInventoryService';
import {
  KitchenStockItem,
  KitchenLiveStock,
  KitchenSession,
} from '../../types/models';
import { useAuthStore } from '../../store/authStore';
import { showAlert } from '../../utils/alert';

type ViewMode = 'loading' | 'no-session' | 'live' | 'close';

export const KitchenInventoryScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [products, setProducts] = useState<KitchenStockItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [liveStock, setLiveStock] = useState<KitchenLiveStock | null>(null);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [prods, session] = await Promise.all([
        kitchenInventoryService.getInventoryProducts(),
        kitchenInventoryService.getActiveSession(),
      ]);
      setProducts(prods);
      if (session) {
        const live = await kitchenInventoryService.getLiveStock();
        setLiveStock(live);
        const counts: Record<string, string> = {};
        for (const item of live.stock) {
          counts[item.productId] = String(Math.max(0, item.remaining));
        }
        setPhysicalCounts(counts);
        setViewMode('live');
      } else {
        const initial: Record<string, string> = {};
        prods.forEach((p) => {
          initial[p.productId] = '0';
        });
        setQuantities(initial);
        setViewMode('no-session');
      }
    } catch (err: unknown) {
      setViewMode('no-session');
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpen = async () => {
    const initialStock: KitchenStockItem[] = products
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        quantity: parseFloat(quantities[p.productId] ?? '0') || 0,
        unit: p.unit,
      }))
      .filter((i) => (i.quantity ?? 0) > 0);

    if (initialStock.length === 0) {
      showAlert('Error', 'Ingresa al menos un insumo con cantidad mayor a 0');
      return;
    }

    setLoading(true);
    try {
      await kitchenInventoryService.openSession(initialStock);
      await loadData();
    } catch (err: unknown) {
      showAlert(
        'Error',
        (err as Error).message ?? 'No se pudo abrir la sesión',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    const physicalCount =
      liveStock?.stock.map((item) => ({
        productId: item.productId,
        quantity: parseFloat(physicalCounts[item.productId] ?? '0') || 0,
      })) ?? [];

    const userId = user?.id ?? 'system';

    setLoading(true);
    try {
      const closed = await kitchenInventoryService.closeSession(
        userId,
        physicalCount,
      );
      const merma = (closed.waste ?? []).filter((w) => w.difference > 0);
      if (merma.length > 0) {
        showAlert(
          'Turno cerrado',
          `Merma detectada:\n${merma
            .map((w) => `${w.productName}: ${w.difference} und`)
            .join('\n')}`,
        );
      } else {
        showAlert('Turno cerrado', 'Sin merma detectada. ¡Buen trabajo!');
      }
      await loadData();
    } catch (err: unknown) {
      showAlert('Error', (err as Error).message ?? 'No se pudo cerrar');
    } finally {
      setLoading(false);
    }
  };

  if (viewMode === 'loading') {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (viewMode === 'no-session') {
    return (
      <ScrollView
        style={s.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadData();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={s.header}>
          <Text style={s.title}>Almacén · Iniciar servicio</Text>
          <Text style={s.subtitle}>Indica cuánto vas a usar hoy</Text>
        </View>
        {products.length === 0 && (
          <Text style={s.emptyText}>
            No hay insumos configurados. Pide al admin que marque productos como
            insumos.
          </Text>
        )}
        {products.map((p) => (
          <View key={p.productId} style={s.row}>
            <Text style={s.rowName}>{p.productName}</Text>
            <View style={s.rowRight}>
              <Text style={s.rowUnit}>{p.unit}</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                value={quantities[p.productId] ?? '0'}
                onChangeText={(v) =>
                  setQuantities((prev) => ({ ...prev, [p.productId]: v }))
                }
              />
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={[s.btn, s.btnPrimary, loading && s.btnDisabled]}
          onPress={handleOpen}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={s.btnText}>ABRIR SERVICIO</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (viewMode === 'live') {
    return (
      <ScrollView
        style={s.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              const live = await kitchenInventoryService.getLiveStock();
              setLiveStock(live);
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={s.header}>
          <Text style={s.title}>EN SERVICIO</Text>
          <Text style={s.subtitle}>Desliza hacia abajo para actualizar</Text>
        </View>
        {liveStock?.stock.map((item) => {
          const isLow = item.remaining < 5;
          return (
            <View
              key={item.productId}
              style={[s.liveRow, isLow && s.liveRowLow]}
            >
              <View style={s.liveLeft}>
                <Text style={s.rowName}>{item.productName}</Text>
                <Text style={s.liveDetail}>
                  Inicial {item.initial} · Consumido {item.consumed.toFixed(1)}
                </Text>
                {isLow && (
                  <View style={s.alertBadge}>
                    <Text style={s.alertText}>QUEDAN MENOS DE 5</Text>
                  </View>
                )}
              </View>
              <Text style={[s.liveQty, isLow && s.liveQtyLow]}>
                {Math.max(0, item.remaining)}
              </Text>
            </View>
          );
        })}
        <TouchableOpacity
          style={[s.btn, s.btnPurple, loading && s.btnDisabled]}
          onPress={() => setViewMode('close')}
          disabled={loading}
        >
          <Text style={s.btnTextWhite}>CERRAR TURNO</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // viewMode === 'close'
  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Cierre de turno</Text>
        <Text style={s.subtitle}>Ingresa el conteo físico real</Text>
      </View>
      <View style={s.tableHeader}>
        <Text style={[s.tableCol, { flex: 2 }]}>Insumo</Text>
        <Text style={s.tableCol}>Sistema</Text>
        <Text style={s.tableCol}>Conteo</Text>
      </View>
      {liveStock?.stock.map((item) => (
        <View key={item.productId} style={s.tableRow}>
          <Text style={[s.rowName, { flex: 2 }]}>{item.productName}</Text>
          <Text style={[s.tableCol, { color: COLORS.textSecondary }]}>
            {Math.max(0, item.remaining)}
          </Text>
          <TextInput
            style={[s.input, { flex: 1 }]}
            keyboardType="numeric"
            value={physicalCounts[item.productId] ?? '0'}
            onChangeText={(v) =>
              setPhysicalCounts((prev) => ({ ...prev, [item.productId]: v }))
            }
          />
        </View>
      ))}
      <TouchableOpacity
        style={[s.btn, s.btnPurple, loading && s.btnDisabled]}
        onPress={handleClose}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.btnTextWhite}>CERRAR Y GUARDAR</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.btn, { backgroundColor: 'transparent', marginTop: 4 }]}
        onPress={() => setViewMode('live')}
      >
        <Text
          style={{
            color: COLORS.textSecondary,
            textAlign: 'center',
            fontSize: FONT_SIZE.sm,
          }}
        >
          Volver al servicio
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.xl,
    fontSize: FONT_SIZE.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: 6,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    flex: 1,
  },
  rowUnit: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 6,
    color: COLORS.primary,
    fontWeight: '700',
    padding: 4,
    minWidth: 52,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
  },
  btn: {
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  btnPurple: {
    backgroundColor: COLORS.info,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  btnTextWhite: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  liveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  liveRowLow: {
    borderColor: COLORS.error,
  },
  liveLeft: {
    flex: 1,
  },
  liveDetail: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  liveQty: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.success,
    minWidth: 40,
    textAlign: 'right',
  },
  liveQtyLow: {
    color: COLORS.error,
  },
  alertBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  alertText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tableHeader: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  tableCol: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: 6,
    gap: 8,
  },
});

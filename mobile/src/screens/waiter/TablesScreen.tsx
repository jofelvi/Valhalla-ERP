import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Animated,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import { tableService, orderService } from '../../services';
import {
  Table,
  TableStatusEnum,
  UserRoleEnum,
  ZoneSectorEnum,
} from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { SalonPlano, BottomSheetMesa, TransferModal } from '../../components';
import { useAuthStore, useWaiterOrderStore } from '../../store';
import { showAlert } from '../../utils/alert';

import { useVocab } from '../../config/hooks';
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface StatusStat {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
}

interface TableOrderInfo {
  waiterName: string;
  waiterId: string;
  customerAlias?: string | null;
  createdAt?: Date | null;
  orderId: string;
}

export const TablesScreen: React.FC = () => {
  const vocab = useVocab();
  const navigation = useNavigation<NavigationProp>();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const customer = useAuthStore((s) => s.customer);
  const isCashier = role === UserRoleEnum.CASHIER;
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transferSource, setTransferSource] = useState<{
    id: string;
    tableId?: string | null;
    tableName?: string | null;
    sector?: ZoneSectorEnum | null;
  } | null>(null);
  const [waiterMap, setWaiterMap] = useState<Record<string, TableOrderInfo>>(
    {},
  );
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  // Ref espejo para leer el cache dentro del effect sin meterlo como
  // dependency (evita re-runs cuando setWaiterMap actualiza).
  const waiterMapRef = useRef<Record<string, TableOrderInfo>>({});
  useEffect(() => {
    waiterMapRef.current = waiterMap;
  }, [waiterMap]);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Mantener la ultima snapshot para poder refrescar sin desmontar
  const refreshTablesRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const unsubscribe = tableService.subscribeToTables((updatedTables) => {
      setTables(updatedTables);
      setIsLoading(false);
      setIsRefreshing(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });

    refreshTablesRef.current = async () => {
      try {
        const fresh = await tableService.getAllTables();
        setTables(fresh);
      } catch (err) {
        console.error('[TablesScreen] refresh error', err);
      }
    };

    return () => unsubscribe();
  }, []);

  // Android suspende sockets con pantalla bloqueada: socket.connected puede
  // decir true pero no recibir eventos. Al volver al foreground forzamos
  // re-fetch HTTP para sincronizar el estado sin depender del socket.
  useEffect(() => {
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void refreshTablesRef.current();
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  // Tambien refetch al volver al tab Mesas desde otra pantalla (Menu, Perfil, etc.)
  useFocusEffect(
    useCallback(() => {
      void refreshTablesRef.current();
    }, []),
  );

  // Cargar nombres de mesoneros para mesas ocupadas.
  // Cachea por orderId — el WS de POS emite tables muy seguido, sin este
  // cache haciamos N GETs por evento (loop infinito que disparaba 429 nginx).
  const occupiedKey = useMemo(
    () =>
      tables
        .filter((t) => t.status === TableStatusEnum.OCCUPIED && t.orderId)
        .map((t) => `${t.id}:${t.orderId}`)
        .sort()
        .join('|'),
    [tables],
  );

  useEffect(() => {
    const occupied = tables.filter(
      (t) => t.status === TableStatusEnum.OCCUPIED && t.orderId,
    );

    // Limpiar entradas cuyas mesas ya no estan ocupadas
    setWaiterMap((prev) => {
      const validIds = new Set(occupied.map((t) => t.id));
      const next: Record<string, TableOrderInfo> = {};
      for (const [tableId, info] of Object.entries(prev)) {
        if (validIds.has(tableId)) next[tableId] = info;
      }
      return next;
    });

    // Solo fetch los orderIds que NO estan ya cacheados (o cuyo orderId cambio)
    const toFetch = occupied.filter(
      (t) => !t.orderId || waiterMapRef.current[t.id]?.orderId !== t.orderId,
    );
    if (toFetch.length === 0) return;

    let cancelled = false;
    const fetchWaiters = async () => {
      const updates: Record<string, TableOrderInfo> = {};
      for (const table of toFetch) {
        if (!table.orderId) continue;
        try {
          const order = await orderService.getOrderById(table.orderId);
          if (order) {
            updates[table.id] = {
              waiterName: order.waiterName ?? '',
              waiterId: order.waiterId ?? order.userId ?? '',
              customerAlias: order.customerAlias ?? null,
              createdAt: order.createdAt ?? null,
              orderId: table.orderId,
            };
          }
        } catch {
          // Silenciar error individual
        }
      }
      if (cancelled) return;
      setWaiterMap((prev) => ({ ...prev, ...updates }));
    };
    void fetchWaiters();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occupiedKey]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    tableService.getAllTables().then((data) => {
      setTables(data);
      setIsRefreshing(false);
    });
  }, []);

  const performClaimAndNavigate = async (
    table: Table,
    userId: string,
    waiterName: string,
  ) => {
    try {
      await tableService.claimTable(table.id, userId, waiterName);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo tomar la mesa.';
      showAlert(`${vocab.table} no disponible`, msg);
      void refreshTablesRef.current();
      return;
    }

    if (isCashier) {
      navigation.navigate('CashierCreateOrder', {
        tableId: table.id,
        tableName: table.name,
      });
    } else {
      navigation.navigate('WaiterCreateOrder', {
        tableId: table.id,
        tableName: table.name,
      });
    }
  };

  const handleTablePress = (table: Table) => {
    // Mostrar el bottom sheet con opciones
    setSelectedTable(table);
    setShowBottomSheet(true);
  };

  const handleBottomSheetAgregar = async (table: Table) => {
    // Mesa con orden activa: ir al detalle en lugar de agregar.
    if (table.status === TableStatusEnum.OCCUPIED && table.orderId) {
      navigation.navigate('OrderDetail', { orderId: table.orderId });
      return;
    }

    const userId = user?.uid ?? customer?.id;
    if (!userId) {
      showAlert('Error', 'No se pudo identificar tu usuario.');
      return;
    }
    const waiterName = customer?.name ?? vocab.waiter;

    // Mesa OCCUPIED pero sin orden (solo claim): si es MIA, permitir
    // continuar el armado de pedido. Si es de otro, informar.
    if (
      table.status === TableStatusEnum.OCCUPIED &&
      !table.orderId &&
      table.claimedBy
    ) {
      if (table.claimedBy === userId) {
        if (isCashier) {
          navigation.navigate('CashierCreateOrder', {
            tableId: table.id,
            tableName: table.name,
          });
        } else {
          navigation.navigate('WaiterCreateOrder', {
            tableId: table.id,
            tableName: table.name,
          });
        }
        return;
      }
      showAlert(
        `${vocab.table} en uso`,
        `${table.claimedByName ?? 'Otro mesonero'} esta armando un pedido en esta mesa.`,
      );
      return;
    }

    if (
      table.status !== TableStatusEnum.ISAVAILABLE &&
      table.status !== TableStatusEnum.OCCUPIED
    ) {
      return;
    }

    // Proteccion contra perder productos en curso: si el mesonero ya esta
    // armando un pedido en OTRA mesa (carrito con items + tableId distinto),
    // no liberamos automaticamente — preguntamos.
    const store = useWaiterOrderStore.getState();
    const hasInProgress =
      store.items.length > 0 && !!store.tableId && store.tableId !== table.id;

    if (hasInProgress) {
      const prevTableId = store.tableId;
      const prevTableName = store.tableName || 'mesa anterior';
      showAlert(
        'Pedido en progreso',
        `Tienes productos pendientes en ${prevTableName}. ¿Que deseas hacer?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: `Volver a ${prevTableName}`,
            onPress: () => {
              if (isCashier) {
                navigation.navigate('CashierCreateOrder', {
                  tableId: prevTableId,
                  tableName: store.tableName,
                });
              } else {
                navigation.navigate('WaiterCreateOrder', {
                  tableId: prevTableId,
                  tableName: store.tableName,
                });
              }
            },
          },
          {
            text: 'Descartar y cambiar',
            style: 'destructive',
            onPress: async () => {
              await tableService.releaseTable(prevTableId, userId);
              store.clearOrder();
              await performClaimAndNavigate(table, userId, waiterName);
            },
          },
        ],
      );
      return;
    }

    await performClaimAndNavigate(table, userId, waiterName);
  };

  const handleBottomSheetCobrar = (table: Table) => {
    if (table.status !== TableStatusEnum.OCCUPIED || !table.orderId) {
      showAlert('Error', 'Esta mesa no tiene una orden activa.');
      return;
    }
    navigation.navigate('OrderDetail', { orderId: table.orderId });
  };

  const handleTableLongPress = async (table: Table) => {
    if (table.status !== TableStatusEnum.OCCUPIED || !table.orderId) return;
    const order = await orderService.getOrderById(table.orderId);
    if (!order) return;
    setTransferSource({
      id: order.id,
      tableId: table.id,
      tableName: table.name,
      sector: order.sector,
    });
  };

  const stats: StatusStat[] = [
    {
      label: 'Disponibles',
      color: COLORS.success,
      icon: 'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap,
      count: tables.filter((t) => t.status === TableStatusEnum.ISAVAILABLE)
        .length,
    },
    {
      label: 'Ocupadas',
      color: COLORS.error,
      icon: 'people-outline' as keyof typeof Ionicons.glyphMap,
      count: tables.filter((t) => t.status === TableStatusEnum.OCCUPIED).length,
    },
    {
      label: 'Reservadas',
      color: COLORS.info,
      icon: 'bookmark-outline' as keyof typeof Ionicons.glyphMap,
      count: tables.filter((t) => t.status === TableStatusEnum.RESERVED).length,
    },
    {
      label: 'En limpieza',
      color: COLORS.textSecondary,
      icon: 'sparkles-outline' as keyof typeof Ionicons.glyphMap,
      count: tables.filter((t) => t.status === TableStatusEnum.CLEANING).length,
    },
  ].filter((s) => s.count > 0);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="grid-outline" size={36} color={COLORS.primary} />
        </View>
        <Text style={styles.loadingText}>Cargando mesas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingIcon}>
              <Ionicons name="grid-outline" size={36} color={COLORS.brand} />
            </View>
            <Text style={styles.loadingText}>Cargando mesas...</Text>
          </View>
        ) : (
          <FlatList
            data={[{ type: 'content' }]} // Dummy array para usar FlatList structure
            keyExtractor={() => 'content'}
            renderItem={() => null}
            ListHeaderComponent={
              <View>
                <View style={styles.header}>
                  <View>
                    <Text style={styles.title}>Salón Principal</Text>
                    <Text style={styles.subtitle}>
                      {tables.length} mesa{tables.length !== 1 ? 's' : ''} en
                      total
                    </Text>
                  </View>
                </View>

                {/* Stats chips */}
                {stats.length > 0 && (
                  <View style={styles.statsRow}>
                    {stats.map((stat) => (
                      <View
                        key={stat.label}
                        style={[
                          styles.statChip,
                          { borderColor: `${stat.color}40` },
                        ]}
                      >
                        <Ionicons
                          name={stat.icon}
                          size={14}
                          color={stat.color}
                        />
                        <Text style={[styles.statCount, { color: stat.color }]}>
                          {stat.count}
                        </Text>
                        <Text style={styles.statLabel}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Plano del salón */}
                <View style={styles.planoContainer}>
                  <SalonPlano
                    tables={tables}
                    onTablePress={handleTablePress}
                    waiterMap={waiterMap}
                  />
                </View>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.brand}
                colors={[COLORS.brand]}
              />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons
                      name="grid-outline"
                      size={48}
                      color={`${COLORS.brand}60`}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>Sin mesas configuradas</Text>
                  <Text style={styles.emptyText}>
                    Contacta al administrador para agregar mesas
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </Animated.View>

      {/* Bottom Sheet para mesa seleccionada */}
      <BottomSheetMesa
        visible={showBottomSheet}
        table={selectedTable}
        onClose={() => {
          setShowBottomSheet(false);
          setSelectedTable(null);
        }}
        onAgregar={handleBottomSheetAgregar}
        onCobrar={handleBottomSheetCobrar}
        onPasar={
          selectedTable ? () => handleTableLongPress(selectedTable) : undefined
        }
        waiterName={
          selectedTable ? waiterMap[selectedTable.id]?.waiterName : undefined
        }
        customerAlias={
          selectedTable ? waiterMap[selectedTable.id]?.customerAlias : undefined
        }
      />

      {transferSource && (
        <TransferModal
          visible={!!transferSource}
          onClose={() => setTransferSource(null)}
          sourceOrder={transferSource}
          onTransferComplete={() => setTransferSource(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.page,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.content,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.dim,
    marginTop: SPACING.xs,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  statCount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.dim,
  },
  planoContainer: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: 'hidden',
  },
  listContent: {
    paddingBottom: 100,
  },
  // ---- Loading / Empty ----
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.page,
    gap: SPACING.lg,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.brand}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.dim,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.brand}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.content,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.dim,
    textAlign: 'center',
  },
});

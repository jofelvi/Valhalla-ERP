import { PROPINA_HABILITADA } from '../../config/funciones';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import { orderService, printQueueService } from '../../services';
import { getBcvRate, usdToBs } from '../../services/bcvRateService';
import { Order, OrderStatusEnum, PaymentStatusEnum } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store';
import { TransferToWaiterModal } from '../../components';
import { Button } from '../../components/ui';
import { showAlert } from '../../utils/alert';
import {
  getOrderStatusColor,
  getOrderStatusIcon,
  getOrderStatusLabel,
} from '../../utils/orderStatusHelpers';
import { formatearUsd, formatearBs } from '../../utils/dinero';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const WaiterOrdersScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [incomingTransfers, setIncomingTransfers] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [selectedOrderForTransfer, setSelectedOrderForTransfer] =
    useState<Order | null>(null);
  const [isIncomingTransfersExpanded, setIsIncomingTransfersExpanded] =
    useState(true);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const data = await orderService.getWaiterOrders(user.uid);
      setOrders(data);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
    getBcvRate().then(setBcvRate);
  }, [loadOrders]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = orderService.subscribeToWaiterActiveOrders(
      user.uid,
      (activeOrders) => {
        setOrders(
          activeOrders.sort((a, b) => {
            const dateA = a.createdAt?.getTime() ?? 0;
            const dateB = b.createdAt?.getTime() ?? 0;
            return dateB - dateA;
          }),
        );
      },
    );
    return () => unsubscribe();
  }, [user]);

  // Cargar solicitudes de traspaso recibidas cuando la pantalla está enfocada
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void (async () => {
        try {
          const incoming = await orderService.getIncomingTransferRequests(
            user.uid,
          );
          setIncomingTransfers(
            incoming.filter(
              (o) =>
                o.transferRequest?.status === 'REQUESTED' &&
                o.transferRequest?.toWaiterId === user.uid,
            ),
          );
        } catch (err) {
          console.error('Error cargando traspasos recibidos:', err);
        }
      })();
    }, [user]),
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadOrders();
  }, [loadOrders]);

  const canCollect = (order: Order): boolean => {
    return (
      order.status !== OrderStatusEnum.CANCELLED &&
      order.status !== OrderStatusEnum.PAID &&
      order.status !== OrderStatusEnum.CREDIT &&
      order.paymentStatus !== PaymentStatusEnum.PENDING_VERIFICATION &&
      (!!order.tableId || !!order.sector)
    );
  };

  const canTransfer = (order: Order): boolean => {
    return (
      order.status !== OrderStatusEnum.CANCELLED &&
      order.status !== OrderStatusEnum.PAID &&
      order.status !== OrderStatusEnum.CREDIT &&
      (!order.transferRequest ||
        order.transferRequest.status !== 'REQUESTED') &&
      // Se compara la LONGITUD, no el array. El backend crea toda orden con
      // waiterShares: [] por default y `![]` es false en JS, asi que con
      // `!order.waiterShares` la condicion fallaba SIEMPRE y el boton de ceder
      // mesa nunca se dibujaba (0 traspasos desde que se publico el 16-jul).
      !order.waiterShares?.length
    );
  };

  const handleOrderPress = (order: Order) => {
    navigation.navigate('OrderDetail', { orderId: order.id });
  };

  const handleCollect = (order: Order) => {
    navigation.navigate('WaiterPayment', {
      orderId: order.id,
      tableId: order.tableId ?? undefined,
    });
  };

  const handleChat = (orderId: string) => {
    navigation.navigate('Chat', { orderId });
  };

  const handlePrecuenta = async (order: Order) => {
    setPrintingOrderId(order.id);
    try {
      await printQueueService.enqueuePrintPrecuenta(order, {
        bcvRate,
        waiterName: user?.name ?? undefined,
      });
    } finally {
      setPrintingOrderId(null);
    }
  };

  const handleOpenTransferModal = (order: Order) => {
    if (!canTransfer(order)) {
      showAlert('No disponible', 'Esta orden no puede ser cedida');
      return;
    }
    setSelectedOrderForTransfer(order);
    setTransferModalVisible(true);
  };

  const handleTransferStart = () => {
    setIsTransferring(true);
  };

  const handleTransferComplete = async (
    toWaiterId: string,
    toWaiterName: string,
    fromPct: number,
    toPct: number,
  ) => {
    if (!selectedOrderForTransfer) return;

    try {
      await orderService.createTransferRequest(
        selectedOrderForTransfer.id,
        toWaiterId,
        toWaiterName,
        fromPct,
        toPct,
      );
      showAlert('Éxito', `Solicitud de traspaso enviada a ${toWaiterName}`);
      setSelectedOrderForTransfer(null);
    } catch (err) {
      console.error('Error creando solicitud de traspaso:', err);
      const errorMsg =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message || 'Error al crear solicitud de traspaso';
      showAlert('Error', errorMsg);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCancelTransferRequest = (order: Order) => {
    if (
      !order.transferRequest ||
      order.transferRequest.status !== 'REQUESTED'
    ) {
      showAlert(
        'Error',
        'Esta orden no tiene una solicitud de traspaso pendiente',
      );
      return;
    }

    showAlert(
      'Cancelar traspaso',
      `¿Cancelar el traspaso a ${order.transferRequest.toWaiterName}?`,
      [
        { text: 'No', onPress: () => {} },
        {
          text: 'Sí, cancelar',
          onPress: async () => {
            try {
              await orderService.cancelTransferRequest(order.id);
              showAlert('Éxito', 'Solicitud de traspaso cancelada');
            } catch (err) {
              console.error('Error cancelando traspaso:', err);
              showAlert('Error', 'No se pudo cancelar la solicitud');
            }
          },
        },
      ],
    );
  };

  const handleAcceptTransferRequest = async (order: Order) => {
    if (
      !order.transferRequest ||
      order.transferRequest.status !== 'REQUESTED'
    ) {
      showAlert('Error', 'Esta orden no tiene una solicitud válida');
      return;
    }

    showAlert(
      'Aceptar traspaso',
      `¿Aceptar este pedido de ${order.transferRequest.fromWaiterName}? Tu parte será ${order.transferRequest.toPct}% de ${PROPINA_HABILITADA ? 'propina y ' : ''}comisión.`,
      [
        { text: 'No', onPress: () => {} },
        {
          text: 'Sí, aceptar',
          onPress: async () => {
            try {
              await orderService.acceptTransferRequest(order.id);
              showAlert('Éxito', 'Pedido traspasado correctamente');
              // Refetch incoming transfers
              if (user) {
                const incoming = await orderService.getIncomingTransferRequests(
                  user.uid,
                );
                setIncomingTransfers(
                  incoming.filter(
                    (o) =>
                      o.transferRequest?.status === 'REQUESTED' &&
                      o.transferRequest?.toWaiterId === user.uid,
                  ),
                );
              }
            } catch (err) {
              console.error('Error aceptando traspaso:', err);
              showAlert('Error', 'No se pudo aceptar el traspaso');
            }
          },
        },
      ],
    );
  };

  const handleRejectTransferRequest = async (order: Order) => {
    if (
      !order.transferRequest ||
      order.transferRequest.status !== 'REQUESTED'
    ) {
      showAlert('Error', 'Esta orden no tiene una solicitud válida');
      return;
    }

    showAlert(
      'Rechazar traspaso',
      `¿Rechazar este pedido de ${order.transferRequest.fromWaiterName}?`,
      [
        { text: 'No', onPress: () => {} },
        {
          text: 'Sí, rechazar',
          onPress: async () => {
            try {
              await orderService.rejectTransferRequest(order.id);
              showAlert('Éxito', 'Solicitud rechazada');
              // Refetch incoming transfers
              if (user) {
                const incoming = await orderService.getIncomingTransferRequests(
                  user.uid,
                );
                setIncomingTransfers(
                  incoming.filter(
                    (o) =>
                      o.transferRequest?.status === 'REQUESTED' &&
                      o.transferRequest?.toWaiterId === user.uid,
                  ),
                );
              }
            } catch (err) {
              console.error('Error rechazando traspaso:', err);
              showAlert('Error', 'No se pudo rechazar el traspaso');
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="receipt-outline" size={36} color={COLORS.primary} />
        </View>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: SPACING.lg }}
        />
        <Text style={styles.loadingText}>Cargando pedidos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sección de solicitudes de traspaso recibidas */}
      {incomingTransfers.length > 0 && (
        <View style={styles.incomingTransfersSection}>
          <TouchableOpacity
            style={styles.incomingTransfersHeader}
            onPress={() =>
              setIsIncomingTransfersExpanded(!isIncomingTransfersExpanded)
            }
            activeOpacity={0.7}
          >
            <View style={styles.incomingTransfersHeaderLeft}>
              <Ionicons
                name="swap-horizontal"
                size={16}
                color={COLORS.primary}
              />
              <Text style={styles.incomingTransfersTitle}>
                Solicitudes de traspaso ({incomingTransfers.length})
              </Text>
            </View>
            <Ionicons
              name={isIncomingTransfersExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          {isIncomingTransfersExpanded && (
            <View style={styles.incomingTransfersList}>
              {incomingTransfers.map((order) => (
                <View key={order.id} style={styles.transferRequestCard}>
                  <View style={styles.transferRequestHeader}>
                    <View style={styles.transferRequestInfo}>
                      <Text style={styles.transferRequestFromWaiter}>
                        {order.transferRequest?.fromWaiterName ?? 'Desconocido'}{' '}
                        te cede
                      </Text>
                      <Text style={styles.transferRequestLocation}>
                        {order.tableName || order.sector || 'Pedido'}
                      </Text>
                    </View>
                    <View style={styles.transferRequestPct}>
                      <Text style={styles.transferRequestPctLabel}>
                        Tu parte
                      </Text>
                      <Text style={styles.transferRequestPctValue}>
                        {order.transferRequest?.toPct ?? 0}%
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.transferRequestTotal}>
                    Total: {formatearUsd(order.total)}
                  </Text>

                  <Text style={styles.transferRequestTime}>
                    {order.createdAt?.toLocaleTimeString('es-VE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>

                  <View style={styles.transferRequestActions}>
                    <Button
                      label="Rechazar"
                      variant="danger"
                      size="sm"
                      onPress={() => handleRejectTransferRequest(order)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Aceptar"
                      variant="primary"
                      size="sm"
                      icon={
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={COLORS.background}
                        />
                      }
                      iconPosition="left"
                      onPress={() => handleAcceptTransferRequest(order)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const statusColor = getOrderStatusColor(item.status);
          const showCollect = canCollect(item);
          return (
            <TouchableOpacity
              style={[styles.orderCard, { borderLeftColor: statusColor }]}
              onPress={() => handleOrderPress(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.orderNumber}>
                    #{item.id.slice(-6).toUpperCase()}
                  </Text>
                  {item.tableName && (
                    <View style={styles.tableBadge}>
                      <Ionicons
                        name="restaurant-outline"
                        size={11}
                        color={COLORS.primary}
                      />
                      <Text style={styles.tableText}>{item.tableName}</Text>
                    </View>
                  )}
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusColor}18` },
                  ]}
                >
                  <Ionicons
                    name={getOrderStatusIcon(item.status)}
                    size={12}
                    color={statusColor}
                  />
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {getOrderStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                {(item.customerAlias || item.customerName) && (
                  <View style={styles.customerRow}>
                    <Ionicons
                      name="person-circle-outline"
                      size={12}
                      color={COLORS.primary}
                    />
                    <Text style={styles.customerText} numberOfLines={1}>
                      {item.customerAlias || item.customerName}
                    </Text>
                  </View>
                )}
                <Text style={styles.itemsText} numberOfLines={2}>
                  {item.items
                    .map((i) => `${i.quantity}× ${i.productName}`)
                    .join(', ')}
                </Text>
                <Text style={styles.dateText}>
                  {item.createdAt?.toLocaleDateString('es-VE', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              {item.paymentStatus ===
                PaymentStatusEnum.PENDING_VERIFICATION && (
                <View style={styles.verificationBadge}>
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color={COLORS.warning}
                  />
                  <Text style={styles.verificationText}>Por verificar</Text>
                </View>
              )}

              {item.paymentRejected && (
                <View style={styles.rejectedBadge}>
                  <Ionicons name="close-circle" size={13} color="COLORS.errorLight" />
                  <View style={styles.rejectedBadgeContent}>
                    <Text style={styles.rejectedBadgeTitle}>
                      Pago rechazado
                    </Text>
                    {item.paymentRejectionReason && (
                      <Text
                        style={styles.rejectedBadgeReason}
                        numberOfLines={2}
                      >
                        {item.paymentRejectionReason}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {item.transferRequest?.status === 'REQUESTED' && (
                <View style={styles.transferPendingBanner}>
                  <Ionicons
                    name="swap-horizontal"
                    size={13}
                    color={COLORS.primary}
                  />
                  <Text style={styles.transferPendingText}>
                    Traspaso pendiente → {item.transferRequest.toWaiterName} (
                    {item.transferRequest.toPct}%)
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleCancelTransferRequest(item)}
                  >
                    <Text style={styles.transferCancelButton}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {item.transferRequest?.status === 'REJECTED' && (
                <View style={styles.transferRejectedBanner}>
                  <Ionicons name="close-circle" size={13} color="COLORS.cyan" />
                  <Text style={styles.transferRejectedText}>
                    Traspaso rechazado por {item.transferRequest.toWaiterName}
                  </Text>
                </View>
              )}

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.totalText}>
                    {formatearUsd(item.total)}
                  </Text>
                  {bcvRate > 0 && (
                    <Text style={styles.totalBsText}>
                      {formatearBs(usdToBs(item.total, bcvRate))}
                    </Text>
                  )}
                </View>
                <View style={styles.cardActions}>
                  {item.customerId && item.customerId !== user?.uid && (
                    <TouchableOpacity
                      style={styles.chatIconButton}
                      onPress={() => handleChat(item.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="chatbubbles-outline"
                        size={16}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>
                  )}
                  {item.status !== OrderStatusEnum.CANCELLED &&
                    item.status !== OrderStatusEnum.PAID && (
                      <TouchableOpacity
                        style={styles.precuentaButton}
                        onPress={() => {
                          void handlePrecuenta(item);
                        }}
                        activeOpacity={0.8}
                        disabled={printingOrderId === item.id}
                      >
                        {printingOrderId === item.id ? (
                          <ActivityIndicator
                            size="small"
                            color={COLORS.primary}
                          />
                        ) : (
                          <Ionicons
                            name="print-outline"
                            size={14}
                            color={COLORS.primary}
                          />
                        )}
                      </TouchableOpacity>
                    )}
                  {canTransfer(item) && (
                    <TouchableOpacity
                      style={styles.transferButton}
                      onPress={() => handleOpenTransferModal(item)}
                      activeOpacity={0.8}
                      disabled={isTransferring}
                    >
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={14}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>
                  )}
                  {showCollect && (
                    <Button
                      label="Cobrar"
                      variant="primary"
                      size="sm"
                      icon={
                        <Ionicons
                          name="cash-outline"
                          size={14}
                          color={COLORS.background}
                        />
                      }
                      iconPosition="left"
                      onPress={() => handleCollect(item)}
                    />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          orders.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {orders.length} pedido{orders.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="receipt-outline"
                size={52}
                color={`${COLORS.primary}60`}
              />
            </View>
            <Text style={styles.emptyTitle}>Sin pedidos activos</Text>
            <Text style={styles.emptyText}>
              Aquí verás los pedidos de tus mesas
            </Text>
          </View>
        }
      />

      {/* Modal de traspaso a colega */}
      {selectedOrderForTransfer && (
        <TransferToWaiterModal
          visible={transferModalVisible}
          onClose={() => {
            setTransferModalVisible(false);
            setSelectedOrderForTransfer(null);
          }}
          sourceOrder={{
            id: selectedOrderForTransfer.id,
            tableName: selectedOrderForTransfer.tableName,
            sector: selectedOrderForTransfer.sector,
          }}
          currentUserId={user?.uid ?? ''}
          onTransferStart={handleTransferStart}
          onTransferComplete={handleTransferComplete}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
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
  listHeader: {
    marginBottom: SPACING.md,
  },
  listHeaderText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 1,
  },
  orderNumber: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: 3,
  },
  tableText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    flexShrink: 0,
    gap: 3,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  cardBody: {
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  itemsText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.semibold,
    flex: 1,
  },
  dateText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  totalText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  totalBsText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}12`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
    gap: 3,
    borderWidth: 1,
    borderColor: `${COLORS.warning}25`,
  },
  verificationText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.warning,
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.errorLight,
  },
  rejectedBadgeContent: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  rejectedBadgeTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.errorLight,
    flexShrink: 1,
  },
  rejectedBadgeReason: {
    fontSize: 10,
    color: COLORS.errorDark,
    marginTop: 1,
    flexShrink: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  chatIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${COLORS.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  precuentaButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.md,
  },
  emptyIconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  transferButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferPendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}12`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: `${COLORS.primary}25`,
  },
  transferPendingText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
    flex: 1,
  },
  transferCancelButton: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.errorLight,
    fontWeight: FONT_WEIGHT.bold,
  },
  transferRejectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.infoLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.cyanLight,
  },
  transferRejectedText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.cyan,
    fontWeight: FONT_WEIGHT.semibold,
    flex: 1,
  },
  incomingTransfersSection: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  incomingTransfersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  incomingTransfersHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  incomingTransfersTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  incomingTransfersList: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  transferRequestCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  transferRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  transferRequestInfo: {
    flex: 1,
  },
  transferRequestFromWaiter: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  transferRequestLocation: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  transferRequestPct: {
    alignItems: 'center',
  },
  transferRequestPctLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  transferRequestPctValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  transferRequestTotal: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  transferRequestTime: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
  },
  transferRequestActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
});

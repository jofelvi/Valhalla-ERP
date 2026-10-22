import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { orderService } from '../../services';
import { on as onSocket } from '../../services/api/socketClient';
import { chatService } from '../../services';
import { useProductosDelMenu } from '../../queries/useCatalogo';
import { useAuthStore } from '../../store';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
} from '../../constants';
import {
  Order,
  OrderStatusEnum,
  CustomerRequestType,
  CustomerRequestStatus,
  Product,
} from '../../types';
import type { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { formatearUsd } from '../../utils/dinero';
import { Input, Button, Card } from '../../components/ui';
import { filtrarLocal } from '../../utils/busquedaTexto';

import { useVocab } from '../../config/hooks';
type Nav = NativeStackNavigationProp<RootStackParamList, 'MyTable'>;
type Rt = RouteProp<RootStackParamList, 'MyTable'>;

const STATUS_LABEL: Partial<Record<OrderStatusEnum, string>> = {
  [OrderStatusEnum.PENDING]: 'Recibido',
  [OrderStatusEnum.IN_PROGRESS]: 'En preparacion',
  [OrderStatusEnum.READY]: 'Va en camino',
  [OrderStatusEnum.DELIVERED]: 'Entregado',
  [OrderStatusEnum.PAID]: 'Pagado',
};

export const MyTableScreen: React.FC = () => {
  const vocab = useVocab();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { orderId } = route.params;
  const user = useAuthStore((s) => s.user);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [noteModal, setNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [productModal, setProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const { data: allProducts = [], isLoading: productsLoading } =
    useProductosDelMenu(productModal);
  const products = allProducts.filter((p) => p.isForSale);

  const load = useCallback(async () => {
    const fresh = await orderService.getOrderById(orderId);
    setOrder(fresh);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresco en vivo: el mesonero acepta un producto, cocina cambia el estado,
  // etc. Reusamos el evento global de ordenes y filtramos por id.
  useEffect(() => {
    let off: (() => void) | undefined;
    void (async () => {
      off = await onSocket<{ id?: string; _id?: string }>(
        'order:updated',
        (raw) => {
          const id = String(raw.id ?? raw._id ?? '');
          if (id === orderId) void load();
        },
      );
    })();
    return () => off?.();
  }, [orderId, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const submit = useCallback(
    async (fn: () => Promise<Order>, okMsg: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const updated = await fn();
        setOrder(updated);
        showAlert('Listo', okMsg);
      } catch {
        showAlert('Ups', 'No se pudo enviar tu solicitud. Intenta de nuevo.');
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const callWaiter = useCallback(() => {
    void submit(
      () =>
        orderService.createCustomerRequest(orderId, {
          type: CustomerRequestType.CALL_WAITER,
        }),
      'Le avisamos al mesonero que lo llamas.',
    );
  }, [orderId, submit]);

  const requestBill = useCallback(() => {
    showAlert(
      'Pedir la cuenta',
      'Se avisara al mesonero para cobrar. ¿Confirmas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pedir cuenta',
          onPress: () =>
            void submit(
              () => orderService.requestBill(orderId),
              'Pedimos la cuenta. El mesonero viene en camino.',
            ),
        },
      ],
    );
  }, [orderId, submit]);

  const sendNote = useCallback(() => {
    const text = noteText.trim();
    if (!text) return;
    setNoteModal(false);
    setNoteText('');
    void submit(
      () =>
        orderService.createCustomerRequest(orderId, {
          type: CustomerRequestType.MISC,
          note: text,
        }),
      'Enviamos tu solicitud al mesonero.',
    );
  }, [noteText, orderId, submit]);

  const openProductPicker = useCallback(async () => {
    setProductModal(true);
  }, []);

  const requestProduct = useCallback(
    (product: Product) => {
      setProductModal(false);
      void submit(
        () =>
          orderService.createCustomerRequest(orderId, {
            type: CustomerRequestType.PRODUCT,
            productId: product.id,
            quantity: 1,
          }),
        `Pediste ${product.name}. El mesonero lo confirmara.`,
      );
    },
    [orderId, submit],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={56}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyText}>No encontramos tu mesa.</Text>
        <Button
          label="Volver"
          variant="primary"
          onPress={() => navigation.goBack()}
          style={{ alignSelf: 'center' }}
        />
      </View>
    );
  }

  const chatEnabled =
    order.status === OrderStatusEnum.IN_PROGRESS ||
    order.status === OrderStatusEnum.READY;

  const myRequests = (order.customerRequests ?? []).filter(
    (r) => r.createdByCustomerId === user?.id,
  );
  const pendingCount = myRequests.filter(
    (r) => r.status === CustomerRequestStatus.PENDING,
  ).length;

  const filteredProducts = filtrarLocal(products, productSearch, ['name']);

  const openChat = async () => {
    if (!chatEnabled || !user) return;
    try {
      await chatService.createChat(
        order.id,
        order.customerId || user.id,
        order.customerName || user.name,
        order.waiterId || '',
        order.waiterName || vocab.waiter,
      );
    } catch {
      // El chat es idempotente; si ya existe seguimos igual.
    }
    navigation.navigate('Chat', { orderId: order.id });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Estado */}
        <Card variant="outlined" padding="lg" style={styles.statusCard}>
          <Text style={styles.statusLabel}>Estado del pedido</Text>
          <Text style={styles.statusValue}>
            {STATUS_LABEL[order.status] ?? order.status}
          </Text>
          {order.tableName ? (
            <Text style={styles.tableName}>{order.tableName}</Text>
          ) : null}
        </Card>

        {order.billRequested ? (
          <View style={styles.billBanner}>
            <Ionicons
              name="receipt-outline"
              size={18}
              color={COLORS.background}
            />
            <Text style={styles.billBannerText}>Ya pediste la cuenta</Text>
          </View>
        ) : null}

        {/* Items */}
        <Text style={styles.sectionTitle}>Tu pedido</Text>
        <Card variant="outlined" padding="md">
          {order.items.length === 0 ? (
            <Text style={styles.mutedText}>Aun no hay productos.</Text>
          ) : (
            order.items.map((it, idx) => (
              <View key={`${it.productId}-${idx}`} style={styles.itemRow}>
                <Text style={styles.itemQty}>{it.quantity}x</Text>
                <Text style={styles.itemName} numberOfLines={1}>
                  {it.productName}
                </Text>
                <Text style={styles.itemPrice}>
                  {formatearUsd(it.totalPrice)}
                </Text>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatearUsd(order.total)}</Text>
          </View>
        </Card>

        {/* Mis solicitudes */}
        {myRequests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Mis solicitudes</Text>
            <Card variant="outlined" padding="md">
              {myRequests.map((r) => (
                <View key={r.id} style={styles.reqRow}>
                  <Ionicons
                    name={reqIcon(r.type)}
                    size={16}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.reqText} numberOfLines={1}>
                    {reqText(r.type, r.productName, r.quantity, r.note)}
                  </Text>
                  <Text
                    style={[
                      styles.reqStatus,
                      { color: reqStatusColor(r.status) },
                    ]}
                  >
                    {reqStatusLabel(r.status)}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Acciones */}
        <Text style={styles.sectionTitle}>¿Necesitas algo?</Text>
        <View style={styles.actionsGrid}>
          <ActionButton
            icon="add-circle-outline"
            label="Agregar producto"
            onPress={openProductPicker}
            disabled={busy}
          />
          <ActionButton
            icon="hand-left-outline"
            label="Llamar mesonero"
            onPress={callWaiter}
            disabled={busy}
          />
          <ActionButton
            icon="chatbox-ellipses-outline"
            label="Pedir algo"
            onPress={() => setNoteModal(true)}
            disabled={busy}
          />
          <ActionButton
            icon="receipt-outline"
            label="Pedir la cuenta"
            onPress={requestBill}
            disabled={busy || order.billRequested}
          />
        </View>

        {/* Chat */}
        <Button
          label={
            chatEnabled
              ? 'Chatear con el mesonero'
              : 'Chat disponible al preparar tu pedido'
          }
          variant={chatEnabled ? 'primary' : 'secondary'}
          icon={<Ionicons name="chatbubbles-outline" size={20} />}
          onPress={openChat}
          disabled={!chatEnabled}
          style={{ marginTop: SPACING.md }}
        />

        {pendingCount > 0 ? (
          <Text style={styles.pendingHint}>
            Tienes {pendingCount} solicitud{pendingCount > 1 ? 'es' : ''} en
            espera.
          </Text>
        ) : null}
      </ScrollView>

      {busy && (
        <View style={styles.busyOverlay} pointerEvents="none">
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      )}

      {/* Modal nota libre */}
      <Modal
        visible={noteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pedir algo</Text>
            <Input
              placeholder="Ej: mas servilletas, hielo, salsa..."
              value={noteText}
              onChangeText={setNoteText}
              multiline
              maxLength={280}
            />
            <View style={styles.modalActions}>
              <Button
                label="Cancelar"
                variant="ghost"
                onPress={() => setNoteModal(false)}
              />
              <Button label="Enviar" variant="primary" onPress={sendNote} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal selector de producto */}
      <Modal
        visible={productModal}
        animationType="slide"
        onRequestClose={() => setProductModal(false)}
      >
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Agregar producto</Text>
            <TouchableOpacity onPress={() => setProductModal(false)}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchInputWrapper}>
            <Input
              placeholder="Buscar en el menu..."
              value={productSearch}
              onChangeText={setProductSearch}
              leftIcon="search-outline"
            />
          </View>
          {productsLoading ? (
            <ActivityIndicator
              color={COLORS.primary}
              style={{ marginTop: SPACING.xl }}
            />
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ padding: SPACING.md }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productRow}
                  onPress={() => requestProduct(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productPrice}>
                      {formatearUsd(item.price)}
                    </Text>
                  </View>
                  <Ionicons
                    name="add-circle"
                    size={26}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.mutedText}>No hay productos.</Text>
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const ActionButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ icon, label, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
    onPress={onPress}
    disabled={disabled}
  >
    <Ionicons
      name={icon}
      size={26}
      color={disabled ? COLORS.textLight : COLORS.primary}
    />
    <Text style={[styles.actionLabel, disabled && { color: COLORS.textLight }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

function reqIcon(type: CustomerRequestType): keyof typeof Ionicons.glyphMap {
  if (type === CustomerRequestType.PRODUCT) return 'fast-food-outline';
  if (type === CustomerRequestType.CALL_WAITER) return 'hand-left-outline';
  return 'chatbox-ellipses-outline';
}

function reqText(
  type: CustomerRequestType,
  productName?: string | null,
  quantity?: number | null,
  note?: string | null,
): string {
  if (type === CustomerRequestType.PRODUCT) {
    return `${quantity ?? 1}x ${productName ?? 'producto'}`;
  }
  if (type === CustomerRequestType.CALL_WAITER) return 'Llamaste al mesonero';
  return note ?? 'Solicitud';
}

function reqStatusLabel(status: CustomerRequestStatus): string {
  switch (status) {
    case CustomerRequestStatus.PENDING:
      return 'En espera';
    case CustomerRequestStatus.ACCEPTED:
      return 'Aceptada';
    case CustomerRequestStatus.REJECTED:
      return 'Rechazada';
    case CustomerRequestStatus.ACK:
      return 'Vista';
    default:
      return '';
  }
}

function reqStatusColor(status: CustomerRequestStatus): string {
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
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl, gap: SPACING.sm },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  statusCard: {},
  statusLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  statusValue: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: 2,
  },
  tableName: { color: COLORS.text, fontSize: FONT_SIZE.sm, marginTop: 2 },
  billBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.warning,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  billBannerText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.semibold,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.md,
  },
  mutedText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  itemQty: { color: COLORS.primary, fontWeight: FONT_WEIGHT.bold, width: 34 },
  itemName: { color: COLORS.text, flex: 1, fontSize: FONT_SIZE.sm },
  itemPrice: { color: COLORS.text, fontSize: FONT_SIZE.sm },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
  totalLabel: { color: COLORS.text, fontWeight: FONT_WEIGHT.bold },
  totalValue: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: FONT_SIZE.md,
  },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  reqText: { color: COLORS.text, flex: 1, fontSize: FONT_SIZE.sm },
  reqStatus: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionBtn: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionLabel: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    textAlign: 'center',
  },
  pendingHint: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  pickerContainer: { flex: 1, backgroundColor: COLORS.background },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  searchInputWrapper: {
    padding: SPACING.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  productName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
  },
  productPrice: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
});

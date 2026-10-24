import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomerSelectModal, FichaQrModal } from '../../components';
import { Button, Card } from '../../components/ui';
import { packSizeOf } from '../../services/packPricing';
import { formatearUsd } from '../../utils/dinero';
import { useAuthStore } from '../../store';
import { OrderStatusEnum, OrderTypeEnum, UserRoleEnum } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useModal } from '../../hooks/useModal';
import { useTarifas } from '../../config/hooks';
import { pctTexto } from '../../config/totalesDeOrden';
import { tarifasDeOrden } from '../../config/tarifasDeOrden';
import { COMANDA_AL_PAGAR } from '../../config/funciones';
import {
  avisoNoAgregarProductos,
  motivoNoAgregarProductos,
} from '../../services/pedidoAgregarProductos';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import {
  useOrderData,
  useRevertPinLogic,
  useWaiterSelection,
  useCustomerSelection,
  useItemRemoval,
  useDeleteOrderLogic,
  useAddNoteLogic,
  usePackConversion,
  useDeliveryManagement,
  useOrderActions,
} from './hooks';
import {
  getStatusColor,
  getStatusIcon,
  getStatusLabel,
  getStatusDescription,
  formatDate,
} from './utils';

/**
 * Estaciones que entregan escaneando la ficha. Debe ir en paren con
 * CONTROLLED_STATIONS del backend (orders.service.ts): si una estacion despacha
 * por QR y no esta aqui, el mesonero no ve la ficha y no puede recibir su
 * pedido.
 */
import { useVocab } from '../../config/hooks';
const CONTROLLED_STATIONS = ['BAR', 'KITCHEN', 'PIZZA'];

interface OrderDetailScreenProps {
  route: {
    params: {
      orderId: string;
    };
  };
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({
  route,
}) => {
  const vocab = useVocab();
  const { orderId } = route.params;
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

  // Hooks de estado y lógica
  const { order, setOrder, isLoading } = useOrderData(orderId);
  const tarifasVigentes = useTarifas();
  const { handleDeliveryChange } = useDeliveryManagement({
    order,
    setOrder,
    orderId,
  });
  const {
    revertPinModal,
    pinValue,
    setPinValue,
    pinError,
    setPinError,
    isValidatingPin,
    handleRevertRequest,
    handlePinSubmit,
  } = useRevertPinLogic({
    order,
    onDeliveryChange: handleDeliveryChange,
  });
  const {
    waiterModal,
    waiterOptions,
    isLoadingWaiters,
    isUpdatingWaiter,
    handleOpenWaiterSelector,
    handleSelectWaiter,
  } = useWaiterSelection(order);
  const { customerModal, isUpdatingCustomer, handleSelectCustomer } =
    useCustomerSelection(order);
  const {
    itemPinModal,
    pendingRemoveIndex,
    itemPinValue,
    setItemPinValue,
    itemPinReason,
    setItemPinReason,
    itemPinError,
    isAuthorizingItem,
    handleRemoveItem,
    confirmRemoveItemWithPin,
  } = useItemRemoval(order, orderId);
  const {
    addNoteModal,
    newNoteText,
    setNewNoteText,
    isAddingNote,
    handleAddAdditionalNote,
  } = useAddNoteLogic({
    orderId,
    userUid: user?.uid,
    userDisplayName: user?.displayName ?? undefined,
  });
  const {
    deleteModal,
    deletePinValue,
    setDeletePinValue,
    deleteReason,
    setDeleteReason,
    deletePinError,
    setDeletePinError,
    isDeletingOrder,
    handleDeleteOrder,
  } = useDeleteOrderLogic({
    orderId,
    userUid: user?.uid,
    userDisplayName: user?.displayName ?? undefined,
    onSuccess: () => navigation.goBack(),
  });
  const {
    packConversionModal,
    isConvertingPacks,
    conversionOptions,
    packsElegidos,
    setPacksElegidos,
    claveDeOpcion,
    handleExecuteConversion,
  } = usePackConversion(order?.id ?? null);
  const { handleAddItems, handleToggleTakeaway } = useOrderActions({
    order,
    orderId,
    navigation,
  });

  // Fichas QR
  const fichaQrModal = useModal('orderDetailFichaQr');

  const isAdmin = role === UserRoleEnum.ADMIN;

  const isWaiter =
    role === UserRoleEnum.WAITER ||
    role === UserRoleEnum.ADMIN ||
    role === UserRoleEnum.MANAGER;

  const isCashier = role === UserRoleEnum.CASHIER;

  // El mesonero es "dueño" de la orden si es creador (userId) o asignado (waiterId).
  // Las ordenes creadas por admin/cajero asignandole al mesonero solo tienen
  // waiterId === uid, no userId. Sin este OR, la APK le escondia el boton.
  const isOrderOwnedByMe =
    order !== null &&
    !!user?.uid &&
    (order.userId === user.uid || order.waiterId === user.uid);

  const puedeAgregarPorEstado =
    order !== null &&
    (order.status === OrderStatusEnum.PENDING ||
      order.status === OrderStatusEnum.IN_PROGRESS) &&
    ((isWaiter && isOrderOwnedByMe) || isCashier);

  // Con prepago, un pedido cobrado o con pago rechazado no recibe productos nuevos.
  const motivoNoAgregar = order
    ? motivoNoAgregarProductos(
        {
          paymentStatus: order.paymentStatus,
          paymentRejected: order.paymentRejected,
        },
        COMANDA_AL_PAGAR,
      )
    : null;

  const canAddItems = puedeAgregarPorEstado && motivoNoAgregar === null;

  // Aviso en lugar del botón "Agregar productos" para quien sí podría agregar.
  const avisoAgregar =
    puedeAgregarPorEstado && motivoNoAgregar !== null
      ? avisoNoAgregarProductos(motivoNoAgregar)
      : null;

  const canManageDelivery =
    isWaiter &&
    isOrderOwnedByMe &&
    (order?.status === OrderStatusEnum.PENDING ||
      order?.status === OrderStatusEnum.IN_PROGRESS ||
      order?.status === OrderStatusEnum.READY);

  const canDeleteOrder =
    order !== null &&
    order.status !== OrderStatusEnum.PAID &&
    order.status !== OrderStatusEnum.CANCELLED &&
    (isWaiter || isCashier);

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
        <Text style={styles.loadingText}>Cargando pedido...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={56}
            color={COLORS.error}
          />
        </View>
        <Text style={styles.errorTitle}>Pedido no encontrado</Text>
        <Text style={styles.errorSubtitle}>
          No pudimos encontrar la información de este pedido
        </Text>
      </View>
    );
  }

  const statusColor = getStatusColor(order.status);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card con gradiente */}
        <View style={styles.statusCard}>
          <LinearGradient
            colors={[`${statusColor}20`, `${statusColor}08`]}
            style={styles.statusCardGradient}
          >
            <View
              style={[
                styles.statusIconContainer,
                { backgroundColor: `${statusColor}25` },
              ]}
            >
              <Ionicons
                name={getStatusIcon(order.status)}
                size={34}
                color={statusColor}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLabel, { color: statusColor }]}>
                {getStatusLabel(order.status)}
              </Text>
              <Text style={styles.statusDescription}>
                {getStatusDescription(order.status)}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Información del Pedido */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>Información del Pedido</Text>
          </View>

          <Card variant="default" padding="md">
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons
                  name="receipt-outline"
                  size={15}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.infoLabel}>Número de pedido</Text>
              </View>
              <Text style={styles.infoValue}>
                #{order.id.slice(-6).toUpperCase()}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.infoLabel}>Fecha</Text>
              </View>
              <Text style={styles.infoValue}>
                {formatDate(order.createdAt)}
              </Text>
            </View>

            {order.tableName && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons
                      name="grid-outline"
                      size={15}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.infoLabel}>{vocab.table}</Text>
                  </View>
                  <Text style={styles.infoValue}>{order.tableName}</Text>
                </View>
              </>
            )}

            {(order.waiterName || isAdmin) && (
              <>
                <View style={styles.divider} />
                {isAdmin ? (
                  <TouchableOpacity
                    style={styles.infoRow}
                    onPress={handleOpenWaiterSelector}
                    activeOpacity={0.7}
                  >
                    <View style={styles.infoLabelContainer}>
                      <Ionicons
                        name="person-outline"
                        size={15}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.infoLabel}>{vocab.waiter}</Text>
                    </View>
                    <View style={styles.waiterSelectorValue}>
                      <Text
                        style={[
                          styles.infoValue,
                          order.waiterName ? {} : { color: COLORS.textLight },
                        ]}
                      >
                        {order.waiterName ?? 'Sin asignar'}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color={COLORS.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.infoRow}>
                    <View style={styles.infoLabelContainer}>
                      <Ionicons
                        name="person-outline"
                        size={15}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.infoLabel}>{vocab.waiter}</Text>
                    </View>
                    <Text style={styles.infoValue}>{order.waiterName}</Text>
                  </View>
                )}
              </>
            )}

            {/* Datos del cliente (staff puede asociar/cambiar mientras no esté pagada) */}
            {(() => {
              const hasRealCustomer =
                !!order.customerId &&
                order.customerId !== order.waiterId &&
                order.customerId !== order.userId;
              const staffCanEditCustomer =
                (isWaiter || isCashier) &&
                (order.paymentStatus ?? '').toLowerCase() !== 'paid';
              if (!hasRealCustomer && !staffCanEditCustomer) {
                return null;
              }
              return (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoLabelContainer}>
                      <Ionicons
                        name="person-circle-outline"
                        size={15}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.infoLabel}>Cliente</Text>
                    </View>
                    {hasRealCustomer ? (
                      <View style={styles.customerValueRow}>
                        <Text style={styles.infoValue} numberOfLines={1}>
                          {order.customerAlias || order.customerName}
                        </Text>
                        {staffCanEditCustomer && (
                          <TouchableOpacity
                            style={styles.customerEditChip}
                            onPress={() => customerModal.open()}
                            disabled={isUpdatingCustomer}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="pencil-outline"
                              size={12}
                              color={COLORS.primary}
                            />
                            <Text style={styles.customerEditChipText}>
                              Cambiar
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.customerAddChip}
                        onPress={() => customerModal.open()}
                        disabled={isUpdatingCustomer}
                        activeOpacity={0.7}
                      >
                        {isUpdatingCustomer ? (
                          <ActivityIndicator
                            size="small"
                            color={COLORS.primary}
                          />
                        ) : (
                          <Ionicons
                            name="person-add-outline"
                            size={13}
                            color={COLORS.primary}
                          />
                        )}
                        <Text style={styles.customerAddChipText}>
                          {isUpdatingCustomer
                            ? 'Guardando...'
                            : 'Asociar cliente'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {hasRealCustomer &&
                    order.customerAlias &&
                    order.customerName &&
                    order.customerAlias !== order.customerName && (
                      <View style={styles.infoRow}>
                        <View style={styles.infoLabelContainer}>
                          <Ionicons
                            name="card-outline"
                            size={15}
                            color={COLORS.textSecondary}
                          />
                          <Text style={styles.infoLabel}>Socio</Text>
                        </View>
                        <Text style={styles.infoValue} numberOfLines={1}>
                          {order.customerName}
                        </Text>
                      </View>
                    )}
                </>
              );
            })()}

            {/* Toggle Para llevar - solo mesoneros con pedido activo */}
            {canAddItems && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons
                      name="bag-outline"
                      size={15}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.infoLabel}>Tipo de servicio</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.takeawayChip,
                      order.orderType === OrderTypeEnum.Takeaway &&
                        styles.takeawayChipActive,
                    ]}
                    onPress={handleToggleTakeaway}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={
                        order.orderType === OrderTypeEnum.Takeaway
                          ? 'bag-check'
                          : 'bag-outline'
                      }
                      size={13}
                      color={
                        order.orderType === OrderTypeEnum.Takeaway
                          ? COLORS.background
                          : COLORS.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.takeawayChipText,
                        order.orderType === OrderTypeEnum.Takeaway &&
                          styles.takeawayChipTextActive,
                      ]}
                    >
                      {order.orderType === OrderTypeEnum.Takeaway
                        ? 'Para llevar'
                        : 'En local'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Card>

          {/* Botón de chat */}
          {order.waiterId &&
            order.status !== OrderStatusEnum.CANCELLED &&
            order.status !== OrderStatusEnum.PAID && (
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() =>
                  navigation.navigate('Chat', { orderId: order.id })
                }
                activeOpacity={0.8}
              >
                <View style={styles.chatButtonIcon}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.chatButtonText}>
                  Chatear con el mesonero
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            )}

          {/* Mesa Conectada: QR para el cliente + solicitudes (solo staff) */}
          {(isWaiter || isCashier) &&
            order.status !== OrderStatusEnum.CANCELLED &&
            order.status !== OrderStatusEnum.PAID && (
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() =>
                  navigation.navigate('TableConnect', { orderId: order.id })
                }
                activeOpacity={0.8}
              >
                <View style={styles.chatButtonIcon}>
                  <Ionicons
                    name="qr-code-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.chatButtonText}>
                  Conectar cliente / Solicitudes
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            )}
        </View>

        {/* Productos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="fast-food-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>
              Productos ({order.items.length})
            </Text>
            {conversionOptions.length > 0 &&
              order.status !== OrderStatusEnum.PAID &&
              order.status !== OrderStatusEnum.CANCELLED && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: COLORS.primaryDark,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    marginLeft: 'auto',
                  }}
                  onPress={() => {
                    // Siempre abre el modal, aunque haya una sola opcion: la
                    // persona tiene que VER que va a convertir y cuantas
                    // antes de que pase. Convertir es una opcion, no un
                    // efecto de haber tocado un boton.
                    packConversionModal.open();
                  }}
                  disabled={isConvertingPacks}
                >
                  <Ionicons
                    name="beer-outline"
                    size={14}
                    color="#fff"
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}
                  >
                    {isConvertingPacks ? 'Convirtiendo...' : 'Convertir a tobo'}
                  </Text>
                </TouchableOpacity>
              )}
          </View>

          <Card variant="default" padding="md">
            {order.items.map((item, index) => {
              const delivered = item.deliveredQty ?? 0;
              // La orden guarda UNIDADES: un tobo son 12. La entrega se sigue
              // contando en unidades (la barra entrega cerveza por cerveza),
              // pero mostrarlas a secas decia "12 Tobo de Cerveza".
              const qty = item.quantity;
              const packSize = packSizeOf(item.productId, item.presentationQty);
              const packs = packSize > 0 ? qty / packSize : 0;
              const isWholePack = packSize > 0 && Number.isInteger(packs);
              // El precio por unidad de un pack (11/12 = $0.92) no es lo que se
              // cobra: al lado de "Tobo" se lee como si el tobo costara $0.92.
              const packPrice =
                Math.round((item.unitPrice ?? 0) * packSize * 100) / 100;
              return (
                <View key={index}>
                  <View style={styles.itemRow}>
                    <View style={styles.itemQuantityBadge}>
                      <Text style={styles.itemQuantityText}>
                        {isWholePack ? packs : qty}
                      </Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.productName ||
                          `Producto #${item.productId.slice(-5)}`}
                      </Text>
                      <Text style={styles.itemUnitPrice}>
                        {isWholePack
                          ? `${qty} cervezas · ${formatearUsd(packPrice)} c/u`
                          : packSize > 0
                            ? `${qty} cervezas · revisar: no completa ${packSize}`
                            : `${formatearUsd(item.unitPrice)} c/u`}
                      </Text>
                    </View>
                    <Text style={styles.itemPrice}>
                      {formatearUsd(item.totalPrice)}
                    </Text>
                    {isAdmin &&
                      order.status !== OrderStatusEnum.PAID &&
                      order.status !== OrderStatusEnum.CANCELLED && (
                        <TouchableOpacity
                          style={styles.removeItemButton}
                          onPress={() => handleRemoveItem(index)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color={COLORS.error}
                          />
                        </TouchableOpacity>
                      )}
                  </View>

                  {/* Controles de entrega - solo mesoneros */}
                  {canManageDelivery && (
                    <View style={styles.deliveryRow}>
                      {delivered >= qty ? (
                        <View style={styles.deliveryStatusRow}>
                          <View
                            style={[
                              styles.deliveryBadge,
                              styles.deliveryBadgeGreen,
                            ]}
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={12}
                              color={COLORS.success}
                            />
                            <Text
                              style={[
                                styles.deliveryBadgeText,
                                { color: COLORS.success },
                              ]}
                            >
                              Entregado
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.revertButton}
                            onPress={() => handleRevertRequest(index)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="arrow-undo"
                              size={12}
                              color={COLORS.error}
                            />
                            <Text style={styles.revertButtonText}>
                              Revertir
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <View style={styles.deliveryStatusRow}>
                            {delivered > 0 && (
                              <>
                                <View
                                  style={[
                                    styles.deliveryBadge,
                                    styles.deliveryBadgeGreen,
                                  ]}
                                >
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={12}
                                    color={COLORS.success}
                                  />
                                  <Text
                                    style={[
                                      styles.deliveryBadgeText,
                                      { color: COLORS.success },
                                    ]}
                                  >
                                    {delivered} entregado
                                    {delivered !== 1 ? 's' : ''}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.revertButton}
                                  onPress={() => handleRevertRequest(index)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons
                                    name="arrow-undo"
                                    size={12}
                                    color={COLORS.error}
                                  />
                                  <Text style={styles.revertButtonText}>
                                    Revertir
                                  </Text>
                                </TouchableOpacity>
                              </>
                            )}
                            <View
                              style={[
                                styles.deliveryBadge,
                                delivered > 0
                                  ? styles.deliveryBadgeOrange
                                  : styles.deliveryBadgeGray,
                              ]}
                            >
                              <Ionicons
                                name="time-outline"
                                size={12}
                                color={
                                  delivered > 0
                                    ? COLORS.warning
                                    : COLORS.textSecondary
                                }
                              />
                              <Text
                                style={[
                                  styles.deliveryBadgeText,
                                  {
                                    color:
                                      delivered > 0
                                        ? COLORS.warning
                                        : COLORS.textSecondary,
                                  },
                                ]}
                              >
                                {qty - delivered} pendiente
                                {qty - delivered !== 1 ? 's' : ''}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={styles.deliveryMarkButton}
                            onPress={() =>
                              handleDeliveryChange(index, delivered + 1)
                            }
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={COLORS.success}
                            />
                            <Text style={styles.deliveryMarkText}>
                              Entregar
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}

                  {index < order.items.length - 1 && (
                    <View style={styles.itemDivider} />
                  )}
                </View>
              );
            })}
          </Card>

          {avisoAgregar && (
            <View style={styles.avisoAgregar}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={COLORS.textSecondary}
              />
              <Text style={styles.avisoAgregarTexto}>{avisoAgregar}</Text>
            </View>
          )}

          {/* Boton agregar productos - solo mesoneros con pedido activo */}
          {canAddItems && (
            <TouchableOpacity
              style={styles.addItemsButton}
              onPress={handleAddItems}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.gradientStart, COLORS.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addItemsButtonGradient}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={COLORS.background}
                />
                <Text style={styles.addItemsButtonText}>Agregar productos</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Ver ficha (QR + saldo). Va por CUALQUIER estacion que entregue
              escaneando, no solo barra: cocina y pizza tambien despachan por
              ficha. Cuando esto miraba solo 'BAR', un pedido de puras pizzas o
              hamburguesas no mostraba el boton y el mesonero se quedaba sin QR
              que ensenar — 65 ordenes en 7 dias. */}
          {order.items?.some((it) =>
            CONTROLLED_STATIONS.includes(
              String(
                (it as { station?: string | null }).station ?? '',
              ).toUpperCase(),
            ),
          ) && (
            <TouchableOpacity
              style={styles.fichaButton}
              onPress={() => fichaQrModal.open()}
              activeOpacity={0.8}
            >
              <Ionicons
                name="qr-code-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.fichaButtonText}>Ver ficha</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Resumen de pago */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Resumen de pago</Text>
          </View>

          <Card variant="default" padding="lg">
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {formatearUsd(order.subtotal)}
              </Text>
            </View>

            {order.tax != null && order.tax > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Impuesto</Text>
                <Text style={styles.totalValue}>{formatearUsd(order.tax)}</Text>
              </View>
            )}

            {order.serviceCharge != null && order.serviceCharge > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Servicio (
                  {pctTexto(tarifasDeOrden(order, tarifasVigentes).serviceRate)}
                  %)
                </Text>
                <Text style={styles.totalValue}>
                  {formatearUsd(order.serviceCharge)}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                {formatearUsd(order.total)}
              </Text>
            </View>
          </Card>
        </View>

        {/* Notas (original + adicionales) */}
        <View style={styles.section}>
          <View
            style={[styles.sectionHeader, { justifyContent: 'space-between' }]}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons
                name="chatbubble-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>Notas</Text>
            </View>
            <Button
              variant="primary"
              size="sm"
              label="Agregar nota"
              icon={<Ionicons name="add" size={14} color="white" />}
              onPress={() => {
                setNewNoteText('');
                addNoteModal.open();
              }}
            />
          </View>

          {order.notes && (
            <Card variant="default" padding="lg">
              <Text
                style={[
                  styles.notesText,
                  { fontWeight: FONT_WEIGHT.bold, marginBottom: 4 },
                ]}
              >
                Nota original:
              </Text>
              <Text style={styles.notesText}>{order.notes}</Text>
            </Card>
          )}

          {(order.additionalNotes ?? []).map((n, idx) => (
            <Card
              key={idx}
              variant="default"
              padding="lg"
              style={{ marginTop: 8 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <Text
                  style={[styles.notesText, { fontWeight: FONT_WEIGHT.bold }]}
                >
                  Nota {idx + 1}
                  {n.authorName ? ` - ${n.authorName}` : ''}:
                </Text>
                {n.system && (
                  <View
                    style={{
                      backgroundColor: COLORS.warningLight,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.warningDark,
                        fontSize: 10,
                        fontWeight: '700',
                      }}
                    >
                      SISTEMA
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.notesText}>{n.text}</Text>
            </Card>
          ))}

          {!order.notes &&
            (!order.additionalNotes || order.additionalNotes.length === 0) && (
              <Text
                style={[
                  styles.notesText,
                  { fontStyle: 'italic', opacity: 0.6 },
                ]}
              >
                Sin notas. Toca &quot;Agregar nota&quot; para anexar una.
              </Text>
            )}
        </View>

        {/* Eliminar orden (con PIN admin) */}
        {canDeleteOrder && (
          <View style={styles.section}>
            <Button
              variant="danger"
              size="md"
              label="Eliminar orden (requiere PIN admin)"
              icon={<Ionicons name="trash-outline" size={16} color="white" />}
              onPress={() => {
                setDeletePinValue('');
                setDeleteReason('');
                setDeletePinError('');
                deleteModal.open();
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* Modal: Agregar nota adicional */}
      <Modal
        visible={addNoteModal.isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => addNoteModal.close()}
      >
        <View style={styles.waiterModalOverlay}>
          <View style={styles.waiterModalContent}>
            <View style={styles.waiterModalHeader}>
              <Text style={styles.waiterModalTitle}>
                Agregar nota adicional
              </Text>
              <TouchableOpacity
                onPress={() => addNoteModal.close()}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: SPACING.md }}>
              <Text
                style={{
                  color: COLORS.textSecondary,
                  fontSize: FONT_SIZE.sm,
                  marginBottom: 8,
                }}
              >
                La nota original se conserva. Esta nueva nota se anexara como
                &quot;Nota {(order.additionalNotes?.length ?? 0) + 1}&quot;.
              </Text>
              <TextInput
                value={newNoteText}
                onChangeText={setNewNoteText}
                placeholder="Escribe la nota..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: COLORS.surface,
                  color: COLORS.text,
                  borderRadius: BORDER_RADIUS.md,
                  padding: SPACING.md,
                  fontSize: FONT_SIZE.md,
                  textAlignVertical: 'top',
                  minHeight: 100,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
                editable={!isAddingNote}
              />
              <Button
                variant="primary"
                size="md"
                label="Guardar nota"
                loading={isAddingNote}
                disabled={isAddingNote}
                onPress={() => void handleAddAdditionalNote()}
                style={{ marginTop: 12 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Eliminar orden con PIN admin */}
      <Modal
        visible={deleteModal.isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => deleteModal.close()}
      >
        <View style={styles.waiterModalOverlay}>
          <View style={styles.waiterModalContent}>
            <View style={styles.waiterModalHeader}>
              <Text style={styles.waiterModalTitle}>Eliminar orden</Text>
              <TouchableOpacity
                onPress={() => deleteModal.close()}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: SPACING.md }}>
              <Text
                style={{
                  color: COLORS.textSecondary,
                  fontSize: FONT_SIZE.sm,
                  marginBottom: 12,
                }}
              >
                La orden se marcara como cancelada y la mesa quedara libre. Se
                requiere PIN de admin.
              </Text>

              <Text
                style={{
                  color: COLORS.text,
                  fontSize: FONT_SIZE.sm,
                  marginBottom: 4,
                  fontWeight: FONT_WEIGHT.bold,
                }}
              >
                PIN de admin:
              </Text>
              <TextInput
                value={deletePinValue}
                onChangeText={setDeletePinValue}
                placeholder="••••"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
                keyboardType="number-pad"
                style={{
                  backgroundColor: COLORS.surface,
                  color: COLORS.text,
                  borderRadius: BORDER_RADIUS.md,
                  padding: SPACING.md,
                  fontSize: FONT_SIZE.lg,
                  textAlign: 'center',
                  letterSpacing: 4,
                  borderWidth: 1,
                  borderColor: deletePinError ? COLORS.error : COLORS.border,
                }}
                editable={!isDeletingOrder}
              />

              <Text
                style={{
                  color: COLORS.text,
                  fontSize: FONT_SIZE.sm,
                  marginTop: 12,
                  marginBottom: 4,
                  fontWeight: FONT_WEIGHT.bold,
                }}
              >
                Motivo (opcional):
              </Text>
              <TextInput
                value={deleteReason}
                onChangeText={setDeleteReason}
                placeholder="Ej: cliente cancelo"
                placeholderTextColor={COLORS.textSecondary}
                style={{
                  backgroundColor: COLORS.surface,
                  color: COLORS.text,
                  borderRadius: BORDER_RADIUS.md,
                  padding: SPACING.md,
                  fontSize: FONT_SIZE.md,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
                editable={!isDeletingOrder}
              />

              {deletePinError ? (
                <Text
                  style={{
                    color: COLORS.error,
                    fontSize: FONT_SIZE.sm,
                    marginTop: 8,
                  }}
                >
                  {deletePinError}
                </Text>
              ) : null}

              <Button
                variant="danger"
                size="md"
                label="Confirmar eliminacion"
                loading={isDeletingOrder}
                disabled={isDeletingOrder}
                onPress={() => void handleDeleteOrder()}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: quitar item ya comandado con PIN admin/manager + motivo */}
      <Modal
        visible={itemPinModal.isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isAuthorizingItem) itemPinModal.close();
        }}
      >
        <View style={styles.waiterModalOverlay}>
          <View style={styles.waiterModalContent}>
            <View style={styles.waiterModalHeader}>
              <Text style={styles.waiterModalTitle}>
                Autorización requerida
              </Text>
              <TouchableOpacity
                onPress={() => itemPinModal.close()}
                activeOpacity={0.7}
                disabled={isAuthorizingItem}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: SPACING.md }}>
              <Text
                style={{
                  color: COLORS.textSecondary,
                  fontSize: FONT_SIZE.sm,
                  marginBottom: 12,
                }}
              >
                {pendingRemoveIndex !== null && order?.items[pendingRemoveIndex]
                  ? `"${
                      order.items[pendingRemoveIndex].productName || 'Producto'
                    }" ya fue comandado a cocina/barra. Quitarlo requiere PIN de admin/manager y un motivo.`
                  : 'Quitar un producto ya comandado requiere PIN de admin/manager y un motivo.'}
              </Text>

              <Text
                style={{
                  color: COLORS.text,
                  fontSize: FONT_SIZE.sm,
                  marginBottom: 4,
                  fontWeight: FONT_WEIGHT.bold,
                }}
              >
                Motivo *
              </Text>
              <TextInput
                value={itemPinReason}
                onChangeText={setItemPinReason}
                placeholder="Ej: cambio de presentación / no se despachó"
                placeholderTextColor={COLORS.textSecondary}
                style={{
                  backgroundColor: COLORS.surface,
                  color: COLORS.text,
                  borderRadius: BORDER_RADIUS.md,
                  padding: SPACING.md,
                  fontSize: FONT_SIZE.md,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
                editable={!isAuthorizingItem}
              />

              <Text
                style={{
                  color: COLORS.text,
                  fontSize: FONT_SIZE.sm,
                  marginTop: 12,
                  marginBottom: 4,
                  fontWeight: FONT_WEIGHT.bold,
                }}
              >
                PIN admin / manager *
              </Text>
              <TextInput
                value={itemPinValue}
                onChangeText={setItemPinValue}
                placeholder="••••"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
                keyboardType="number-pad"
                style={{
                  backgroundColor: COLORS.surface,
                  color: COLORS.text,
                  borderRadius: BORDER_RADIUS.md,
                  padding: SPACING.md,
                  fontSize: FONT_SIZE.lg,
                  textAlign: 'center',
                  letterSpacing: 4,
                  borderWidth: 1,
                  borderColor: itemPinError ? COLORS.error : COLORS.border,
                }}
                editable={!isAuthorizingItem}
              />

              {itemPinError ? (
                <Text
                  style={{
                    color: COLORS.error,
                    fontSize: FONT_SIZE.sm,
                    marginTop: 8,
                  }}
                >
                  {itemPinError}
                </Text>
              ) : null}

              <Button
                variant="danger"
                size="md"
                label="Autorizar y quitar"
                loading={isAuthorizingItem}
                disabled={
                  isAuthorizingItem ||
                  !itemPinValue.trim() ||
                  !itemPinReason.trim()
                }
                onPress={() => void confirmRemoveItemWithPin()}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Selector de Mesonero (Admin) */}
      <Modal
        visible={waiterModal.isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => waiterModal.close()}
      >
        <View style={styles.waiterModalOverlay}>
          <View style={styles.waiterModalContent}>
            <View style={styles.waiterModalHeader}>
              <Text style={styles.waiterModalTitle}>Asignar mesonero</Text>
              <TouchableOpacity
                onPress={() => waiterModal.close()}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {isLoadingWaiters ? (
              <View style={styles.waiterModalLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.waiterModalLoadingText}>
                  Cargando mesoneros...
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.waiterModalList} bounces={false}>
                {waiterOptions.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.waiterModalOption,
                      order?.waiterId === w.id &&
                        styles.waiterModalOptionActive,
                    ]}
                    onPress={() => void handleSelectWaiter(w)}
                    activeOpacity={0.7}
                    disabled={isUpdatingWaiter}
                  >
                    <View
                      style={[
                        styles.waiterModalOptionIcon,
                        order?.waiterId === w.id &&
                          styles.waiterModalOptionIconActive,
                      ]}
                    >
                      <Ionicons
                        name={
                          order?.waiterId === w.id
                            ? 'checkmark-circle'
                            : 'person-outline'
                        }
                        size={18}
                        color={
                          order?.waiterId === w.id
                            ? COLORS.success
                            : COLORS.textSecondary
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.waiterModalOptionText,
                        order?.waiterId === w.id &&
                          styles.waiterModalOptionTextActive,
                      ]}
                    >
                      {w.name}
                    </Text>
                  </TouchableOpacity>
                ))}

                {order?.waiterId && (
                  <>
                    <View style={styles.waiterModalDivider} />
                    <TouchableOpacity
                      style={styles.waiterModalRemoveOption}
                      onPress={() => void handleSelectWaiter(null)}
                      activeOpacity={0.7}
                      disabled={isUpdatingWaiter}
                    >
                      <View style={styles.waiterModalRemoveIcon}>
                        <Ionicons
                          name="close-circle-outline"
                          size={18}
                          color={COLORS.error}
                        />
                      </View>
                      <Text style={styles.waiterModalRemoveText}>
                        Quitar mesonero
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            )}

            {isUpdatingWaiter && (
              <View style={styles.waiterModalUpdating}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.waiterModalLoadingText}>
                  Actualizando...
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal PIN de autorización */}
      <Modal
        visible={revertPinModal.isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => revertPinModal.close()}
      >
        <View style={styles.pinModalOverlay}>
          <View style={styles.pinModalContent}>
            <View style={styles.pinModalIcon}>
              <Ionicons
                name="shield-checkmark"
                size={32}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.pinModalTitle}>Autorización requerida</Text>
            <Text style={styles.pinModalSubtitle}>
              Ingresa el PIN de un administrador para revertir la entrega
            </Text>

            <TextInput
              style={styles.pinInput}
              value={pinValue}
              onChangeText={(text) => {
                setPinValue(text);
                setPinError('');
              }}
              placeholder="PIN de autorización"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              autoFocus
              maxLength={6}
            />

            {pinError !== '' && (
              <Text style={styles.pinErrorText}>{pinError}</Text>
            )}

            <View style={styles.pinModalButtons}>
              <TouchableOpacity
                style={styles.pinCancelButton}
                onPress={() => revertPinModal.close()}
                activeOpacity={0.7}
              >
                <Text style={styles.pinCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pinConfirmButton,
                  isValidatingPin && styles.pinButtonDisabled,
                ]}
                onPress={handlePinSubmit}
                activeOpacity={0.7}
                disabled={isValidatingPin}
              >
                {isValidatingPin ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <Text style={styles.pinConfirmText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para asociar/cambiar cliente de la orden */}
      <CustomerSelectModal
        visible={customerModal.isOpen}
        onClose={() => customerModal.close()}
        onSelect={(customer) => {
          void handleSelectCustomer(customer);
        }}
      />

      <FichaQrModal
        visible={fichaQrModal.isOpen}
        orderId={order?.id ?? null}
        onClose={() => fichaQrModal.close()}
      />

      {/* Modal Selección de Conversión a Packs */}
      <Modal
        visible={packConversionModal.isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => packConversionModal.close()}
      >
        <View style={styles.pinModalOverlay}>
          <View style={styles.pinModalContent}>
            <View style={styles.pinModalIcon}>
              <Ionicons name="beer" size={32} color="COLORS.primaryDark" />
            </View>
            <Text style={styles.pinModalTitle}>Convertir a Tobo / Pack</Text>
            <Text style={styles.pinModalSubtitle}>
              Selecciona el pack al que deseas consolidar las cervezas
              entregadas:
            </Text>

            <View style={{ width: '100%', marginVertical: 12, gap: 8 }}>
              {conversionOptions.map((opt, idx) => (
                <TouchableOpacity
                  key={`${opt.sourceProductId}-${opt.targetPackId}-${idx}`}
                  style={{
                    backgroundColor: COLORS.surface,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 10,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={() => {
                    void handleExecuteConversion(opt);
                  }}
                  disabled={isConvertingPacks}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: '700',
                        fontSize: 14,
                        color: COLORS.text,
                      }}
                    >
                      {packsElegidos[claveDeOpcion(opt)] ?? 1} {opt.packName}
                      {'  '}
                      <Text style={{ fontWeight: '400' }}>
                        ${opt.packPrice.toFixed(2)} c/u
                      </Text>
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: COLORS.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {opt.currentDeliveredQty} de {opt.sourceProductName}{' '}
                      entregadas · ahorra $
                      {(
                        opt.savingsUsd *
                        (packsElegidos[claveDeOpcion(opt)] ?? 1)
                      ).toFixed(2)}
                    </Text>

                    {opt.numPacksPossible > 1 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 6,
                          marginTop: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        {Array.from(
                          { length: opt.numPacksPossible },
                          (_, i) => i + 1,
                        ).map((n) => {
                          const elegido =
                            (packsElegidos[claveDeOpcion(opt)] ?? 1) === n;
                          return (
                            <TouchableOpacity
                              key={n}
                              onPress={() =>
                                setPacksElegidos((prev) => ({
                                  ...prev,
                                  [claveDeOpcion(opt)]: n,
                                }))
                              }
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: elegido
                                  ? COLORS.primary
                                  : COLORS.border,
                                backgroundColor: elegido
                                  ? COLORS.primary
                                  : 'transparent',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: '700',
                                  color: elegido ? '#fff' : COLORS.text,
                                }}
                              >
                                {n}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.pinModalButtons}>
              <TouchableOpacity
                style={styles.pinCancelButton}
                onPress={() => packConversionModal.close()}
                activeOpacity={0.7}
              >
                <Text style={styles.pinCancelText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: SPACING.md,
    paddingBottom: SPACING.xxxl,
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
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.error}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  errorTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  errorSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Status Card
  statusCard: {
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  statusCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  statusIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    flexShrink: 0,
  },
  statusInfo: {
    flex: 1,
    flexShrink: 1,
  },
  statusLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.xs,
  },
  statusDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 0,
  },
  infoLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: `${COLORS.primary}25`,
    ...SHADOWS.small,
  },
  chatButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButtonText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  itemsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  itemQuantityBadge: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    flexShrink: 0,
  },
  itemQuantityText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
    flexShrink: 1,
  },
  itemUnitPrice: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.semibold,
    flexShrink: 0,
    marginLeft: SPACING.sm,
  },
  removeItemButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.error}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    flexShrink: 0,
  },
  itemDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  totalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  totalLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  totalValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
  },
  grandTotalLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  grandTotalValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  deliveryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginLeft: 34 + SPACING.md,
  },
  deliveryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
    flex: 1,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  deliveryBadgeGreen: {
    backgroundColor: `${COLORS.success}15`,
  },
  deliveryBadgeOrange: {
    backgroundColor: `${COLORS.warning}15`,
  },
  deliveryBadgeGray: {
    backgroundColor: `${COLORS.textSecondary}15`,
  },
  deliveryBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  deliveryMarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: `${COLORS.success}30`,
  },
  deliveryMarkText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.success,
  },
  avisoAgregar: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avisoAgregarTexto: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  addItemsButton: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  addItemsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  addItemsButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  fichaButton: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  fichaButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  notesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  notesText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  // Cliente: chips de asociar/cambiar
  customerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 1,
  },
  customerEditChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: `${COLORS.primary}50`,
  },
  customerEditChipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  customerAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: `${COLORS.primary}12`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}50`,
  },
  customerAddChipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  // Takeaway chip
  takeawayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  takeawayChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  takeawayChipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  takeawayChipTextActive: {
    color: COLORS.background,
  },
  // Revert button
  revertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${COLORS.error}12`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  revertButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.error,
  },
  // Waiter selector
  waiterSelectorValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  waiterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  waiterModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: '60%',
    paddingBottom: SPACING.xl,
  },
  waiterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  waiterModalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  waiterModalLoading: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  waiterModalLoadingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  waiterModalList: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  waiterModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.md,
  },
  waiterModalOptionActive: {
    backgroundColor: `${COLORS.success}10`,
  },
  waiterModalOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.textSecondary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waiterModalOptionIconActive: {
    backgroundColor: `${COLORS.success}15`,
  },
  waiterModalOptionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
  },
  waiterModalOptionTextActive: {
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.bold,
  },
  waiterModalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
  },
  waiterModalRemoveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.md,
  },
  waiterModalRemoveIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.error}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waiterModalRemoveText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.error,
    fontWeight: FONT_WEIGHT.semibold,
  },
  waiterModalUpdating: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  // PIN Modal
  pinModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  pinModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  pinModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  pinModalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  pinModalSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  pinInput: {
    width: '100%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: FONT_WEIGHT.bold,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pinErrorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  pinModalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    width: '100%',
  },
  pinCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pinCancelText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  pinConfirmButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  pinButtonDisabled: {
    opacity: 0.6,
  },
  pinConfirmText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
});

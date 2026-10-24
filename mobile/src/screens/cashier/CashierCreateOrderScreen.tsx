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
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  SHADOWS,
  BORDER_RADIUS,
} from '../../constants';
import {
  productService,
  orderService,
  printQueueService,
  tableService,
  availabilityService,
  computePackaging,
  createPackagingItems,
  PACKAGING,
} from '../../services';
import { useProductosDelMenu, useCategorias } from '../../queries/useCatalogo';
import { enqueuePrintFicha } from '../../services/printQueueService';
import { genClientRequestId } from '../../services/orderService';
import { waiterAssignmentService } from '../../services/waiterAssignmentService';
import { cashRegisterService } from '../../services/cashRegisterService';
import {
  Product,
  Category,
  ZoneSectorEnum,
  OrderTypeEnum,
  ProductTypeEnum,
  CurrencyEnum,
} from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useWaiterOrderStore, useAuthStore } from '../../store';
import { showAlert } from '../../utils/alert';
import { avisoDisponibilidad } from '../../utils/confirmarSiAgotado';
import { AvailabilityStatus } from '../../services/availabilityService';
import { ToboComposeModal } from '../../components';
import { getToboConfig, ToboContainer } from '../../constants/toboRegistry';
import { useBusquedaDeProductos } from '../../hooks/useBusquedaDeProductos';
import { useTarifas, useVocab } from '../../config/hooks';
import { pctTexto, totalesDeSubtotal } from '../../config/totalesDeOrden';
import { COMANDA_AL_PAGAR } from '../../config/funciones';

const SECTOR_LABELS: Record<ZoneSectorEnum, string> = {
  [ZoneSectorEnum.EVENTO]: '\u{1F389} Evento',
  [ZoneSectorEnum.PISCINA]: '\u{1F3CA} Piscina',
  [ZoneSectorEnum.TENIS]: '\u{1F3BE} Tenis',
  [ZoneSectorEnum.FUTBOL]: '\u26BD Futbol',
  [ZoneSectorEnum.BEISBOL]: '\u26BE Beisbol',
  [ZoneSectorEnum.SALON_PRINCIPAL]: '\u{1F3DB}\uFE0F Salon Principal',
  [ZoneSectorEnum.CANCHAS]: '\u{1F3DF}\uFE0F Canchas',
};

interface WaiterOption {
  waiterId: string;
  waiterName: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'CashierCreateOrder'>;

export const CashierCreateOrderScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const tarifas = useTarifas();
  const vocab = useVocab();
  const { tableId, tableName, sector: sectorParam } = route.params ?? {};
  const sector = sectorParam as ZoneSectorEnum | undefined;
  const isZoneMode = !!sector && !tableId;
  const user = useAuthStore((s) => s.user);

  const {
    items,
    notes,
    addItem,
    addComposedItem,
    removeItem,
    updateQuantity,
    setItemNotes,
    setTable,
    setSector,
    setNotes,
    getSubtotal,
    getItemCount,
    clearOrder,
  } = useWaiterOrderStore();

  // Tobo mixto en composición
  const [composeTarget, setComposeTarget] = useState<{
    product: Product;
    totalUnits: number;
    container: ToboContainer;
  } | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState('__all__');
  const [searchText, setSearchText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, AvailabilityStatus>
  >({});

  // Waiter picker state
  const [availableWaiters, setAvailableWaiters] = useState<WaiterOption[]>([]);
  const [selectedWaiter, setSelectedWaiter] = useState<WaiterOption | null>(
    null,
  );
  const [showWaiterPicker, setShowWaiterPicker] = useState(false);
  const [orderType, setOrderType] = useState<OrderTypeEnum | null>(null);
  const packagingItemsRef = useRef<Set<string>>(new Set());

  const { data: products = [], isLoading } = useProductosDelMenu();
  const { data: categories = [] } = useCategorias();

  const orderCreatedRef = useRef(false);
  // Idempotencia: un id por intento de checkout — reintentos por mala red no
  // duplican la orden (el backend devuelve la ya creada).
  const checkoutRequestIdRef = useRef(genClientRequestId());

  useEffect(() => {
    if (isZoneMode && sector) {
      setSector(sector);
    } else if (tableId && tableName) {
      setTable(tableId, tableName);
    }
    return () => {
      clearOrder();
    };
  }, [tableId, tableName, sector, isZoneMode, setTable, setSector, clearOrder]);

  // Heartbeat del claim de mesa mientras el cajero arma el pedido;
  // release automatico al salir sin crear orden.
  useEffect(() => {
    if (isZoneMode || !tableId) return;
    const waiterId = user?.uid;
    if (!waiterId) return;

    void tableService.heartbeatTable(tableId, waiterId);
    const iv = setInterval(() => {
      void tableService.heartbeatTable(tableId, waiterId);
    }, 60_000);

    return () => {
      clearInterval(iv);
      if (!orderCreatedRef.current) {
        void tableService.releaseTable(tableId, waiterId);
      }
    };
  }, [isZoneMode, tableId, user?.uid]);

  const loadData = useCallback(async () => {
    try {
      const [waiters, availability] = await Promise.all([
        waiterAssignmentService.getActiveWaiters(),
        availabilityService.checkAvailability(''),
      ]);
      setAvailableWaiters(waiters);
      // Convertir Map a Record para el state
      const map: Record<string, AvailabilityStatus> = {};
      for (const [productId, status] of availability.entries()) {
        map[productId] = status;
      }
      setAvailabilityMap(map);
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // La categoria se filtra aca; buscar lo resuelve el hook, que mira primero
  // lo que ya esta cargado y solo pregunta al servidor si no encuentra nada.
  const deLaCategoria = useMemo(
    () =>
      selectedCategoryId === '__all__'
        ? products
        : products.filter((p) => p.categoryId === selectedCategoryId),
    [products, selectedCategoryId],
  );
  const { resultados: filteredProducts, buscandoEnServidor } =
    useBusquedaDeProductos(deLaCategoria, searchText);

  const getItemQuantity = (productId: string): number => {
    const item = items.find((i) => i.product.id === productId);
    return item?.quantity ?? 0;
  };

  const handleAddProduct = useCallback(
    (product: Product) => {
      const tobo = getToboConfig(product.id);

      const handleAdd = () => {
        if (tobo) {
          setComposeTarget({
            product,
            totalUnits: tobo.totalUnits,
            container: tobo.container,
          });
          return;
        }
        addItem(product);
      };

      // Avisar, NUNCA bloquear: si falta algo lo más probable es que no se haya
      // cargado la compra. El cajero decide, con el dato delante.
      const aviso = avisoDisponibilidad(availabilityMap[product.id]);
      if (aviso) {
        Alert.alert('Disponibilidad', aviso, [
          { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
          { text: 'Vender de todas formas', onPress: handleAdd },
        ]);
      } else {
        handleAdd();
      }
    },
    [addItem, availabilityMap],
  );

  const handleRemoveProduct = (productId: string) => {
    const qty = getItemQuantity(productId);
    if (qty <= 1) {
      removeItem(productId);
    } else {
      updateQuantity(productId, qty - 1);
    }
  };

  const handleOrderTypeChange = useCallback(
    (newOrderType: OrderTypeEnum | null) => {
      setOrderType(newOrderType);

      // Si cambia a "Para llevar", agregar envases automáticamente
      if (newOrderType === OrderTypeEnum.Takeaway) {
        // Crear lookup de productos
        const productLookup = (productId: string) => {
          const cartItem = items.find((ci) => ci.product.id === productId);
          if (!cartItem) return undefined;
          return {
            categoryId: cartItem.product.categoryId,
            station: cartItem.product.station,
            name: cartItem.product.name,
          };
        };

        // Calcular packaging necesario (excluyendo items de packaging ya presentes)
        const nonPackagingItems = items.filter(
          (ci) =>
            ci.product.id !== PACKAGING.envase.productId &&
            ci.product.id !== PACKAGING.cajaPizza.productId,
        );
        const packagingResult = computePackaging(
          nonPackagingItems,
          productLookup,
        );
        const packagingItems = createPackagingItems(packagingResult);

        // Agregar cada item de packaging
        packagingItems.forEach((pkgItem) => {
          addItem(
            {
              id: pkgItem.productId,
              name: pkgItem.productName,
              price: pkgItem.unitPrice,
              currency: CurrencyEnum.USD,
              type: ProductTypeEnum.BASE,
              categoryId: 'packaging',
              isActive: true,
              isForSale: true,
              stock: 999,
              station: 'KITCHEN',
            } as Product,
            pkgItem.quantity,
          );
          packagingItemsRef.current.add(pkgItem.productId);
        });
      } else {
        // Si cambia a "En local" o sin seleccionar, eliminar los items de packaging
        packagingItemsRef.current.forEach((packagingId) => {
          const qty = getItemQuantity(packagingId);
          if (qty > 0) {
            removeItem(packagingId);
          }
        });
        packagingItemsRef.current.clear();
      }
    },
    [items, addItem, removeItem, getItemQuantity],
  );

  const createOrderAndComanda = async (): Promise<string | null> => {
    if (items.length === 0) {
      showAlert('Sin productos', 'Agrega al menos un producto');
      return null;
    }
    if (orderType === null) {
      showAlert(
        'Tipo de pedido requerido',
        'Indica si el pedido es para llevar o en local',
      );
      return null;
    }
    if (!user) {
      showAlert('Error', 'No se pudo identificar al cajero');
      return null;
    }

    // createCashierOrder reserva la mesa atomicamente en el backend
    // (aceptando un claim previo del mismo waiter/cajero).
    const isTakeaway = orderType === OrderTypeEnum.Takeaway;
    const newOrderId = await orderService.createCashierOrder(user.uid, items, {
      tableId: isZoneMode ? undefined : tableId,
      tableName: isZoneMode ? undefined : tableName,
      notes: notes || undefined,
      sector,
      isTakeaway,
      waiterId: selectedWaiter?.waiterId,
      waiterName: selectedWaiter?.waiterName,
      clientRequestId: checkoutRequestIdRef.current,
    });
    orderCreatedRef.current = true;
    // Orden creada: el proximo checkout desde esta pantalla es otro pedido
    checkoutRequestIdRef.current = genClientRequestId();

    // Comanda y ficha de barra: con COMANDA_AL_PAGAR salen al cobrar (comanda
    // al cobrar en CashierPaymentScreen), no al crear el pedido.
    if (!COMANDA_AL_PAGAR) {
      // Encolar comanda para impresion
      const comandaItems = items.map((ci) => ({
        productId: ci.product.id,
        productName: ci.product.name,
        quantity: ci.quantity,
        unitPrice: ci.product.price,
        totalPrice: ci.product.price * ci.quantity,
        notes: ci.notes ?? null,
        station: ci.product.station ?? null,
      }));
      printQueueService
        .enqueuePrintComanda(
          {
            id: newOrderId,
            tableId,
            tableName,
            sector: sector ?? null,
            orderType,
            notes: notes ?? null,
          },
          comandaItems,
          {
            waiterName: selectedWaiter?.waiterName ?? undefined,
            cajaSummary: true,
          },
        )
        .catch((err) =>
          console.error('[PrintQueue] Error encolando comanda:', err),
        );

      // Ficha de barra (QR + saldo). No bloquea el flujo.
      enqueuePrintFicha(newOrderId, {
        waiterName: selectedWaiter?.waiterName ?? undefined,
      }).catch(() => {});
    }

    // Log event en sesion de caja activa
    cashRegisterService
      .getActiveSession(user.uid)
      .then((session) => {
        if (session) {
          const locationLabel =
            isZoneMode && sector ? sector : (tableName ?? 'Para llevar');
          cashRegisterService
            .logEvent(session.id, {
              type: 'order_created',
              description: `Orden #${newOrderId.slice(-6).toUpperCase()} creada para ${locationLabel}`,
              orderId: newOrderId,
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    return newOrderId;
  };

  const handleSendOrder = async () => {
    setIsSending(true);
    try {
      const orderId = await createOrderAndComanda();
      if (!orderId) {
        setIsSending(false);
        return;
      }

      clearOrder();
      const locationLabel =
        isZoneMode && sector
          ? SECTOR_LABELS[sector]
          : (tableName ?? 'Para llevar');
      showAlert('Pedido enviado', `Pedido registrado para ${locationLabel}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      showAlert('Error', 'No se pudo enviar el pedido. Intenta de nuevo.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendAndCharge = async () => {
    setIsSending(true);
    try {
      const orderId = await createOrderAndComanda();
      if (!orderId) {
        setIsSending(false);
        return;
      }

      clearOrder();
      navigation.replace('CashierPayment', {
        orderId,
        tableId: isZoneMode ? undefined : tableId,
        nuevoPedido: true,
      });
    } catch {
      showAlert('Error', 'No se pudo enviar el pedido. Intenta de nuevo.');
    } finally {
      setIsSending(false);
    }
  };

  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const { serviceCharge, total: totalWithService } = totalesDeSubtotal(
    subtotal,
    !!selectedWaiter,
    tarifas,
  );
  const pctServicio = pctTexto(tarifas.serviceRate);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons
            name="restaurant-outline"
            size={36}
            color={COLORS.primary}
          />
        </View>
        <Text style={styles.loadingText}>Cargando productos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Encabezado de mesa/zona */}
      <View style={styles.tableHeader}>
        <View style={styles.tableHeaderLeft}>
          <View style={styles.tableIconContainer}>
            <Ionicons
              name={isZoneMode ? 'map-outline' : 'restaurant-outline'}
              size={18}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.tableHeaderText}>
            {isZoneMode && sector
              ? SECTOR_LABELS[sector]
              : (tableName ?? 'Para llevar')}
          </Text>
        </View>
        {itemCount > 0 && (
          <View style={styles.itemCountBadge}>
            <Text style={styles.itemCountText}>
              {itemCount} producto{itemCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Selector de mesonero */}
      <TouchableOpacity
        style={styles.waiterSelector}
        onPress={() => setShowWaiterPicker(true)}
        activeOpacity={0.8}
      >
        <Ionicons
          name="person-outline"
          size={18}
          color={selectedWaiter ? COLORS.primary : COLORS.textSecondary}
        />
        <Text
          style={[
            styles.waiterSelectorText,
            selectedWaiter && styles.waiterSelectorTextActive,
          ]}
        >
          {selectedWaiter
            ? selectedWaiter.waiterName
            : `Sin ${vocab.waiter.toLowerCase()} (sin servicio ${pctServicio}%)`}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Selector obligatorio: En local / Para llevar */}
      <View style={styles.orderTypeSelectorContainer}>
        <Text style={styles.orderTypeSelectorLabel}>Tipo de pedido</Text>
        <View style={styles.orderTypeButtonsRow}>
          <TouchableOpacity
            style={[
              styles.orderTypeButton,
              orderType === OrderTypeEnum.DineIn &&
                styles.orderTypeButtonSelected,
              orderType === null && styles.orderTypeButtonUnselected,
            ]}
            onPress={() => handleOrderTypeChange(OrderTypeEnum.DineIn)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="restaurant"
              size={18}
              color={
                orderType === OrderTypeEnum.DineIn
                  ? COLORS.background
                  : COLORS.textSecondary
              }
            />
            <Text
              style={[
                styles.orderTypeButtonText,
                orderType === OrderTypeEnum.DineIn &&
                  styles.orderTypeButtonTextSelected,
              ]}
            >
              En local
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.orderTypeButton,
              orderType === OrderTypeEnum.Takeaway &&
                styles.orderTypeButtonSelected,
              orderType === null && styles.orderTypeButtonUnselected,
            ]}
            onPress={() => handleOrderTypeChange(OrderTypeEnum.Takeaway)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="bag"
              size={18}
              color={
                orderType === OrderTypeEnum.Takeaway
                  ? COLORS.background
                  : COLORS.textSecondary
              }
            />
            <Text
              style={[
                styles.orderTypeButtonText,
                orderType === OrderTypeEnum.Takeaway &&
                  styles.orderTypeButtonTextSelected,
              ]}
            >
              Para llevar
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Busqueda */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Buscar productos..."
          placeholderTextColor={COLORS.textSecondary}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons
              name="close-circle"
              size={18}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtro de categorias */}
      <View style={styles.pillsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContent}
        >
          <TouchableOpacity
            style={[
              styles.pill,
              selectedCategoryId === '__all__' && styles.pillSelected,
            ]}
            onPress={() => setSelectedCategoryId('__all__')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillText,
                selectedCategoryId === '__all__' && styles.pillTextSelected,
              ]}
            >
              Todas
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.pill,
                selectedCategoryId === cat.id && styles.pillSelected,
              ]}
              onPress={() => setSelectedCategoryId(cat.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.pillText,
                  selectedCategoryId === cat.id && styles.pillTextSelected,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Carrito de ítems agregados con notas por ítem */}
      {itemCount > 0 && (
        <ScrollView
          style={styles.cartItemsContainer}
          showsVerticalScrollIndicator={false}
        >
          {items.map((cartItem, idx) => (
            <View
              key={`${cartItem.product.id}-${idx}`}
              style={styles.cartItemCard}
            >
              <View style={styles.cartItemHeader}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName} numberOfLines={2}>
                    {cartItem.product.name}
                  </Text>
                  <Text style={styles.cartItemQuantity}>
                    Cantidad: {cartItem.quantity}
                  </Text>
                </View>
              </View>
              <TextInput
                style={styles.cartItemNoteInput}
                value={cartItem.notes ?? ''}
                onChangeText={(text) => setItemNotes(idx, text)}
                placeholder="Ej: sin hielo, bien frío"
                placeholderTextColor={COLORS.textSecondary}
                multiline
                maxLength={200}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Lista de productos */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.productList}
        renderItem={({ item }) => {
          const qty = getItemQuantity(item.id);
          return (
            <View
              style={[styles.productRow, qty > 0 && styles.productRowSelected]}
            >
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.productPrice}>
                  ${item.price.toFixed(2)}
                </Text>
              </View>
              <View style={styles.quantityControls}>
                {qty > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => handleRemoveProduct(item.id)}
                    >
                      <Ionicons name="remove" size={16} color={COLORS.error} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{qty}</Text>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.qtyButton, styles.addButton]}
                  onPress={() => handleAddProduct(item)}
                >
                  <Ionicons name="add" size={16} color={COLORS.background} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {buscandoEnServidor
              ? 'Buscando en el catálogo…'
              : searchText
                ? 'Sin resultados para tu busqueda'
                : 'No se encontraron productos'}
          </Text>
        }
      />

      {/* Notas */}
      {itemCount > 0 && (
        <View style={styles.notesContainer}>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notas del pedido (opcional)..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
          />
        </View>
      )}

      {/* Footer con resumen y botones */}
      {itemCount > 0 && (
        <View style={styles.footer}>
          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})
              </Text>
              <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
            </View>
            {selectedWaiter && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Servicio {pctServicio}% ({selectedWaiter.waiterName})
                </Text>
                <Text style={styles.summaryValue}>
                  ${serviceCharge.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                ${totalWithService.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.buttonsRow}>
            {/* Con COMANDA_AL_PAGAR no hay "Enviar" sin cobrar: todo pedido nuevo va al cobro */}
            {!COMANDA_AL_PAGAR && (
              <View
                style={[
                  styles.sendButtonWrapper,
                  isSending && styles.sendButtonWrapperDisabled,
                  { flex: 1 },
                ]}
              >
                <TouchableOpacity
                  onPress={handleSendOrder}
                  disabled={isSending}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={[COLORS.gradientStart, COLORS.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sendButton}
                  >
                    {isSending ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.background}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="send"
                          size={16}
                          color={COLORS.background}
                        />
                        <Text style={styles.sendButtonText}>Enviar</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            <View
              style={[
                styles.sendButtonWrapper,
                isSending && styles.sendButtonWrapperDisabled,
                { flex: 1 },
              ]}
            >
              <TouchableOpacity
                onPress={handleSendAndCharge}
                disabled={isSending}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[COLORS.success, COLORS.successLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendButton}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color={COLORS.background} />
                  ) : (
                    <>
                      <Ionicons
                        name="cash-outline"
                        size={16}
                        color={COLORS.background}
                      />
                      <Text style={styles.sendButtonText}>Enviar y Cobrar</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal picker de mesonero */}
      <Modal
        visible={showWaiterPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWaiterPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWaiterPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Asignar {vocab.waiter}</Text>

            <TouchableOpacity
              style={[
                styles.waiterOption,
                !selectedWaiter && styles.waiterOptionSelected,
              ]}
              onPress={() => {
                setSelectedWaiter(null);
                setShowWaiterPicker(false);
              }}
            >
              <Ionicons
                name="close-circle-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <View style={styles.waiterOptionInfo}>
                <Text style={styles.waiterOptionName}>
                  Sin {vocab.waiter.toLowerCase()}
                </Text>
                <Text style={styles.waiterOptionDetail}>
                  Sin cargo de servicio ({pctServicio}%)
                </Text>
              </View>
              {!selectedWaiter && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>

            {availableWaiters.length === 0 ? (
              <Text style={styles.noWaitersText}>
                No hay mesoneros activos hoy
              </Text>
            ) : (
              availableWaiters.map((w) => (
                <TouchableOpacity
                  key={w.waiterId}
                  style={[
                    styles.waiterOption,
                    selectedWaiter?.waiterId === w.waiterId &&
                      styles.waiterOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedWaiter(w);
                    setShowWaiterPicker(false);
                  }}
                >
                  <Ionicons name="person" size={20} color={COLORS.primary} />
                  <View style={styles.waiterOptionInfo}>
                    <Text style={styles.waiterOptionName}>{w.waiterName}</Text>
                    <Text style={styles.waiterOptionDetail}>
                      +{pctServicio}% servicio
                    </Text>
                  </View>
                  {selectedWaiter?.waiterId === w.waiterId && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {composeTarget && (
        <ToboComposeModal
          visible
          productName={composeTarget.product.name}
          container={composeTarget.container}
          totalUnits={composeTarget.totalUnits}
          onClose={() => setComposeTarget(null)}
          onConfirm={(composition) => {
            addComposedItem(
              composeTarget.product,
              composeTarget.totalUnits,
              composition,
            );
            setComposeTarget(null);
          }}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.lg,
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
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  tableHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  tableIconContainer: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  itemCountBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  itemCountText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },

  // Waiter selector
  waiterSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  waiterSelectorText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  waiterSelectorTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },

  orderTypeSelectorContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  orderTypeSelectorLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  orderTypeButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  orderTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  orderTypeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  orderTypeButtonUnselected: {
    backgroundColor: COLORS.backgroundSecondary,
    borderColor: COLORS.border,
  },
  orderTypeButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  orderTypeButtonTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.semibold,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  pillsWrapper: {
    marginBottom: SPACING.sm,
  },
  pillsContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  pill: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  pillTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.semibold,
  },
  productList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  productRowSelected: {
    borderColor: `${COLORS.primary}40`,
    backgroundColor: `${COLORS.primary}05`,
  },
  productInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  productName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    marginBottom: 2,
  },
  productPrice: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: COLORS.primary,
  },
  qtyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    minWidth: 22,
    textAlign: 'center',
  },
  notesContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Carrito de ítems agregados
  cartItemsContainer: {
    maxHeight: 200,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: `${COLORS.primary}05`,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.primary}20`,
  },
  cartItemsTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  cartItemCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartItemHeader: {
    marginBottom: SPACING.sm,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  cartItemQuantity: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  cartItemNoteInput: {
    backgroundColor: `${COLORS.background}50`,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    minHeight: 60,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  footer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.medium,
    gap: SPACING.md,
  },
  summarySection: {
    gap: SPACING.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  totalLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  totalValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sendButtonWrapper: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
    borderRadius: BORDER_RADIUS.xl,
  },
  sendButtonWrapperDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  sendButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.xxxl,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  waiterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  waiterOptionSelected: {
    backgroundColor: `${COLORS.primary}10`,
  },
  waiterOptionInfo: {
    flex: 1,
  },
  waiterOptionName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  waiterOptionDetail: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  noWaitersText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});

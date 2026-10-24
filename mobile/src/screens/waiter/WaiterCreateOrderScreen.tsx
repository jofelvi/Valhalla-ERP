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
  computePackaging,
  createPackagingItems,
  PACKAGING,
} from '../../services';
import { enqueuePrintFicha } from '../../services/printQueueService';
import { pedidoCobrado } from '../../services/comandaAlPagar';
import { COMANDA_AL_PAGAR } from '../../config/funciones';
import { genClientRequestId } from '../../services/orderService';
import { useProductosDelMenu, useCategorias } from '../../queries/useCatalogo';
import {
  Product,
  Category,
  OrderItem,
  ZoneSectorEnum,
  OrderTypeEnum,
  ProductTypeEnum,
  CurrencyEnum,
} from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useWaiterOrderStore, useAuthStore } from '../../store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CustomerSelectModal,
  SelectedCustomer,
  ToboComposeModal,
} from '../../components';
import { Input } from '../../components/ui/Input';
import { getToboConfig, ToboContainer } from '../../constants/toboRegistry';
import { showAlert } from '../../utils/alert';
import { useBusquedaDeProductos } from '../../hooks/useBusquedaDeProductos';
import { useTarifas } from '../../config/hooks';
import { pctTexto, totalesDeSubtotal } from '../../config/totalesDeOrden';

import { useVocab } from '../../config/hooks';
const SECTOR_LABELS: Record<ZoneSectorEnum, string> = {
  [ZoneSectorEnum.EVENTO]: '\u{1F389} Evento',
  [ZoneSectorEnum.PISCINA]: '\u{1F3CA} Piscina',
  [ZoneSectorEnum.TENIS]: '\u{1F3BE} Tenis',
  [ZoneSectorEnum.FUTBOL]: '\u26BD Futbol',
  [ZoneSectorEnum.BEISBOL]: '\u26BE Beisbol',
  [ZoneSectorEnum.SALON_PRINCIPAL]: '\u{1F3DB}\uFE0F Salon Principal',
  [ZoneSectorEnum.CANCHAS]: '\u{1F3DF}\uFE0F Canchas',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'WaiterCreateOrder'>;

export const WaiterCreateOrderScreen: React.FC = () => {
  const vocab = useVocab();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const tarifas = useTarifas();
  const {
    tableId,
    tableName,
    sector: sectorParam,
    orderId,
    existingItems: existingItemsJson,
  } = route.params ?? {};
  const sector = sectorParam as ZoneSectorEnum | undefined;
  const isZoneMode = !!sector && !tableId;
  const isAddMode = !!orderId;
  const user = useAuthStore((s) => s.user);
  const customerProfile = useAuthStore((s) => s.customer);

  const existingOrderItems: OrderItem[] = useMemo(() => {
    if (!existingItemsJson) return [];
    try {
      return JSON.parse(existingItemsJson) as OrderItem[];
    } catch {
      return [];
    }
  }, [existingItemsJson]);

  const {
    items,
    notes,
    addItem,
    addComposedItem,
    removeItem,
    updateQuantity,
    setTable,
    setSector,
    setNotes,
    setItemNotes,
    getSubtotal,
    getItemCount,
    clearOrder,
  } = useWaiterOrderStore();

  // Tobo mixto en composición (abierto al tocar un tobo del registro)
  const [composeTarget, setComposeTarget] = useState<{
    product: Product;
    totalUnits: number;
    container: ToboContainer;
  } | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState('__all__');
  const [searchText, setSearchText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { data: products = [], isLoading } = useProductosDelMenu();
  const { data: categories = [] } = useCategorias();
  const [customerAlias, setCustomerAlias] = useState('');
  const [associateNumber, setAssociateNumber] = useState('');
  const [selectedCustomer, setSelectedCustomer] =
    useState<SelectedCustomer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [orderType, setOrderType] = useState<OrderTypeEnum | null>(null);
  const packagingItemsRef = useRef<Set<string>>(new Set());

  // Tracking de reserva de mesa: si el usuario sale sin crear orden,
  // liberamos la mesa. Si crea orden, orderCreatedRef evita el release.
  const orderCreatedRef = useRef(false);
  // Idempotencia: un id por intento de checkout. Si el envio falla por red y
  // el mesonero reintenta, el backend devuelve la misma orden (no duplica).
  const checkoutRequestIdRef = useRef(genClientRequestId());

  // Heartbeat al backend mientras esta pantalla monte y haya mesa reservada
  // en modo "crear orden nueva". En modo agregar items (isAddMode) la mesa
  // ya tiene orden y no aplica claim.
  useEffect(() => {
    if (isAddMode || isZoneMode || !tableId) return;
    const waiterId = user?.uid;
    if (!waiterId) return;

    // Un heartbeat inicial al entrar: renueva el claim que el TablesScreen
    // creo hace segundos, o lo extiende si el usuario llego por deep-link.
    void tableService.heartbeatTable(tableId, waiterId);
    const iv = setInterval(() => {
      void tableService.heartbeatTable(tableId, waiterId);
    }, 60_000);

    return () => {
      clearInterval(iv);
      // Al desmontar, si NO creo orden, liberamos la mesa.
      if (!orderCreatedRef.current) {
        void tableService.releaseTable(tableId, waiterId);
      }
    };
  }, [isAddMode, isZoneMode, tableId, user?.uid]);

  // Mostrar modal de cliente al iniciar (solo en modo crear, no al agregar items)
  useEffect(() => {
    if (!isAddMode) {
      setShowCustomerModal(true);
    }
  }, [isAddMode]);

  const handleCustomerSelected = (customer: SelectedCustomer) => {
    setShowCustomerModal(false);
    setSelectedCustomer(customer);
    // Replicar el patron de la web POS: alias = nombre del cliente,
    // associateNumber = numero de accion (con padding ya aplicado)
    setCustomerAlias(customer.name);
    if (customer.associateNumber) {
      setAssociateNumber(customer.associateNumber);
    }
  };

  useEffect(() => {
    if (isAddMode) {
      clearOrder();
      return;
    }
    if (isZoneMode && sector) {
      setSector(sector);
    } else if (tableId && tableName) {
      setTable(tableId, tableName);
    }
  }, [
    tableId,
    tableName,
    sector,
    isZoneMode,
    isAddMode,
    setTable,
    setSector,
    clearOrder,
  ]);

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

  const handleAddProduct = (product: Product) => {
    // Tobo mixto: abrir el selector de variantes en vez de agregar directo.
    const tobo = getToboConfig(product.id);
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

  const handleSendOrder = async () => {
    if (items.length === 0) {
      showAlert('Sin productos', 'Agrega al menos un producto');
      return;
    }

    // Validar que se haya seleccionado tipo de pedido (solo en modo crear, no agregar)
    if (!isAddMode && orderType === null) {
      showAlert(
        'Tipo de pedido requerido',
        'Indica si el pedido es para llevar o en local',
      );
      return;
    }

    // El cliente es obligatorio en toda orden nueva (mesa, zona y para llevar):
    // sin el, la orden no se puede cobrar a credito ni rastrear al socio.
    // En modo "agregar items" la orden ya existe y ya tiene su cliente.
    if (!isAddMode && !selectedCustomer) {
      showAlert(
        'Falta el cliente',
        'Toda orden debe tener un cliente asignado. Buscalo o registralo para continuar.',
      );
      setShowCustomerModal(true);
      return;
    }

    if (!user) {
      showAlert('Error', 'No se pudo identificar al mesonero');
      return;
    }

    setIsSending(true);
    try {
      if (isAddMode && orderId) {
        const count = getItemCount();
        await orderService.addItemsToOrder(
          orderId,
          existingOrderItems,
          items,
          notes || undefined,
        );

        // Obtener orderType del pedido existente para la comanda
        const existingOrder = await orderService.getOrderById(orderId);
        // Con COMANDA_AL_PAGAR, una orden sin cobrar no imprime nada aqui: los
        // items nuevos salen en la comanda cuando la orden se cobra.
        const comandaSaleAhora =
          !COMANDA_AL_PAGAR || pedidoCobrado(existingOrder?.paymentStatus);
        if (comandaSaleAhora) {
          // Encolar comanda para impresion (items nuevos)
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
                id: orderId,
                tableId,
                tableName,
                sector: existingOrder?.sector ?? sector ?? null,
                orderType: existingOrder?.orderType ?? null,
                notes: notes ?? existingOrder?.notes ?? null,
              },
              comandaItems,
              {
                waiterName:
                  customerProfile?.name ?? user.displayName ?? undefined,
              },
            )
            .catch((err) =>
              console.error('[PrintQueue] Error encolando comanda:', err),
            );
        }

        clearOrder();
        showAlert(
          'Productos agregados',
          `Se agregaron ${count} producto${count !== 1 ? 's' : ''} al pedido`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else {
        // createWaiterOrder reserva la mesa atomicamente en el backend
        // (aceptando un claim previo del mismo waiter). No hace falta un
        // updateTableStatus separado.
        // Convertir orderType a boolean isTakeaway para la API
        const isTakeaway = orderType === OrderTypeEnum.Takeaway;
        const newOrderId = await orderService.createWaiterOrder(
          user.uid,
          items,
          isZoneMode ? undefined : tableId,
          isZoneMode ? undefined : tableName,
          notes || undefined,
          sector,
          isTakeaway,
          customerProfile?.name ?? user.displayName ?? undefined,
          customerAlias.trim() || undefined,
          associateNumber.trim() || undefined,
          selectedCustomer
            ? { id: selectedCustomer.id, name: selectedCustomer.name }
            : null,
          checkoutRequestIdRef.current,
        );
        orderCreatedRef.current = true;
        // Orden creada: el proximo checkout desde esta pantalla es otro pedido
        checkoutRequestIdRef.current = genClientRequestId();

        // Con COMANDA_AL_PAGAR la comanda y la ficha salen al cobrar
        // (WaiterPaymentScreen), no al crear el pedido.
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
                waiterName:
                  customerProfile?.name ?? user.displayName ?? undefined,
                cajaSummary: true,
              },
            )
            .catch((err) =>
              console.error('[PrintQueue] Error encolando comanda:', err),
            );

          // Ficha de barra (QR + saldo). No bloquea el flujo.
          enqueuePrintFicha(newOrderId, {
            waiterName: customerProfile?.name ?? user.displayName ?? undefined,
          }).catch(() => {});
        }

        clearOrder();
        if (COMANDA_AL_PAGAR) {
          // Flujo directo al cobro. replace: el pedido no debe quedar en la pila.
          navigation.replace('WaiterPayment', {
            orderId: newOrderId,
            tableId: isZoneMode ? undefined : (tableId ?? undefined),
            nuevoPedido: true,
          });
        } else {
          const locationLabel =
            isZoneMode && sector ? SECTOR_LABELS[sector] : tableName;
          showAlert(
            '¡Pedido enviado!',
            `Pedido registrado para ${locationLabel}`,
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
        }
      }
    } catch (error) {
      // Backend puede rechazar con 400 'mesa ocupada' cuando otro mesonero
      // creo una orden en la misma mesa entre tanto. Mostrar el mensaje
      // real y ofrecer abrir la orden existente si aplica.
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : '';
      const tableTaken = /mesa ya tiene una orden activa/i.test(msg);
      if (tableTaken && tableId) {
        // Extraer el id corto de la orden bloqueadora para mensaje claro
        const match = msg.match(/#([A-Z0-9]+)/);
        const shortId = match?.[1] ?? '';
        showAlert(
          `${vocab.table} ya ocupada`,
          `Otro mesonero abrió una orden en esta mesa${
            shortId ? ` (#${shortId})` : ''
          }. ¿Quieres abrirla?`,
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
            {
              text: 'Abrir orden',
              onPress: async () => {
                try {
                  // Buscar la orden activa en esta mesa
                  const orders =
                    await orderService.getActiveOrdersByTable(tableId);
                  if (orders.length > 0) {
                    navigation.replace('OrderDetail', {
                      orderId: orders[0].id,
                    });
                  } else {
                    navigation.goBack();
                  }
                } catch {
                  navigation.goBack();
                }
              },
            },
          ],
        );
      } else {
        showAlert(
          'Error',
          msg ||
            (isAddMode
              ? 'No se pudieron agregar los productos. Intenta de nuevo.'
              : 'No se pudo enviar el pedido. Intenta de nuevo.'),
        );
      }
    } finally {
      setIsSending(false);
    }
  };

  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  // El mesonero es quien toma la orden: siempre lleva servicio (según la configuración).
  const { serviceCharge, total: totalWithService } = totalesDeSubtotal(
    subtotal,
    true,
    tarifas,
  );

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
      {/* Encabezado de mesa/zona/agregar */}
      <View style={styles.tableHeader}>
        <View style={styles.tableHeaderLeft}>
          <View style={styles.tableIconContainer}>
            <Ionicons
              name={
                isAddMode
                  ? 'add-circle-outline'
                  : isZoneMode
                    ? 'map-outline'
                    : 'restaurant-outline'
              }
              size={18}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.tableHeaderText}>
            {isAddMode && orderId
              ? `Agregar a #${orderId.slice(-6).toUpperCase()}`
              : isZoneMode && sector
                ? SECTOR_LABELS[sector]
                : tableName}
          </Text>
        </View>
        {itemCount > 0 && (
          <View style={styles.itemCountBadge}>
            <Text style={styles.itemCountText}>
              {isAddMode ? '+' : ''}
              {itemCount} nuevo{itemCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Selector obligatorio: En local / Para llevar - solo al crear pedido nuevo */}
      {!isAddMode && (
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
      )}

      {/* Cliente seleccionado (chip) - solo al crear */}
      {!isAddMode && (
        <TouchableOpacity
          style={[
            styles.customerChip,
            !selectedCustomer && styles.customerChipMissing,
          ]}
          onPress={() => setShowCustomerModal(true)}
        >
          <Ionicons
            name={selectedCustomer ? 'person-circle' : 'alert-circle-outline'}
            size={20}
            color={selectedCustomer ? COLORS.primary : COLORS.error}
          />
          <Text
            style={[
              styles.customerChipText,
              !selectedCustomer && styles.customerChipTextMissing,
            ]}
            numberOfLines={1}
          >
            {selectedCustomer
              ? `${selectedCustomer.name}${selectedCustomer.associateNumber ? ` · Socio #${selectedCustomer.associateNumber}` : ''}`
              : 'Asignar cliente (obligatorio)'}
          </Text>
          {selectedCustomer && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setSelectedCustomer(null);
                setAssociateNumber('');
              }}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )}

      {/* Alias del cliente — disponible al crear orden tanto en mesa como en zona.
          N° socio solo en zone mode (campo del club). */}
      {!isAddMode && (
        <View style={styles.aliasRow}>
          <View style={styles.aliasInputContainer}>
            <Ionicons
              name="person-outline"
              size={16}
              color={COLORS.textSecondary}
            />
            <TextInput
              style={styles.aliasInput}
              value={customerAlias}
              onChangeText={setCustomerAlias}
              placeholder="Alias del cliente..."
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
          {isZoneMode && (
            <View style={styles.associateInputContainer}>
              <Ionicons
                name="card-outline"
                size={16}
                color={COLORS.textSecondary}
              />
              <TextInput
                style={styles.aliasInput}
                value={associateNumber}
                onChangeText={setAssociateNumber}
                placeholder="N° socio"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
              />
            </View>
          )}
        </View>
      )}

      {/* Búsqueda */}
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

      {/* Filtro de categorías */}
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

      {/* Lista de productos con items existentes y notas integrados */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.productList,
          itemCount > 0 && styles.productListWithFooter,
        ]}
        ListHeaderComponent={
          isAddMode && existingOrderItems.length > 0 ? (
            <View style={styles.existingItemsSection}>
              <Text style={styles.existingItemsTitle}>
                Items actuales ({existingOrderItems.length})
              </Text>
              {existingOrderItems.map((item, index) => (
                <View key={`existing-${index}`} style={styles.existingItemRow}>
                  <View style={styles.existingItemQtyBadge}>
                    <Text style={styles.existingItemQtyText}>
                      {item.quantity}
                    </Text>
                  </View>
                  <Text style={styles.existingItemName} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={styles.existingItemPrice}>
                    ${(item.totalPrice ?? 0).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null
        }
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
        ListFooterComponent={
          itemCount > 0 ? (
            <View style={styles.notesContainer}>
              {/* Sección de notas por ítem del carrito */}
              <View style={styles.cartItemsSection}>
                <Text style={styles.cartItemsTitle}>Notas de items</Text>
                {items.map((cartItem, idx) => (
                  <View
                    key={`${cartItem.product.id}-${idx}`}
                    style={styles.cartItemNotesContainer}
                  >
                    <View style={styles.cartItemRow}>
                      <Text style={styles.cartItemName} numberOfLines={2}>
                        {cartItem.quantity}x {cartItem.product.name}
                      </Text>
                      <Text style={styles.cartItemPrice}>
                        $
                        {(cartItem.product.price * cartItem.quantity).toFixed(
                          2,
                        )}
                      </Text>
                    </View>
                    <Input
                      placeholder="Ej: sin hielo, bien frío"
                      value={cartItem.notes ?? ''}
                      onChangeText={(text) => setItemNotes(idx, text)}
                      multiline
                      numberOfLines={2}
                      style={{ minHeight: 60 }}
                    />
                  </View>
                ))}
              </View>

              {/* Notas de la orden */}
              <View style={styles.orderNotesSection}>
                <Text style={styles.orderNotesLabel}>Notas del pedido</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notas adicionales del pedido (opcional)..."
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                />
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {buscandoEnServidor
              ? 'Buscando en el catálogo…'
              : searchText
                ? 'Sin resultados para tu búsqueda'
                : 'No se encontraron productos'}
          </Text>
        }
      />

      {/* Footer con resumen y botón */}
      {itemCount > 0 && (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(SPACING.lg, insets.bottom + SPACING.sm) },
          ]}
        >
          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Subtotal ({itemCount} ítem{itemCount !== 1 ? 's' : ''})
              </Text>
              <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Servicio ({pctTexto(tarifas.serviceRate)}%)
              </Text>
              <Text style={styles.summaryValue}>
                ${serviceCharge.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                ${totalWithService.toFixed(2)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.sendButtonWrapper,
              isSending && styles.sendButtonWrapperDisabled,
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
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <>
                    <Ionicons
                      name={
                        isAddMode
                          ? 'add-circle'
                          : COMANDA_AL_PAGAR
                            ? 'cash-outline'
                            : 'send'
                      }
                      size={18}
                      color={COLORS.background}
                    />
                    <Text style={styles.sendButtonText}>
                      {isAddMode
                        ? 'Agregar Productos'
                        : COMANDA_AL_PAGAR
                          ? 'Ir a cobrar'
                          : 'Enviar Pedido'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <CustomerSelectModal
        visible={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSelect={handleCustomerSelected}
      />

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
  customerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border ?? COLORS.surface,
  },
  // Sin cliente la orden no se puede comandar: el chip lo avisa desde el inicio
  // en vez de que el mesonero se entere al tocar "Enviar".
  customerChipMissing: {
    borderColor: COLORS.error,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  customerChipTextMissing: {
    color: COLORS.error,
    fontWeight: FONT_WEIGHT.medium,
  },
  customerChipText: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  aliasRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  aliasInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  associateInputContainer: {
    width: 120,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  aliasInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
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
  productListWithFooter: {
    paddingBottom: 180,
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
    paddingTop: SPACING.sm,
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
  cartItemsSection: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  cartItemsTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  cartItemNotesContainer: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cartItemName: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  cartItemPrice: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  orderNotesSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  orderNotesLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    gap: SPACING.sm,
  },
  sendButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.xxxl,
  },
  existingItemsSection: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  existingItemsTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  existingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  existingItemQtyBadge: {
    width: 26,
    height: 26,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: `${COLORS.textSecondary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  existingItemQtyText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textSecondary,
  },
  existingItemName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  existingItemPrice: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
});

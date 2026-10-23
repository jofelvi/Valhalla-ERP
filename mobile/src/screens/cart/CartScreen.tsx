import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useCartStore, useAuthStore } from '../../store';
import { orderService } from '../../services';
import { locationService } from '../../services/locationService';
import { CartItem, PaymentMethodEnum, ZoneSectorEnum } from '../../types';
import { Button } from '../../components/ui/Button';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import { showAlert } from '../../utils/alert';
import { formatearUsd } from '../../utils/dinero';

import { useVocab } from '../../config/hooks';
import { esZonaVisible } from '../../config/zonas';
interface CartScreenProps {
  navigation: {
    navigate: (screen: string, params?: unknown) => void;
    goBack: () => void;
  };
}

const ZONE_OPTIONS: {
  value: ZoneSectorEnum;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: ZoneSectorEnum.EVENTO, label: 'Evento', icon: 'calendar-outline' },
  { value: ZoneSectorEnum.PISCINA, label: 'Piscina', icon: 'water-outline' },
  {
    value: ZoneSectorEnum.SALON_PRINCIPAL,
    label: 'Salón',
    icon: 'business-outline',
  },
  { value: ZoneSectorEnum.TENIS, label: 'Tenis', icon: 'tennisball-outline' },
  { value: ZoneSectorEnum.FUTBOL, label: 'Fútbol', icon: 'football-outline' },
  { value: ZoneSectorEnum.BEISBOL, label: 'Béisbol', icon: 'baseball-outline' },
  { value: ZoneSectorEnum.CANCHAS, label: 'Canchas', icon: 'fitness-outline' },
];

const PAYMENT_OPTIONS: {
  value: PaymentMethodEnum;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: PaymentMethodEnum.PENDING,
    label: 'Pagar en caja',
    icon: 'storefront-outline',
  },
  {
    value: PaymentMethodEnum.PAGO_MOVIL,
    label: 'Pago Móvil',
    icon: 'phone-portrait-outline',
  },
  {
    value: PaymentMethodEnum.CARD,
    label: 'Punto de venta',
    icon: 'card-outline',
  },
];

export const CartScreen: React.FC<CartScreenProps> = ({ navigation }) => {
  const vocab = useVocab();
  const insets = useSafeAreaInsets();
  const {
    items,
    updateQuantity,
    removeItem,
    getTotal,
    getSubtotal,
    clearCart,
  } = useCartStore();
  const { customer, user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSector, setSelectedSector] = useState<ZoneSectorEnum | null>(
    null,
  );
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethodEnum>(
    PaymentMethodEnum.PENDING,
  );

  const handleQuantityChange = (productId: string, delta: number) => {
    const item = items.find((i) => i.product.id === productId);
    if (item) {
      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) {
        handleRemove(productId);
      } else {
        updateQuantity(productId, newQuantity);
      }
    }
  };

  const handleRemove = (productId: string) => {
    showAlert(
      'Eliminar producto',
      '¿Deseas quitar este producto de tu pedido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => removeItem(productId),
        },
      ],
    );
  };

  // Para pedir basta con nombre y telefono: SER SOCIO NO ES REQUISITO.
  // Antes tambien se exigia el numero de socio y eso bloqueaba a cualquiera
  // que no lo fuera — y a los que si lo son, porque el backend guarda ese
  // numero en `memberAction` y aqui se pedia `memberNumber`, que solo tienen
  // 2 de 2850 clientes. Nadie podia cerrar su pedido.
  const isProfileComplete = (): boolean => {
    return !!(customer?.name && customer?.phone);
  };

  const handleCheckout = async () => {
    if (!user || !customer) {
      showAlert('Error', 'Debes iniciar sesión para realizar un pedido');
      return;
    }

    if (!isProfileComplete()) {
      showAlert(
        'Completa tu perfil',
        'Necesitas tu nombre y tu teléfono para hacer un pedido.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ir a Perfil',
            onPress: () =>
              navigation.navigate('MainTabs', { screen: 'Profile' }),
          },
        ],
      );
      return;
    }

    if (items.length === 0) {
      showAlert('Error', 'Tu carrito está vacío');
      return;
    }

    if (!selectedSector) {
      showAlert(
        `${vocab.zone} requerida`,
        '¿Dónde estás? Selecciona tu zona para continuar',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      let coords = undefined;
      try {
        const granted = await locationService.requestPermissions();
        if (granted) {
          coords = await locationService.getCurrentLocation();
        }
      } catch (gpsError) {
        console.warn(
          'No se pudo obtener GPS, continuando sin ubicación:',
          gpsError,
        );
      }

      const orderItems = items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.price,
        totalPrice: item.product.price * item.quantity,
        total: item.product.price * item.quantity,
        notes: item.notes ?? null,
      }));

      const result = await orderService.createOrder(
        user.uid,
        customer.name,
        orderItems,
        selectedPayment,
        undefined,
        undefined,
        undefined,
        selectedSector,
        coords,
      );

      clearCart();
      setSelectedSector(null);

      const waiterMsg = result.waiterName
        ? `\nTu mesonero asignado es: ${result.waiterName}`
        : '';

      showAlert(
        '¡Pedido enviado!',
        `Tu pedido está en camino. Revisa el estado en "Mis Pedidos".${waiterMsg}`,
        [
          {
            text: 'Ver pedido',
            onPress: () =>
              navigation.navigate('OrderDetail', { orderId: result.orderId }),
          },
          { text: 'OK', onPress: () => navigation.goBack() },
        ],
      );
    } catch (error) {
      console.error('Error creando pedido:', error);
      showAlert('Error', 'No se pudo crear el pedido. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemLeft}>
        {item.product.imageUrl ? (
          <Image
            source={{ uri: item.product.imageUrl }}
            style={styles.itemImage}
          />
        ) : (
          <LinearGradient
            colors={[COLORS.surface, COLORS.backgroundSecondary]}
            style={[styles.itemImage, styles.placeholderImage]}
          >
            <Ionicons
              name="restaurant"
              size={22}
              color={`${COLORS.primary}40`}
            />
          </LinearGradient>
        )}

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.product.name}
          </Text>
          <Text style={styles.itemPrice}>
            {formatearUsd(item.product.price)} c/u
          </Text>
        </View>
      </View>

      <View style={styles.itemRight}>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item.product.id, -1)}
          >
            <Ionicons
              name={item.quantity === 1 ? 'trash-outline' : 'remove'}
              size={16}
              color={item.quantity === 1 ? COLORS.error : COLORS.text}
            />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity
            style={[styles.quantityButton, styles.quantityAddButton]}
            onPress={() => handleQuantityChange(item.product.id, 1)}
          >
            <Ionicons name="add" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.itemTotal}>
          {formatearUsd(item.product.price * item.quantity)}
        </Text>
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <View style={styles.emptyContent}>
          <View style={styles.emptyIconContainer}>
            <Ionicons
              name="cart-outline"
              size={64}
              color={`${COLORS.primary}60`}
            />
          </View>
          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.emptySubtitle}>
            ¿Qué se te antoja? Explora nuestro menú y agrega tus platos
            favoritos
          </Text>
          <View style={styles.browseButtonWrapper}>
            <Button
              variant="primary"
              size="lg"
              label="Explorar el menú"
              icon={
                <Ionicons
                  name="restaurant-outline"
                  size={18}
                  color={COLORS.background}
                />
              }
              iconPosition="left"
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.product.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.headerTitle}>Tu pedido</Text>
            <Text style={styles.headerCount}>
              {items.length} producto{items.length !== 1 ? 's' : ''}
            </Text>
          </View>
        }
      />

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(SPACING.xxl, insets.bottom + SPACING.sm) },
        ]}
      >
        {/* Alerta de perfil incompleto */}
        {!isProfileComplete() && (
          <TouchableOpacity
            style={styles.profileWarning}
            onPress={() =>
              navigation.navigate('MainTabs', { screen: 'Profile' })
            }
          >
            <Ionicons name="alert-circle" size={18} color={COLORS.warning} />
            <Text style={styles.profileWarningText}>
              Completa tu perfil para poder pedir
            </Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.warning} />
          </TouchableOpacity>
        )}

        {/* Selección de zona */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>
            <Ionicons
              name="location-outline"
              size={15}
              color={COLORS.textSecondary}
            />{' '}
            ¿Dónde estás?
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContent}
          >
            {ZONE_OPTIONS.filter((zone) => esZonaVisible(zone.value)).map(
              (zone) => (
                <TouchableOpacity
                  key={zone.value}
                  style={[
                    styles.pill,
                    selectedSector === zone.value && styles.pillSelected,
                  ]}
                  onPress={() => setSelectedSector(zone.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={zone.icon}
                    size={18}
                    color={
                      selectedSector === zone.value
                        ? COLORS.background
                        : COLORS.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.pillText,
                      selectedSector === zone.value && styles.pillTextSelected,
                    ]}
                  >
                    {zone.label}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </ScrollView>
        </View>

        {/* Método de pago */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>
            <Ionicons
              name="card-outline"
              size={15}
              color={COLORS.textSecondary}
            />{' '}
            Método de pago
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContent}
          >
            {PAYMENT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.pill,
                  selectedPayment === option.value && styles.pillSelected,
                ]}
                onPress={() => setSelectedPayment(option.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={option.icon}
                  size={18}
                  color={
                    selectedPayment === option.value
                      ? COLORS.background
                      : COLORS.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.pillText,
                    selectedPayment === option.value && styles.pillTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Resumen */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatearUsd(getSubtotal())}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatearUsd(getTotal())}</Text>
          </View>
        </View>

        {/* Botón confirmar */}
        <View style={styles.checkoutButtonWrapper}>
          <Button
            variant="primary"
            size="lg"
            label="Confirmar pedido"
            icon={
              <Ionicons
                name="arrow-forward"
                size={20}
                color={COLORS.background}
              />
            }
            iconPosition="right"
            onPress={handleCheckout}
            loading={isSubmitting}
            disabled={isSubmitting || !isProfileComplete()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xxl,
  },
  browseButtonWrapper: {
    width: '100%',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  headerCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 440,
  },
  cartItem: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  itemLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.md,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  itemPrice: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.full,
    padding: 3,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityAddButton: {
    backgroundColor: `${COLORS.primary}15`,
  },
  quantityText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    minWidth: 18,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 0,
    ...SHADOWS.large,
  },
  profileWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}12`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: `${COLORS.warning}25`,
  },
  profileWarningText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.warning,
    fontWeight: FONT_WEIGHT.medium,
  },
  sectionContainer: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillsContent: {
    gap: SPACING.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    gap: SPACING.xs,
  },
  pillSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  pillText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  pillTextSelected: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.semibold,
  },
  summaryContainer: {
    marginBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  totalLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  totalValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  checkoutButtonWrapper: {
    width: '100%',
  },
});

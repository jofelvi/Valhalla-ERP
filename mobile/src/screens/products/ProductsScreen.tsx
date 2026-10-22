import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { productService } from '../../services';
import { Product, CurrencyEnum, UserRoleEnum } from '../../types';
import { useCartStore, useAuthStore } from '../../store';
import { ProductCard, FloatingCartButton } from '../../components';
import { Button } from '../../components/ui/Button';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ProductsScreenProps {
  route: {
    params: {
      categoryId: string;
      categoryName: string;
    };
  };
  navigation: {
    setOptions: (options: Record<string, unknown>) => void;
    navigate: (screen: string, params?: unknown) => void;
  };
}

const formatPrice = (price: number, currency: CurrencyEnum): string => {
  const symbols: Record<CurrencyEnum, string> = {
    [CurrencyEnum.USD]: '$',
    [CurrencyEnum.EUR]: '€',
    [CurrencyEnum.VES]: 'Bs.',
    [CurrencyEnum.CLP]: '$',
    [CurrencyEnum.COP]: '$',
  };
  return `${symbols[currency] ?? '$'}${price.toFixed(2)}`;
};

export const ProductsScreen: React.FC<ProductsScreenProps> = ({
  route,
  navigation,
}) => {
  const { categoryId, categoryName } = route.params;
  const role = useAuthStore((s) => s.role);
  const isCustomer = role === UserRoleEnum.CUSTOMER;
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addItem, items } = useCartStore();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    navigation.setOptions({
      title: categoryName,
      headerStyle: { backgroundColor: COLORS.background },
      headerTintColor: COLORS.text,
    });
  }, [categoryName, navigation]);

  const loadProducts = async () => {
    try {
      const data = await productService.getByCategory(categoryId);
      setProducts(data);
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [categoryId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const getCartQuantity = (productId: string): number => {
    const item = items.find((i) => i.product.id === productId);
    return item?.quantity ?? 0;
  };

  const handleAddToCart = (product: Product) => {
    addItem(product);
  };

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeProductDetail = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedProduct(null);
    });
  };

  const handleAddFromDetail = () => {
    if (selectedProduct) {
      addItem(selectedProduct, quantity);
      closeProductDetail();
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productWrapper}>
      <ProductCard
        product={item}
        quantity={getCartQuantity(item.id)}
        onPress={() => openProductDetail(item)}
        onAddToCart={() => handleAddToCart(item)}
      />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIconContainer}>
          <Ionicons name="fast-food-outline" size={36} color={COLORS.primary} />
        </View>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: SPACING.lg }}
        />
        <Text style={styles.loadingText}>Preparando el menú...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="fast-food-outline"
                size={52}
                color={`${COLORS.primary}60`}
              />
            </View>
            <Text style={styles.emptyTitle}>Sin productos disponibles</Text>
            <Text style={styles.emptySubtitle}>
              Esta categoría no tiene productos activos en este momento
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {isCustomer && (
        <FloatingCartButton
          onPress={() => navigation.navigate('MainTabs', { screen: 'Cart' })}
        />
      )}

      {/* Product Detail Modal */}
      <Modal
        visible={selectedProduct !== null}
        transparent
        animationType="none"
        onRequestClose={closeProductDetail}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.modalBackdrop, { opacity: backdropOpacity }]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={closeProductDetail}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalContent,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {selectedProduct && (
              <>
                <View style={styles.modalHandle} />

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeProductDetail}
                >
                  <Ionicons name="close" size={22} color={COLORS.text} />
                </TouchableOpacity>

                {selectedProduct.imageUrl ? (
                  <Image
                    source={{ uri: selectedProduct.imageUrl }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[COLORS.surface, COLORS.backgroundSecondary]}
                    style={[styles.modalImage, styles.modalPlaceholder]}
                  >
                    <Ionicons
                      name="restaurant"
                      size={64}
                      color={`${COLORS.primary}40`}
                    />
                  </LinearGradient>
                )}

                <View style={styles.modalInfo}>
                  <Text style={styles.modalName}>{selectedProduct.name}</Text>
                  {selectedProduct.description && (
                    <Text style={styles.modalDescription}>
                      {selectedProduct.description}
                    </Text>
                  )}
                  <Text style={styles.modalPrice}>
                    {formatPrice(
                      selectedProduct.price,
                      selectedProduct.currency,
                    )}
                  </Text>

                  <View style={styles.quantitySection}>
                    <Text style={styles.quantityLabel}>Cantidad</Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={[
                          styles.quantityButton,
                          quantity <= 1 && styles.quantityButtonDisabled,
                        ]}
                        onPress={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Ionicons
                          name="remove"
                          size={20}
                          color={quantity <= 1 ? COLORS.textLight : COLORS.text}
                        />
                      </TouchableOpacity>
                      <Text style={styles.quantityValue}>{quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => setQuantity(quantity + 1)}
                      >
                        <Ionicons name="add" size={20} color={COLORS.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Botón de agregar al carrito */}
                <View style={styles.addToCartButtonWrapper}>
                  <Button
                    variant="primary"
                    size="lg"
                    label={`Agregar al carrito — ${formatPrice(selectedProduct.price * quantity, selectedProduct.currency)}`}
                    icon={
                      <Ionicons
                        name="cart-outline"
                        size={20}
                        color={COLORS.background}
                      />
                    }
                    iconPosition="left"
                    onPress={handleAddFromDetail}
                  />
                </View>
              </>
            )}
          </Animated.View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingIconContainer: {
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
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 180,
  },
  productWrapper: {
    marginBottom: SPACING.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: SPACING.xxl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: SPACING.xxxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 0,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: `${COLORS.surface}CC`,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  modalImage: {
    width: '100%',
    height: 240,
  },
  modalPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalInfo: {
    padding: SPACING.xl,
  },
  modalName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalDescription: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  modalPrice: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xl,
  },
  quantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.full,
    padding: SPACING.xs,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginHorizontal: SPACING.xl,
    minWidth: 30,
    textAlign: 'center',
  },
  addToCartButtonWrapper: {
    marginHorizontal: SPACING.xl,
  },
});

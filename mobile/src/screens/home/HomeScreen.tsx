import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Category, Product } from '../../types';
import { useProductosDelMenu, useCategorias } from '../../queries/useCatalogo';
import { useAuthStore, useCartStore } from '../../store';
import { CategoryCard, SearchBar, FloatingCartButton } from '../../components';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import { useBusqueda } from '../../hooks/useBusqueda';
import { formatearUsd } from '../../utils/dinero';
import { useModulo } from '../../config/hooks';

interface HomeScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const mesaConectada = useModulo('connectedTable');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { customer } = useAuthStore();
  const { addItem, items: cartItems } = useCartStore();

  const { data: categories = [], isLoading } = useCategorias();
  const { data: allProducts = [] } = useProductosDelMenu();

  // Filtrado derivado con useBusqueda (memoizado). Los productos SOLO se
  // muestran al buscar (con query vacío la home enseña categorías, no el
  // catálogo completo): sin query, la lista de resultados va vacía.
  const filteredCategories = useBusqueda(categories, searchQuery, ['name']);
  const productMatches = useBusqueda(allProducts, searchQuery, [
    'name',
    'description',
  ]);
  const filteredProducts = searchQuery.trim() ? productMatches : [];

  // Animaciones de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideY = useRef(new Animated.Value(-20)).current;

  // Stagger categorías (máx 20 slots)
  const catOpacity = useRef(
    Array.from({ length: 20 }, () => new Animated.Value(0)),
  ).current;
  const catSlideY = useRef(
    Array.from({ length: 20 }, () => new Animated.Value(18)),
  ).current;

  const runEntrance = (categoryCount: number) => {
    catOpacity.forEach((a) => a.setValue(0));
    catSlideY.forEach((a) => a.setValue(18));

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(headerSlideY, {
        toValue: 0,
        tension: 60,
        friction: 11,
        useNativeDriver: true,
      }),
      // Stagger de categorías
      Animated.sequence([
        Animated.delay(300),
        Animated.stagger(
          70,
          Array.from({ length: Math.min(categoryCount, 20) }, (_, i) =>
            Animated.parallel([
              Animated.timing(catOpacity[i], {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.spring(catSlideY[i], {
                toValue: 0,
                tension: 65,
                friction: 12,
                useNativeDriver: true,
              }),
            ]),
          ),
        ),
      ]),
    ]).start();
  };

  useEffect(() => {
    if (categories.length > 0) {
      runEntrance(categories.length);
    }
  }, [categories.length]);

  const onRefresh = () => {
    setRefreshing(true);
    // Las queries se refrescarán automáticamente; aquí solo reset el flag
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '¡Buenos días';
    if (hour < 18) return '¡Buenas tardes';
    return '¡Buenas noches';
  };

  const getUserInitials = (): string => {
    const name = customer?.name ?? 'Cliente';
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
  };

  const getCartQuantity = (productId: string): number =>
    cartItems.find((item) => item.product.id === productId)?.quantity ?? 0;

  const renderProductResult = (product: Product) => {
    const cartQty = getCartQuantity(product.id);
    return (
      <TouchableOpacity
        key={product.id}
        style={styles.productResult}
        onPress={() =>
          navigation.navigate('Products', {
            categoryId: product.categoryId,
            categoryName: product.category ?? 'Productos',
          })
        }
        activeOpacity={0.75}
      >
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.productImage}
          />
        ) : (
          <View style={[styles.productImage, styles.productPlaceholder]}>
            <Ionicons
              name="restaurant-outline"
              size={22}
              color={COLORS.textLight}
            />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {product.name}
          </Text>
          {product.description ? (
            <Text style={styles.productDescription} numberOfLines={1}>
              {product.description}
            </Text>
          ) : null}
          <Text style={styles.productPrice}>{formatearUsd(product.price)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, cartQty > 0 && styles.addButtonActive]}
          onPress={() => addItem(product)}
        >
          {cartQty > 0 ? (
            <Text style={styles.qtyBadgeText}>{cartQty}</Text>
          ) : (
            <Ionicons name="add" size={20} color={COLORS.background} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Blobs decorativos */}
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobMidLeft} pointerEvents="none" />

      {/* Header row */}
      <Animated.View
        style={[
          styles.headerTop,
          { opacity: fadeAnim, transform: [{ translateY: headerSlideY }] },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>
            {customer?.name?.split(' ')[0] ?? 'Cliente'}!
          </Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{getUserInitials()}</Text>
        </View>
      </Animated.View>

      {/* Buscador */}
      <Animated.View style={{ opacity: fadeAnim }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="¿Qué se te antoja hoy?"
        />
      </Animated.View>

      {/* Aviso de verificacion de correo (solo si la cuenta no esta verificada) */}
      {customer && customer.emailVerified === false && (
        <Animated.View style={{ opacity: fadeAnim }}>
          <TouchableOpacity
            style={styles.verifyBanner}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('VerifyEmail')}
          >
            <Ionicons
              name="mail-unread-outline"
              size={20}
              color={COLORS.warning}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyBannerTitle}>Verifica tu correo</Text>
              <Text style={styles.verifyBannerSubtitle}>
                Toca para confirmar tu cuenta con el codigo que te enviamos
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Mesa Conectada: escanear el QR del mesonero. Solo si el módulo está encendido. */}
      {mesaConectada && (
        <Animated.View style={{ opacity: fadeAnim }}>
          <TouchableOpacity
            style={styles.scanTableButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ScanTable')}
          >
            <View style={styles.scanTableIcon}>
              <Ionicons
                name="qr-code-outline"
                size={22}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanTableTitle}>Conectarme a mi mesa</Text>
              <Text style={styles.scanTableSubtitle}>
                Escanea el QR del mesonero para pedir y chatear
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Resultados de búsqueda */}
      {filteredProducts.length > 0 && (
        <Animated.View
          style={[styles.searchResultsSection, { opacity: fadeAnim }]}
        >
          <Text style={styles.sectionTitle}>
            {filteredProducts.length} resultado
            {filteredProducts.length !== 1 ? 's' : ''} encontrado
            {filteredProducts.length !== 1 ? 's' : ''}
          </Text>
          {filteredProducts.map(renderProductResult)}
        </Animated.View>
      )}

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.sectionTitle}>Categorías</Text>
      </Animated.View>
    </View>
  );

  const renderCategory = ({
    item,
    index,
  }: {
    item: Category;
    index: number;
  }) => {
    const i = Math.min(index, 19);
    return (
      <Animated.View
        style={[
          styles.categoryWrapper,
          index % 2 === 0 ? styles.leftCard : styles.rightCard,
          { opacity: catOpacity[i], transform: [{ translateY: catSlideY[i] }] },
        ]}
      >
        <CategoryCard
          category={item}
          onPress={() =>
            navigation.navigate('Products', {
              categoryId: item.id,
              categoryName: item.name,
            })
          }
        />
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[`${COLORS.primary}20`, `${COLORS.primary}05`]}
          style={styles.loadingIconBg}
        >
          <Ionicons name="restaurant" size={40} color={COLORS.primary} />
        </LinearGradient>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: SPACING.xl }}
        />
        <Text style={styles.loadingText}>Preparando tu menú...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <FlatList
        data={filteredCategories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons
                name="restaurant-outline"
                size={52}
                color={COLORS.textLight}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Sin coincidencias' : 'Menú no disponible'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Prueba con otra búsqueda'
                : 'El menú estará disponible pronto. ¡Vuelve en un momento!'}
            </Text>
          </Animated.View>
        }
        showsVerticalScrollIndicator={false}
      />

      <FloatingCartButton
        onPress={() =>
          navigation.navigate('MainTabs', { screen: 'Cart' } as never)
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Loading ──────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingIconBg: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },

  // ── Header ───────────────────────────────────────────────────────
  header: {
    paddingTop: SPACING.md,
    overflow: 'hidden',
  },
  blobTopRight: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    opacity: 0.06,
  },
  blobMidLeft: {
    position: 'absolute',
    top: 140,
    left: -70,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    opacity: 0.04,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  headerLeft: { flex: 1 },
  greeting: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: 2,
  },
  userName: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarInitials: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },

  // ── Banner ───────────────────────────────────────────────────────
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.warning}14`,
    borderWidth: 1,
    borderColor: `${COLORS.warning}55`,
  },
  verifyBannerTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  verifyBannerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  scanTableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: `${COLORS.primary}55`,
  },
  scanTableIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}1A`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTableTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  scanTableSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },

  // ── Títulos de sección ───────────────────────────────────────────
  sectionTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },

  // ── Resultados de búsqueda ───────────────────────────────────────
  searchResultsSection: {
    marginBottom: SPACING.xl,
  },
  productResult: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
  },
  productPlaceholder: {
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: { flex: 1, marginLeft: SPACING.md },
  productName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  productDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  productPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    marginTop: 4,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  addButtonActive: {
    backgroundColor: COLORS.primaryDark,
  },
  qtyBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },

  // ── Grid de categorías ───────────────────────────────────────────
  listContent: { paddingBottom: 180 },
  categoryWrapper: { flex: 1 },
  leftCard: { paddingLeft: SPACING.lg, paddingRight: SPACING.sm },
  rightCard: { paddingLeft: SPACING.sm, paddingRight: SPACING.lg },

  // ── Empty state ──────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

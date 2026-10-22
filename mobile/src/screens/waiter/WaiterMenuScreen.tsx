import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
  availabilityService,
} from '../../services';
import { Category, Product } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { SearchBar, ProductCard } from '../../components';
import { useWaiterOrderStore } from '../../store';
import { useBusqueda } from '../../hooks/useBusqueda';
import { useProductosDelMenu, useCategorias } from '../../queries/useCatalogo';
import { formatearUsd } from '../../utils/dinero';
import { AvailabilityStatus } from '../../services/availabilityService';
import { avisoDisponibilidad } from '../../utils/confirmarSiAgotado';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ALL_CATEGORY_ID = '__all__';

export const WaiterMenuScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selectedCategoryId, setSelectedCategoryId] = useState(ALL_CATEGORY_ID);
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, AvailabilityStatus>
  >({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: products = [], isLoading } = useProductosDelMenu();
  const { data: categories = [] } = useCategorias();

  const addItem = useWaiterOrderStore((s) => s.addItem);
  const items = useWaiterOrderStore((s) => s.items);
  const itemCount = useWaiterOrderStore((s) => s.getItemCount());
  const total = useWaiterOrderStore((s) => s.getTotal());
  const tableName = useWaiterOrderStore((s) => s.tableName);
  const tableId = useWaiterOrderStore((s) => s.tableId);

  const loadAvailability = useCallback(async () => {
    try {
      const availability = await availabilityService.checkAvailability('');
      const map: Record<string, AvailabilityStatus> = {};
      for (const [productId, status] of availability.entries()) {
        map[productId] = status;
      }
      setAvailabilityMap(map);
    } catch (err) {
      console.error('Error cargando disponibilidad:', err);
    }
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadAvailability();
  }, [loadAvailability]);

  const productsByCategory = useMemo(() => {
    if (selectedCategoryId === ALL_CATEGORY_ID) {
      return products;
    }
    return products.filter((p) => p.categoryId === selectedCategoryId);
  }, [products, selectedCategoryId]);

  const filteredProducts = useBusqueda(productsByCategory, searchQuery, [
    'name',
  ]);

  const getProductQuantity = useCallback(
    (productId: string): number => {
      const item = items.find((i) => i.product.id === productId);
      return item?.quantity ?? 0;
    },
    [items],
  );

  const handleAddToCart = useCallback(
    (product: Product) => {
      // Avisar, NUNCA bloquear: si falta algo lo más probable es que no se haya
      // cargado la compra. El mesonero decide, con el dato delante.
      const aviso = avisoDisponibilidad(availabilityMap[product.id]);
      if (aviso) {
        Alert.alert('Disponibilidad', aviso, [
          { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
          { text: 'Vender de todas formas', onPress: () => addItem(product) },
        ]);
      } else {
        addItem(product);
      }
    },
    [addItem, availabilityMap],
  );

  const handleProductPress = useCallback(
    (product: Product) => {
      navigation.navigate('Products', {
        categoryId: product.categoryId,
        categoryName:
          categories.find((c) => c.id === product.categoryId)?.name ?? '',
      });
    },
    [navigation, categories],
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
        <Text style={styles.loadingText}>Cargando menú...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrapper}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar productos..."
        />
      </View>

      <View style={styles.pillsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContent}
        >
          <TouchableOpacity
            style={[
              styles.pill,
              selectedCategoryId === ALL_CATEGORY_ID && styles.pillSelected,
            ]}
            onPress={() => setSelectedCategoryId(ALL_CATEGORY_ID)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillText,
                selectedCategoryId === ALL_CATEGORY_ID &&
                  styles.pillTextSelected,
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

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        style={styles.productList}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            quantity={getProductQuantity(item.id)}
            onPress={() => handleProductPress(item)}
            onAddToCart={() => handleAddToCart(item)}
            availability={availabilityMap[item.id]}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
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
                size={48}
                color={`${COLORS.primary}60`}
              />
            </View>
            <Text style={styles.emptyTitle}>Sin productos</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'No hay coincidencias para tu búsqueda'
                : 'No hay productos disponibles en esta categoría'}
            </Text>
          </View>
        }
      />

      {itemCount > 0 && tableId ? (
        <View style={styles.floatingButtonWrapper}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('WaiterCreateOrder', { tableId, tableName })
            }
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[COLORS.gradientStart, COLORS.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.floatingButton}
            >
              <View style={styles.floatingBadge}>
                <Text style={styles.floatingBadgeText}>{itemCount}</Text>
              </View>
              <Text style={styles.floatingLabel}>{tableName} — Ver pedido</Text>
              <View style={styles.floatingRight}>
                <Text style={styles.floatingTotal}>{formatearUsd(total)}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={COLORS.background}
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchWrapper: {
    paddingTop: SPACING.md,
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
    flex: 1,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 120,
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
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  floatingButtonWrapper: {
    position: 'absolute',
    bottom: 20,
    left: SPACING.lg,
    right: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    borderRadius: BORDER_RADIUS.xl,
  },
  floatingButton: {
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingBadge: {
    backgroundColor: COLORS.background,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  floatingBadgeText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  floatingLabel: {
    flex: 1,
    color: COLORS.background,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  floatingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  floatingTotal: {
    color: COLORS.background,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
});

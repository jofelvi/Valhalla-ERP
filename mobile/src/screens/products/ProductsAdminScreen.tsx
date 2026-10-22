import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
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
import { Product, Category } from '../../types';
import {
  useProductosParaAdmin,
  useCategorias,
} from '../../queries/useCatalogo';
import { RootStackParamList } from '../../navigation/types';
import { useBusqueda } from '../../hooks/useBusqueda';
import { Input, Button } from '../../components/ui';
import { formatearUsd } from '../../utils/dinero';

import { useVocab } from '../../config/hooks';
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const ProductsAdminScreen: React.FC = () => {
  const vocab = useVocab();
  const navigation = useNavigation<NavigationProp>();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('__all__');

  const {
    data: products = [],
    isLoading,
    refetch: recargarProductos,
  } = useProductosParaAdmin();
  const { data: categories = [], refetch: recargarCategorias } =
    useCategorias();

  /**
   * Refrescar al volver a la pantalla.
   *
   * El `staleTime` del catalogo es de diez minutos —un menu no cambia durante
   * un turno—, pero esta pantalla es justo donde SI cambia: se entra a editar
   * un producto y se vuelve. Sin este refetch la lista mostraria el precio
   * viejo del que se acaba de guardar, que es el tipo de cosa que termina en
   * un cobro equivocado.
   *
   * Antes esto llamaba a `load()`. Al pasar a React Query quedo como un
   * callback VACIO: la pantalla dejo de refrescarse y nada fallaba.
   */
  useFocusEffect(
    useCallback(() => {
      void recargarProductos();
      void recargarCategorias();
    }, [recargarProductos, recargarCategorias]),
  );

  const productsByCategory = useMemo(() => {
    if (categoryId === '__all__') {
      return products;
    }
    return products.filter((p) => p.categoryId === categoryId);
  }, [products, categoryId]);

  const filtered = useBusqueda(productsByCategory, search, ['name']);

  const renderItem = ({ item }: { item: Product }) => {
    const hasBarcode = !!item.barcode || (item.barcodes ?? []).length > 0;
    return (
      <TouchableOpacity
        style={[styles.card, !item.isActive && styles.cardInactive]}
        onPress={() =>
          navigation.navigate('ProductEdit', { productId: item.id })
        }
      >
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {formatearUsd(item.price)}
            {item.station
              ? ` · ${item.station === 'BAR' ? vocab.bar : vocab.kitchen}`
              : ''}
            {!item.isActive ? ' · Inactivo' : ''}
          </Text>
        </View>
        {hasBarcode && (
          <Ionicons name="barcode-outline" size={20} color={COLORS.primary} />
        )}
        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchWrapper}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar producto..."
          leftIcon="search-outline"
        />
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        data={[{ id: '__all__', name: 'Todas' } as Category, ...categories]}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              categoryId === item.id && styles.filterChipActive,
            ]}
            onPress={() => setCategoryId(item.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                categoryId === item.id && styles.filterChipTextActive,
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: SPACING.xl }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Sin productos</Text>}
        />
      )}

      <View style={styles.fabWrapper}>
        <Button
          label="Nuevo"
          variant="primary"
          size="lg"
          icon={<Ionicons name="add" size={20} color={COLORS.textWhite} />}
          onPress={() => navigation.navigate('ProductEdit', {})}
          style={styles.fab}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchWrapper: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  filterRow: { paddingHorizontal: SPACING.md, maxHeight: 44 },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.sm,
    height: 34,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  filterChipTextActive: {
    color: COLORS.textWhite,
    fontWeight: FONT_WEIGHT.semibold,
  },
  list: { padding: SPACING.md, paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardInactive: { opacity: 0.5 },
  cardInfo: { flex: 1 },
  cardName: {
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  cardMeta: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  empty: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
  fabWrapper: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
  },
  fab: {
    borderRadius: 28,
  },
});

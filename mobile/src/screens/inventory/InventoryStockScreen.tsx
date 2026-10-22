import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import {
  inventoryService,
  StockItem,
  BaseUnit,
  InsumoProduct,
} from '../../services/inventoryService';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { useBusqueda } from '../../hooks/useBusqueda';

type ScreenRouteProp = RouteProp<RootStackParamList, 'InventoryStock'>;

interface StockItemWithName extends StockItem {
  presentation?: string | null;
}

// Formato amigable de cantidad: GR >= 1000 -> kg, ML >= 1000 -> L
function formatQuantity(qty: number, baseUnit: BaseUnit): string {
  if (baseUnit === 'GR' && qty >= 1000) {
    return `${(qty / 1000).toFixed(2)} kg`;
  }
  if (baseUnit === 'ML' && qty >= 1000) {
    return `${(qty / 1000).toFixed(2)} L`;
  }
  if (baseUnit === 'UND') {
    return `${qty.toFixed(0)} und`;
  }
  return `${qty.toFixed(0)} ${baseUnit}`;
}

export const InventoryStockScreen: React.FC = () => {
  const route = useRoute<ScreenRouteProp>();
  const { warehouseId, warehouseName } = route.params;

  const [stockItems, setStockItems] = useState<StockItemWithName[]>([]);
  const [insumos, setInsumos] = useState<Map<string, InsumoProduct>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [warehouseId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [stockData, insumosData] = await Promise.all([
        inventoryService.getStock(warehouseId),
        inventoryService.getInsumos(),
      ]);

      // Map insumos by ID for quick lookup
      const insumosMap = new Map();
      insumosData.forEach((p) => {
        insumosMap.set(p.id, p);
      });
      setInsumos(insumosMap);

      // API returns productName; if missing (old docs) show deleted message
      const enhanced = stockData.map((item) => {
        const insumo = insumosMap.get(item.productId);
        const displayName =
          item.productName ||
          (insumo?.name
            ? insumo.name
            : `Producto eliminado (${item.productId.slice(-6)})`);
        return {
          ...item,
          productName: displayName,
          presentation: insumo?.presentation,
        };
      });
      setStockItems(enhanced);
    } catch (error) {
      console.error('[InventoryStock] Error loading data:', error);
      showAlert('Error', 'No se pudo cargar el stock');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const stockData = await inventoryService.getStock(warehouseId);
      const enhanced = stockData.map((item) => {
        const insumo = insumos.get(item.productId);
        const displayName =
          item.productName ||
          (insumo?.name
            ? insumo.name
            : `Producto eliminado (${item.productId.slice(-6)})`);
        return {
          ...item,
          productName: displayName,
          presentation: insumo?.presentation,
        };
      });
      setStockItems(enhanced);
    } catch (error) {
      console.error('[InventoryStock] Error refreshing:', error);
      showAlert('Error', 'No se pudo actualizar el stock');
    } finally {
      setIsRefreshing(false);
    }
  };

  const filtered = useBusqueda(stockItems, searchQuery, [
    'productName',
    'productId',
  ]);

  const renderStockItem = ({ item }: { item: StockItemWithName }) => {
    const isNegative = item.qty < 0;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemLeft}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.productName}
          </Text>
          {item.presentation && (
            <Text style={styles.itemPresentation}>{item.presentation}</Text>
          )}
        </View>
        <View style={styles.itemRight}>
          <Text style={[styles.itemQty, isNegative && styles.itemQtyNegative]}>
            {formatQuantity(item.qty, item.baseUnit)}
          </Text>
          {isNegative && (
            <View style={styles.warningBadge}>
              <Ionicons name="warning" size={12} color="#fff" />
              <Text style={styles.warningText}>revisar</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando stock...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{warehouseName}</Text>
        <Text style={styles.headerSubtitle}>Stock actual</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={18}
          color={COLORS.textSecondary}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar insumo..."
          placeholderTextColor={COLORS.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons
              name="close-circle"
              size={18}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="cube-outline"
            size={48}
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'No se encontraron resultados'
              : 'Sin insumos en el almacén'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.productId}
          renderItem={renderStockItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
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
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  itemLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  itemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    lineHeight: 20,
  },
  itemPresentation: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemQty: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.success,
  },
  itemQtyNegative: {
    color: COLORS.error,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    marginTop: SPACING.xs,
    gap: 2,
  },
  warningText: {
    fontSize: FONT_SIZE.xs,
    color: '#fff',
    fontWeight: FONT_WEIGHT.medium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});

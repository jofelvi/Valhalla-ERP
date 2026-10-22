import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  baseUnitFromPresentation,
  InventoryCountItem,
  InventoryCount,
  BaseUnit,
  StockItem,
  InsumoProduct,
} from '../../services/inventoryService';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { formatearUsd } from '../../utils/dinero';
import {
  isTypingCountQuantity,
  parseCountQuantity,
} from '../../utils/countQuantity';
import { useModal } from '../../hooks/useModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { filtrarLocal } from '../../utils/busquedaTexto';

type ScreenRouteProp = RouteProp<RootStackParamList, 'InventoryCount'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CountItemLocal {
  productId: string;
  quantityText: string; // lo tecleado; '' = sin contar, '0' = contado en cero
  unit: string;
  productName?: string;
  presentation?: string | null;
  _id?: string;
}

function formatQuantity(qty: number, unit: BaseUnit): string {
  if (unit === 'GR' && qty >= 1000) {
    return `${(qty / 1000).toFixed(2)} kg`;
  }
  if (unit === 'ML' && qty >= 1000) {
    return `${(qty / 1000).toFixed(2)} L`;
  }
  if (unit === 'UND') {
    return `${qty.toFixed(0)} und`;
  }
  return `${qty.toFixed(0)} ${unit}`;
}

export const InventoryCountScreen: React.FC = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { warehouseId, warehouseName } = route.params;

  const [countType, setCountType] = useState<'DIARIO' | 'SEMANAL' | 'INICIAL'>(
    'DIARIO',
  );
  const [countItems, setCountItems] = useState<CountItemLocal[]>([]);
  const [allProducts, setAllProducts] = useState<InsumoProduct[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<Map<string, StockItem>>(
    new Map(),
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const productPickerModal = useModal('inventoryCountProductPicker');
  const [productSearch, setProductSearch] = useState('');
  const diff50Modal = useModal('inventoryCount50Diff');
  const [error50Message, setError50Message] = useState('');
  const resultModal = useModal('inventoryCountResult');
  const [countResult, setCountResult] = useState<InventoryCount | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [products, stock] = await Promise.all([
          inventoryService.getInsumos(),
          inventoryService.getStock(warehouseId),
        ]);

        setAllProducts(products);
        const stockMap = new Map();
        stock.forEach((s) => stockMap.set(s.productId, s));
        setWarehouseStock(stockMap);

        // Arranca con los insumos que tienen stock, todos sin contar.
        const initialItems = stock
          .filter((s) => s.qty > 0)
          .map((s) => {
            const product = products.find((p) => p.id === s.productId);
            const displayName =
              s.productName ||
              (product?.name
                ? product.name
                : `Producto eliminado (${s.productId.slice(-6)})`);
            return {
              productId: s.productId,
              quantityText: '',
              unit: s.baseUnit,
              productName: displayName,
              presentation: product?.presentation,
            };
          });
        setCountItems(initialItems);
      } catch (error) {
        console.error('[InventoryCount] Error loading:', error);
        showAlert('Error', 'No se pudieron cargar los datos');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [warehouseId]);

  const handleAddProduct = (productId: string) => {
    // Check if already added
    if (countItems.some((i) => i.productId === productId)) {
      showAlert('Aviso', 'Este insumo ya está en el conteo');
      return;
    }

    const product = allProducts.find((p) => p.id === productId);
    const stock = warehouseStock.get(productId);
    // Sin snapshot de stock (ej. conteo INICIAL desde cero): la unidad base
    // se deriva de la presentación del insumo, igual que hace el backend.
    const unit =
      stock?.baseUnit ?? baseUnitFromPresentation(product?.presentation);

    const newItem: CountItemLocal = {
      productId,
      quantityText: '',
      unit,
      productName: product?.name,
      presentation: product?.presentation,
    };
    setCountItems([...countItems, newItem]);
    productPickerModal.close();
    setProductSearch('');
  };

  const handleRemoveItem = (productId: string) => {
    setCountItems(countItems.filter((i) => i.productId !== productId));
  };

  const handleUpdateQuantity = (productId: string, text: string) => {
    if (!isTypingCountQuantity(text)) return;
    setCountItems(
      countItems.map((i) =>
        i.productId === productId ? { ...i, quantityText: text } : i,
      ),
    );
  };

  // Solo viajan las filas contadas; una fila vacía no es un cero.
  const countedItems = (): InventoryCountItem[] =>
    countItems.flatMap((i) => {
      const quantity = parseCountQuantity(i.quantityText);
      return quantity === undefined
        ? []
        : [{ productId: i.productId, quantity, unit: i.unit }];
    });

  const submitCount = async (confirmLargeDiffs: boolean) => {
    setIsSubmitting(true);
    try {
      const result = await inventoryService.createCount({
        warehouseId,
        type: countType,
        items: countedItems(),
        ...(confirmLargeDiffs ? { confirmLargeDiffs: true } : {}),
      });
      setCountResult(result);
      diff50Modal.close();
      resultModal.open();
    } catch (error) {
      console.error('[InventoryCount] Error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (!confirmLargeDiffs && msg.includes('50%')) {
        setError50Message(msg);
        diff50Modal.open();
        return;
      }
      showAlert('Error', msg.slice(0, 200));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const counted = countedItems().length;
    if (counted === 0) {
      showAlert(
        'Validación',
        'Escribe lo contado en al menos un insumo (0 si no hay)',
      );
      return;
    }
    const empty = countItems.length - counted;
    if (empty === 0) {
      void submitCount(false);
      return;
    }
    showAlert(
      'Insumos sin contar',
      `${empty} insumo(s) quedaron vacíos y no se registran. Se envían los ${counted} contados.`,
      [
        { text: 'Revisar', style: 'cancel' },
        { text: 'Enviar', onPress: () => void submitCount(false) },
      ],
    );
  };

  const handleConfirmLargeDiffs = () => {
    void submitCount(true);
  };

  const availableProducts = allProducts.filter(
    (p) => !countItems.some((i) => i.productId === p.id),
  );

  const filteredProducts = filtrarLocal(availableProducts, productSearch, [
    'name',
  ]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const ListHeaderComponent = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{warehouseName}</Text>
        <Text style={styles.headerSubtitle}>Conteo físico</Text>
      </View>

      {/* Type Selector */}
      <View style={styles.typeContainer}>
        {(['INICIAL', 'DIARIO', 'SEMANAL'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeChip,
              countType === type && styles.typeChipSelected,
            ]}
            onPress={() => setCountType(type)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.typeChipText,
                countType === type && styles.typeChipTextSelected,
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const ListFooterComponent = () => (
    <>
      {/* Add Product Button */}
      <Button
        label="Agregar Insumo"
        variant="ghost"
        size="md"
        icon={
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={COLORS.primary}
          />
        }
        onPress={() => productPickerModal.open()}
        style={styles.addButton}
      />

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <Button
          label="Enviar Conteo"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          icon={
            isSubmitting ? undefined : (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={COLORS.background}
              />
            )
          }
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Items List - now the only scrollable container */}
      <FlatList
        data={countItems}
        keyExtractor={(item) => item.productId}
        renderItem={({ item }) => (
          <View style={styles.countItemCard}>
            <View style={styles.countItemLeft}>
              <Text style={styles.countItemName} numberOfLines={2}>
                {item.productName}
              </Text>
              {item.presentation && (
                <Text style={styles.countItemPresentation}>
                  {item.presentation}
                </Text>
              )}
            </View>
            <View style={styles.countItemRight}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.countInput}
                  value={item.quantityText}
                  onChangeText={(v) => handleUpdateQuantity(item.productId, v)}
                  placeholder="0"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.countUnit}>{item.unit}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemoveItem(item.productId)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />

      {/* Add Product Picker Modal */}
      <Modal
        visible={productPickerModal.isOpen}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Insumo</Text>
              <TouchableOpacity onPress={() => productPickerModal.close()}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchContainer}>
              <Ionicons
                name="search-outline"
                size={18}
                color={COLORS.textSecondary}
              />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar..."
                placeholderTextColor={COLORS.textLight}
                value={productSearch}
                onChangeText={setProductSearch}
              />
            </View>
            <FlatList
              data={filteredProducts}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleAddProduct(item.id)}
                >
                  <View>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {item.presentation && (
                      <Text style={styles.modalItemSubtext}>
                        {item.presentation}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name="add-circle"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* 50% Diff Modal */}
      <Modal visible={diff50Modal.isOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={styles.alertIconContainer}>
                <Ionicons name="warning" size={28} color={COLORS.warning} />
              </View>
              <Text style={styles.alertTitle}>
                Diferencias Grandes Detectadas
              </Text>
            </View>
            <View style={styles.alertBody}>
              <Text style={styles.alertMessage}>{error50Message}</Text>
            </View>
            <View style={styles.alertActions}>
              <Button
                label="Corregir"
                variant="secondary"
                size="md"
                onPress={() => diff50Modal.close()}
                style={{ flex: 1 }}
              />
              <Button
                label="Confirmar Diferencias"
                variant="primary"
                size="md"
                loading={isSubmitting}
                onPress={handleConfirmLargeDiffs}
                disabled={isSubmitting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Result Modal */}
      {countResult && (
        <Modal visible={resultModal.isOpen} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.resultContent}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name="checkmark-circle"
                  size={32}
                  color={COLORS.success}
                />
                <Text style={styles.resultTitle}>Conteo Registrado</Text>
              </View>

              <ScrollView style={styles.resultBody}>
                <Text style={styles.resultLabel}>Diferencias Encontradas:</Text>
                {countResult.items.map((item, idx) => {
                  const systemVal = item.systemQty || 0;
                  const countedVal = item.countedQty || 0;
                  const diff = item.diff || 0;
                  const isPos = diff > 0;

                  return (
                    <View key={idx} style={styles.resultItem}>
                      <View style={styles.resultItemTop}>
                        <Text style={styles.resultItemName}>
                          {item.productName}
                        </Text>
                        <Text
                          style={[
                            styles.resultItemDiff,
                            isPos ? styles.diffPositive : styles.diffNegative,
                          ]}
                        >
                          {isPos ? '+' : ''}
                          {diff.toFixed(2)} {item.baseUnit}
                        </Text>
                      </View>
                      <View style={styles.resultItemDetails}>
                        <Text style={styles.resultItemDetail}>
                          Sistema: {systemVal.toFixed(2)}
                        </Text>
                        <Text style={styles.resultItemDetail}>
                          Contado: {countedVal.toFixed(2)}
                        </Text>
                        <Text style={styles.resultItemDetail}>
                          Valor: {formatearUsd(item.diffCost)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.resultActions}>
                <Button
                  label="Cerrar"
                  variant="primary"
                  size="md"
                  onPress={() => {
                    resultModal.close();
                    navigation.goBack();
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
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
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
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
  typeContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  typeChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  typeChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeChipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  typeChipTextSelected: {
    color: COLORS.background,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    flexGrow: 1,
  },
  countItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countItemLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  countItemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    lineHeight: 20,
  },
  countItemPresentation: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  countItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countInput: {
    width: 60,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    textAlign: 'center',
  },
  countUnit: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginRight: SPACING.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: 0,
    marginVertical: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  submitContainer: {
    paddingHorizontal: 0,
    marginTop: SPACING.md,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  submitText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalItemText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
  },
  modalItemSubtext: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  alertCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '90%',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
  alertHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  alertIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${COLORS.warning}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  alertTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  alertBody: {
    marginBottom: SPACING.lg,
  },
  alertMessage: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  alertActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  alertBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  alertBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  alertBtnPrimaryText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  alertBtnSecondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertBtnSecondaryText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  resultContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
    width: '100%',
  },
  resultHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  resultTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  resultBody: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  resultLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultItem: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  resultItemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    flex: 1,
  },
  resultItemDiff: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  diffPositive: {
    color: COLORS.success,
  },
  diffNegative: {
    color: COLORS.error,
  },
  resultItemDetails: {
    gap: SPACING.xs,
  },
  resultItemDetail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  resultActions: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

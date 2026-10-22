import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Modal,
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
  Warehouse,
  TransferDto,
  BaseUnit,
} from '../../services/inventoryService';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { filtrarLocal } from '../../utils/busquedaTexto';

type ScreenRouteProp = RouteProp<RootStackParamList, 'InventoryTransfer'>;

interface Product {
  id: string;
  name: string;
  presentation?: string;
  baseUnit?: BaseUnit;
}

export const InventoryTransferScreen: React.FC = () => {
  const route = useRoute<ScreenRouteProp>();
  const { warehouseId: defaultDestWarehouseId, warehouseName } = route.params;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState(defaultDestWarehouseId);
  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<BaseUnit>('UND');
  const [notes, setNotes] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [warehouseData, productData] = await Promise.all([
          inventoryService.getWarehouses(),
          inventoryService.getInsumos(),
        ]);
        setWarehouses(warehouseData);

        // Map products to work with
        const mapped = productData.map((p) => ({
          id: p.id,
          name: p.name,
          presentation: p.presentation ?? undefined,
          baseUnit: (p.baseUnit || 'UND') as BaseUnit,
        }));
        setProducts(mapped);

        // Set defaults
        const defaultFrom = warehouseData.find((w) => w.area === 'GENERAL');
        if (defaultFrom) setFromWarehouseId(defaultFrom.id);
      } catch (error) {
        console.error('[InventoryTransfer] Error loading data:', error);
        showAlert('Error', 'No se pudo cargar los datos');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async () => {
    // Validation
    if (!fromWarehouseId) {
      showAlert('Validación', 'Selecciona almacén de origen');
      return;
    }
    if (!toWarehouseId) {
      showAlert('Validación', 'Selecciona almacén de destino');
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      showAlert('Validación', 'El origen y destino no pueden ser iguales');
      return;
    }
    if (!productId) {
      showAlert('Validación', 'Selecciona un insumo');
      return;
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      showAlert('Validación', 'Ingresa una cantidad válida');
      return;
    }

    setIsSubmitting(true);
    try {
      const dto: TransferDto = {
        fromWarehouseId,
        toWarehouseId,
        productId,
        quantity: qty,
        unit,
        notes: notes.trim() || undefined,
      };

      await inventoryService.transfer(dto);
      showAlert('Éxito', 'Traslado registrado correctamente', [
        {
          text: 'OK',
          onPress: () => {
            setFromWarehouseId(
              warehouses.find((w) => w.area === 'GENERAL')?.id || '',
            );
            setToWarehouseId(defaultDestWarehouseId);
            setProductId('');
            setProductSearch('');
            setQuantity('');
            setUnit('UND');
            setNotes('');
          },
        },
      ]);
    } catch (error) {
      console.error('[InventoryTransfer] Error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      showAlert('Error', `${msg.slice(0, 200)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedFromWarehouse = warehouses.find(
    (w) => w.id === fromWarehouseId,
  );
  const selectedToWarehouse = warehouses.find((w) => w.id === toWarehouseId);

  const filteredProducts = filtrarLocal(products, productSearch, ['name']);

  const unitOptions: BaseUnit[] = ['GR', 'ML', 'UND'];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Origen */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Almacén de Origen</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowFromPicker(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="cube-outline" size={18} color={COLORS.primary} />
          <Text
            style={
              selectedFromWarehouse
                ? styles.pickerText
                : styles.pickerPlaceholder
            }
          >
            {selectedFromWarehouse?.name || 'Selecciona almacén'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={18}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Destino */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Almacén de Destino</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowToPicker(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="cube-outline" size={18} color={COLORS.primary} />
          <Text
            style={
              selectedToWarehouse ? styles.pickerText : styles.pickerPlaceholder
            }
          >
            {selectedToWarehouse?.name || 'Selecciona almacén'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={18}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Insumo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Insumo</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowProductPicker(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="barcode-outline" size={18} color={COLORS.primary} />
          <Text
            style={
              selectedProduct ? styles.pickerText : styles.pickerPlaceholder
            }
          >
            {selectedProduct?.name || 'Buscar insumo...'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={18}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
        {selectedProduct?.presentation && (
          <Text style={styles.helperText}>{selectedProduct.presentation}</Text>
        )}
      </View>

      {/* Cantidad */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cantidad</Text>
        <View style={styles.quantityRow}>
          <TextInput
            style={styles.quantityInput}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0.00"
            placeholderTextColor={COLORS.textLight}
            keyboardType="decimal-pad"
          />
          <TouchableOpacity
            style={styles.unitButton}
            onPress={() => setShowUnitPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.unitButtonText}>{unit}</Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notas (opcional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Agregar comentarios..."
          placeholderTextColor={COLORS.textLight}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <Button
          label="Registrar Traslado"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          icon={
            isSubmitting ? undefined : (
              <Ionicons name="send" size={18} color={COLORS.background} />
            )
          }
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </View>

      {/* Modals */}
      {/* From Warehouse Picker */}
      <Modal visible={showFromPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Almacén de Origen</Text>
              <TouchableOpacity onPress={() => setShowFromPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={warehouses}
              keyExtractor={(w) => w.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    fromWarehouseId === item.id && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setFromWarehouseId(item.id);
                    setShowFromPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      fromWarehouseId === item.id &&
                        styles.modalItemTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {fromWarehouseId === item.id && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* To Warehouse Picker */}
      <Modal visible={showToPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Almacén de Destino</Text>
              <TouchableOpacity onPress={() => setShowToPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={warehouses}
              keyExtractor={(w) => w.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    toWarehouseId === item.id && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setToWarehouseId(item.id);
                    setShowToPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      toWarehouseId === item.id && styles.modalItemTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {toWarehouseId === item.id && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Product Picker */}
      <Modal visible={showProductPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Insumo</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
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
                  style={[
                    styles.modalItem,
                    productId === item.id && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setProductId(item.id);
                    setShowProductPicker(false);
                  }}
                >
                  <View style={styles.modalItemContent}>
                    <Text
                      style={[
                        styles.modalItemText,
                        productId === item.id && styles.modalItemTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.presentation && (
                      <Text style={styles.modalItemSubtext}>
                        {item.presentation}
                      </Text>
                    )}
                  </View>
                  {productId === item.id && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Unit Picker */}
      <Modal visible={showUnitPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Unidad</Text>
              <TouchableOpacity onPress={() => setShowUnitPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {unitOptions.map((u) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.modalItem,
                  unit === u && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setUnit(u);
                  setShowUnitPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    unit === u && styles.modalItemTextSelected,
                  ]}
                >
                  {u}
                </Text>
                {unit === u && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  pickerText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  pickerPlaceholder: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
  },
  helperText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  quantityInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  unitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  unitButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  submitContainer: {
    marginTop: SPACING.xl,
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
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
  modalItemSelected: {
    backgroundColor: `${COLORS.primary}15`,
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  modalItemTextSelected: {
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  modalItemSubtext: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});

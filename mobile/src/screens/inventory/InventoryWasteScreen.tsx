import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import { inventoryService, BaseUnit } from '../../services/inventoryService';
import { uploadPaymentProof } from '../../services/storageService';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { filtrarLocal } from '../../utils/busquedaTexto';

type ScreenRouteProp = RouteProp<RootStackParamList, 'InventoryWaste'>;

interface Product {
  id: string;
  name: string;
  presentation?: string | null;
  baseUnit?: BaseUnit;
}

const WASTE_REASONS = [
  { id: 'dano', label: 'Se dañó' },
  { id: 'vencido', label: 'Vencido' },
  { id: 'caida', label: 'Se cayó' },
  { id: 'cocina', label: 'Error de cocina' },
  { id: 'otro', label: 'Otro' },
];

export const InventoryWasteScreen: React.FC = () => {
  const route = useRoute<ScreenRouteProp>();
  const { warehouseId, warehouseName } = route.params;

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<BaseUnit>('UND');
  const [reasonId, setReasonId] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        const data = await inventoryService.getInsumos();
        const mapped = data.map((p) => ({
          id: p.id,
          name: p.name,
          presentation: p.presentation,
          baseUnit: (p.baseUnit || 'UND') as BaseUnit,
        }));
        setProducts(mapped);
      } catch (error) {
        console.error('[InventoryWaste] Error loading products:', error);
        showAlert('Error', 'No se pudieron cargar los insumos');
      } finally {
        setIsLoading(false);
      }
    };
    loadProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);
  const unitOptions: BaseUnit[] = ['GR', 'ML', 'UND'];

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permisos', 'Se necesitan permisos para usar la cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permisos', 'Se necesitan permisos para acceder a la galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!productId) {
      showAlert('Validación', 'Selecciona un insumo');
      return;
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      showAlert('Validación', 'Ingresa una cantidad válida');
      return;
    }
    if (!reasonId) {
      showAlert('Validación', 'Selecciona un motivo');
      return;
    }
    if (reasonId === 'otro' && !customReason.trim()) {
      showAlert('Validación', 'Ingresa el motivo personalizado');
      return;
    }
    if (!photoUri) {
      showAlert('Validación', 'Se requiere una foto obligatoriamente');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload photo
      setIsUploading(true);
      let photoUrl: string;
      try {
        photoUrl = await uploadPaymentProof(photoUri, warehouseId, 0, {
          onProgress: (pct) => setUploadProgress(pct),
        });
      } catch (uploadError) {
        setIsUploading(false);
        console.error('[InventoryWaste] Photo upload failed:', uploadError);
        showAlert(
          'Error de foto',
          'No se pudo subir la imagen. Intenta de nuevo.',
        );
        throw uploadError;
      }
      setIsUploading(false);

      const reason =
        reasonId === 'otro'
          ? customReason.trim()
          : WASTE_REASONS.find((r) => r.id === reasonId)?.label || reasonId;

      await inventoryService.declareWaste({
        warehouseId,
        productId,
        quantity: qty,
        unit,
        reason,
        photoUrl,
      });

      showAlert('Éxito', 'Merma registrada correctamente', [
        {
          text: 'OK',
          onPress: () => {
            setProductId('');
            setProductSearch('');
            setQuantity('');
            setUnit('UND');
            setReasonId('');
            setCustomReason('');
            setPhotoUri(null);
            setUploadProgress(0);
          },
        },
      ]);
    } catch (error) {
      console.error('[InventoryWaste] Error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      // Don't show generic error if it was a photo upload error (already handled above)
      if (!msg.includes('foto') && !msg.includes('imagen')) {
        showAlert('Error', `${msg.slice(0, 200)}`);
      }
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const filteredProducts = filtrarLocal(products, productSearch, ['name']);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      {/* Motivo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Motivo</Text>
        <View style={styles.reasonChips}>
          {WASTE_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={[
                styles.reasonChip,
                reasonId === reason.id && styles.reasonChipSelected,
              ]}
              onPress={() => setReasonId(reason.id)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.reasonChipText,
                  reasonId === reason.id && styles.reasonChipTextSelected,
                ]}
              >
                {reason.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom reason input (if "Otro" selected) */}
        {reasonId === 'otro' && (
          <TextInput
            style={[styles.customReasonInput, { marginTop: SPACING.md }]}
            value={customReason}
            onChangeText={setCustomReason}
            placeholder="Describe el motivo..."
            placeholderTextColor={COLORS.textLight}
            multiline
            numberOfLines={2}
          />
        )}
      </View>

      {/* Foto Obligatoria */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: COLORS.error }]}>
          Foto (obligatoria)
        </Text>

        {photoUri ? (
          <View style={styles.photoPreviewContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.uploadingText}>{uploadProgress}%</Text>
              </View>
            )}
            {!isUploading && (
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={handleRemovePhoto}
              >
                <Ionicons name="close-circle" size={28} color={COLORS.error} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.photoButtonsContainer}>
            <View style={{ flex: 1 }}>
              <Button
                label="Tomar Foto"
                variant="ghost"
                size="md"
                icon={
                  <Ionicons
                    name="camera-outline"
                    size={28}
                    color={COLORS.primary}
                  />
                }
                onPress={handleTakePhoto}
                style={styles.photoButton}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Seleccionar"
                variant="ghost"
                size="md"
                icon={
                  <Ionicons
                    name="images-outline"
                    size={28}
                    color={COLORS.primary}
                  />
                }
                onPress={handlePickPhoto}
                style={styles.photoButton}
              />
            </View>
          </View>
        )}
      </View>

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <Button
          label="Registrar Merma"
          variant="primary"
          size="lg"
          loading={isSubmitting || isUploading}
          icon={
            isSubmitting || isUploading ? undefined : (
              <Ionicons name="send" size={18} color={COLORS.background} />
            )
          }
          onPress={handleSubmit}
          disabled={isSubmitting || isUploading || !photoUri}
        />
        {!photoUri && (
          <Text style={styles.photoRequiredText}>
            Requiere foto para continuar
          </Text>
        )}
      </View>

      {/* Product Picker Modal */}
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

      {/* Unit Picker Modal */}
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
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  reasonChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reasonChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  reasonChipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  reasonChipTextSelected: {
    color: COLORS.background,
  },
  customReasonInput: {
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
  photoButtonsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  photoButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: SPACING.sm,
  },
  photoButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  photoPreviewContainer: {
    position: 'relative',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  uploadingText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
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
  photoRequiredText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
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

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  useRoute,
  RouteProp,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  inventoryService,
  InsumoProduct,
} from '../../services/inventoryService';
import { api } from '../../services/api/apiClient';
import { bsToUsd } from '../../services/bcvRateService';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';

type ScreenRouteProp = RouteProp<RootStackParamList, 'CreateInsumo'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CreateInsumoScreen: React.FC = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Estados
  const [createInsumoName, setCreateInsumoName] = useState(
    route.params?.prefillName || '',
  );
  const [createInsumoPresentation, setCreateInsumoPresentation] = useState<
    'kg' | 'g' | 'l' | 'ml' | 'unidad'
  >('unidad');
  const [createInsumoContent, setCreateInsumoContent] = useState('');
  const [createInsumoArea, setCreateInsumoArea] = useState<
    'GENERAL' | 'COCINA' | 'PIZZERIA' | 'BARRA'
  >('GENERAL');
  const [createInsumoBarcode, setCreateInsumoBarcode] = useState(
    route.params?.prefillBarcode || '',
  );
  const [createInsumoPhoto, setCreateInsumoPhoto] = useState<string | null>(
    null,
  );
  const [isUploadingInsumoPhoto, setIsUploadingInsumoPhoto] = useState(false);
  const [isCreatingInsumo, setIsCreatingInsumo] = useState(false);
  const [createInsumoCost, setCreateInsumoCost] = useState('');
  const [createInsumoCostCurrency, setCreateInsumoCostCurrency] = useState<
    'BS' | 'USD'
  >('BS');
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [bcvEditableRate, setBcvEditableRate] = useState<string>('');

  // Cargar tasa BCV al montar
  useFocusEffect(
    useCallback(() => {
      const fetchBcvRate = async () => {
        try {
          const rateData = await api.get<{
            rate: number;
            source: string;
            timestamp: string;
          }>('/api/exchange/bcv-rate');
          if (typeof rateData.rate === 'number' && rateData.rate > 0) {
            setBcvRate(rateData.rate);
          } else {
            setBcvRate(null);
          }
        } catch (error) {
          console.error('[CreateInsumo] Error fetching BCV rate:', error);
          setBcvRate(null);
        }
      };
      fetchBcvRate();
    }, []),
  );

  // Tomar foto para el insumo
  const handleAddInsumoPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permisos', 'Se necesitan permisos de cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri;

      try {
        setIsUploadingInsumoPhoto(true);
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);

        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const rawExt = (uri.split('.').pop() || '').toLowerCase();
          const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt)
            ? rawExt
            : 'jpg';

          try {
            const uploadResponse = await api.post<{ url: string }>(
              '/api/uploads/image',
              {
                category: 'products',
                subPath: 'insumos',
                imageBase64: base64,
                extension: ext,
              },
              { timeoutMs: 60000 },
            );
            setCreateInsumoPhoto(uploadResponse.url);
            showAlert('Éxito', 'Foto subida correctamente');
          } catch (error) {
            console.error('Upload error:', error);
            showAlert('Error', 'No se pudo subir la foto');
          } finally {
            setIsUploadingInsumoPhoto(false);
          }
        };
      } catch (error) {
        console.error('Photo processing error:', error);
        showAlert('Error', 'Error procesando la foto');
        setIsUploadingInsumoPhoto(false);
      }
    }
  };

  // Crear insumo
  const handleCreateInsumo = async () => {
    if (!createInsumoName.trim()) {
      showAlert('Validación', 'Ingresa el nombre del insumo');
      return;
    }

    let costUsd: number | undefined;
    if (createInsumoCost.trim()) {
      const costValue = parseFloat(createInsumoCost.replace(',', '.'));
      if (isNaN(costValue) || costValue < 0) {
        showAlert('Validación', 'El costo debe ser un número válido');
        return;
      }
      if (createInsumoCostCurrency === 'USD') {
        costUsd = Math.round(costValue * 100) / 100;
      } else {
        const rate =
          bcvRate || (bcvEditableRate ? parseFloat(bcvEditableRate) : 0);
        if (!rate || rate <= 0) {
          showAlert(
            'Sin tasa BCV',
            'No hay tasa del día: cambia el costo a USD o ingresa la tasa manual',
          );
          return;
        }
        costUsd = Math.round(bsToUsd(costValue, rate) * 100) / 100;
      }
    }

    try {
      setIsCreatingInsumo(true);

      const presentationMap: Record<string, string> = {
        kg: 'kilogramo',
        g: 'gramo',
        l: 'litro',
        ml: 'mililitro',
        unidad: 'unidad',
      };

      const dto = {
        name: createInsumoName.trim(),
        presentation: presentationMap[createInsumoPresentation],
        presentationQuantity: createInsumoContent
          ? parseFloat(createInsumoContent)
          : undefined,
        area: createInsumoArea,
        barcode: createInsumoBarcode || undefined,
        imageUrl: createInsumoPhoto || undefined,
        cost: costUsd,
      };

      const newInsumo = await inventoryService.createInsumo(dto);

      showAlert('Éxito', `Insumo «${newInsumo.name}» creado correctamente`);

      // Volver a la pantalla anterior con el insumo creado
      navigation.goBack();

      // Post-delay para asegurar que la pantalla anterior está lista para recibir el param
      setTimeout(() => {
        if (route.params?.origin === 'OcrConfirm') {
          navigation.navigate('OcrConfirm', { createdInsumo: newInsumo });
        } else {
          navigation.navigate('RegisterPurchase', { createdInsumo: newInsumo });
        }
      }, 100);
    } catch (error) {
      console.error('[CreateInsumo] Create error:', error);
      const msg = error instanceof Error ? error.message : '';
      showAlert(
        'Error al crear el insumo',
        msg.slice(0, 200) || 'Intenta de nuevo',
      );
    } finally {
      setIsCreatingInsumo(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Nombre */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Nombre *</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Nombre del insumo"
            placeholderTextColor={COLORS.textSecondary}
            value={createInsumoName}
            onChangeText={setCreateInsumoName}
            editable={!isUploadingInsumoPhoto && !isCreatingInsumo}
          />
        </View>

        {/* Presentación */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Presentación</Text>
          <View style={styles.unitPicker}>
            {(['kg', 'g', 'l', 'ml', 'unidad'] as const).map((pres) => (
              <TouchableOpacity
                key={pres}
                style={[
                  styles.unitButton,
                  createInsumoPresentation === pres && styles.unitButtonActive,
                ]}
                onPress={() => setCreateInsumoPresentation(pres)}
                disabled={isUploadingInsumoPhoto || isCreatingInsumo}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    createInsumoPresentation === pres &&
                      styles.unitButtonTextActive,
                  ]}
                >
                  {pres}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contenido de la unidad de compra */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>
            Contenido de unidad de compra (ej: 45 {createInsumoPresentation})
          </Text>
          <TextInput
            style={styles.formInput}
            keyboardType="decimal-pad"
            placeholder="Opcional"
            placeholderTextColor={COLORS.textSecondary}
            value={createInsumoContent}
            onChangeText={setCreateInsumoContent}
            editable={!isUploadingInsumoPhoto && !isCreatingInsumo}
          />
        </View>

        {/* Área */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Área</Text>
          <View style={styles.unitPicker}>
            {(['GENERAL', 'COCINA', 'PIZZERIA', 'BARRA'] as const).map(
              (area) => (
                <TouchableOpacity
                  key={area}
                  style={[
                    styles.unitButton,
                    createInsumoArea === area && styles.unitButtonActive,
                  ]}
                  onPress={() => setCreateInsumoArea(area)}
                  disabled={isUploadingInsumoPhoto || isCreatingInsumo}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      createInsumoArea === area && styles.unitButtonTextActive,
                    ]}
                  >
                    {area.slice(0, 4)}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </View>

        {/* Código de barras */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Código de barras</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Opcional"
            placeholderTextColor={COLORS.textSecondary}
            value={createInsumoBarcode}
            onChangeText={setCreateInsumoBarcode}
            keyboardType="numeric"
            editable={!isUploadingInsumoPhoto && !isCreatingInsumo}
          />
        </View>

        {/* Costo de compra (opcional) */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>
            Costo de la unidad de compra (opcional)
          </Text>
          <View style={styles.unitPicker}>
            {(['BS', 'USD'] as const).map((cur) => (
              <TouchableOpacity
                key={cur}
                style={[
                  styles.unitButton,
                  createInsumoCostCurrency === cur && styles.unitButtonActive,
                ]}
                onPress={() => setCreateInsumoCostCurrency(cur)}
                disabled={isUploadingInsumoPhoto || isCreatingInsumo}
              >
                <Text
                  style={[
                    styles.unitButtonText,
                    createInsumoCostCurrency === cur &&
                      styles.unitButtonTextActive,
                  ]}
                >
                  {cur === 'BS' ? 'Bs' : '$ USD'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.formInput}
            keyboardType="decimal-pad"
            placeholder={
              createInsumoCostCurrency === 'BS' ? 'Ej: 3620,00 Bs' : 'Ej: 5.00'
            }
            placeholderTextColor={COLORS.textSecondary}
            value={createInsumoCost}
            onChangeText={setCreateInsumoCost}
            editable={!isUploadingInsumoPhoto && !isCreatingInsumo}
          />
          {createInsumoCostCurrency === 'BS' &&
            createInsumoCost.trim() !== '' &&
            (() => {
              const rate =
                bcvRate || (bcvEditableRate ? parseFloat(bcvEditableRate) : 0);
              const v = parseFloat(createInsumoCost.replace(',', '.'));
              if (!rate || rate <= 0 || isNaN(v)) return null;
              return (
                <Text style={styles.formLabel}>
                  ≈ ${bsToUsd(v, rate).toFixed(2)} USD (tasa {rate.toFixed(2)})
                </Text>
              );
            })()}
        </View>

        {/* Foto */}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Foto</Text>
          {isUploadingInsumoPhoto ? (
            <View style={styles.photoUploadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.photoUploadingText}>Subiendo foto...</Text>
            </View>
          ) : createInsumoPhoto ? (
            <View style={styles.photoPreviewContainer}>
              <Image
                source={{ uri: createInsumoPhoto }}
                style={styles.photoPreview}
              />
              <TouchableOpacity
                style={styles.photoRemoveButton}
                onPress={() => setCreateInsumoPhoto(null)}
                disabled={isCreatingInsumo}
              >
                <Ionicons name="close" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoUploadButton}
              onPress={handleAddInsumoPhoto}
              disabled={isUploadingInsumoPhoto || isCreatingInsumo}
            >
              <Ionicons name="camera" size={24} color={COLORS.primary} />
              <Text style={styles.photoUploadText}>Tomar foto</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Footer fijo con insets */}
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}
      >
        <TouchableOpacity
          style={[
            styles.formConfirmButton,
            (isCreatingInsumo || isUploadingInsumoPhoto) &&
              styles.formConfirmButtonDisabled,
          ]}
          onPress={handleCreateInsumo}
          disabled={isCreatingInsumo || isUploadingInsumoPhoto}
        >
          {isCreatingInsumo ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <Text style={styles.formConfirmButtonText}>Crear Insumo</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  formField: {
    marginBottom: SPACING.xl,
  },
  formLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  formInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  unitPicker: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    marginBottom: SPACING.md,
  },
  unitButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  unitButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  unitButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  unitButtonTextActive: {
    color: COLORS.background,
  },
  photoUploadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  photoUploadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  photoPreviewContainer: {
    position: 'relative',
    width: 150,
    height: 150,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
  },
  photoRemoveButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.full,
    padding: SPACING.sm,
  },
  photoUploadButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    gap: SPACING.md,
  },
  photoUploadText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  formConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  formConfirmButtonDisabled: {
    opacity: 0.6,
  },
  formConfirmButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
});

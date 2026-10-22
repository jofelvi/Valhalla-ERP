import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Switch,
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
  purchasesService,
  Supplier,
  PurchaseItem,
  CreatePurchaseDto,
} from '../../services/purchasesService';
import { genClientRequestId } from '../../services/orderService';
import {
  inventoryService,
  InsumoProduct,
  baseUnitFromPresentation,
} from '../../services/inventoryService';
import { api } from '../../services/api/apiClient';
import { bsToUsd, usdToBs } from '../../services/bcvRateService';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { BarcodeScannerModal } from '../../components/BarcodeScannerModal';
import { filtrarLocal } from '../../utils/busquedaTexto';

type ScreenRouteProp = RouteProp<RootStackParamList, 'RegisterPurchase'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ItemForForm {
  productId: string;
  productName: string;
  quantity: number;
  unit?: string;
  unitCost: number;
  currency?: 'USD' | 'BS';
  /** Renglon crudo de la factura: al guardar se aprende el alias del proveedor. */
  invoiceText?: string;
  /** Unidades por bulto con las que se expandio la cantidad. */
  unitsPerPack?: number;
}

export const RegisterPurchaseScreen: React.FC = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Estado general
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Datos del lugar
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  // Categoria del gasto: texto libre con sugerencias. Escribir una nueva la
  // crea, sin un ABM aparte que mantener ni categorias huerfanas.
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoria, setCategoria] = useState<string>('');
  const [showCategoriaPicker, setShowCategoriaPicker] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);

  // Insumos
  const [products, setProducts] = useState<InsumoProduct[]>([]);

  // Items
  const [items, setItems] = useState<ItemForForm[]>(
    route.params?.ocrItems || [],
  );
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [filteredItems, setFilteredItems] = useState<InsumoProduct[]>([]);
  const [selectedItem, setSelectedItem] = useState<InsumoProduct | null>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemUnit, setItemUnit] = useState('kg');
  const [itemCost, setItemCost] = useState('');
  const [itemCurrency, setItemCurrency] = useState<'USD' | 'BS'>('BS');
  const [itemCostUsd, setItemCostUsd] = useState('');
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [bcvSource, setBcvSource] = useState<string | null>(null);
  const [bcvEditableRate, setBcvEditableRate] = useState<string>('');

  // Fotos de factura
  const [invoicePhotos, setInvoicePhotos] = useState<string[]>([]);
  const [showOrigenFoto, setShowOrigenFoto] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [ocrPhotoIdx, setOcrPhotoIdx] = useState<number | null>(null);
  const [isOcring, setIsOcring] = useState(false);

  // Tasa BCV
  const [showCurrencyToggle, setShowCurrencyToggle] = useState(true);

  // Escáner de código de barras (modal)
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Idempotencia: un id por intento de guardado — reintentos por mala red no
  // duplican la compra (el backend devuelve la ya creada).
  const purchaseRequestIdRef = useRef(genClientRequestId());

  // Inicializar
  useEffect(() => {
    const initializeScreen = async () => {
      try {
        setIsLoading(true);

        // Cargar suppliers
        const supplierData = await purchasesService.getSuppliers();
        setSuppliers(supplierData);
        setFilteredSuppliers(supplierData);

        // Cargar productos
        const productData = await inventoryService.getInsumos();
        setProducts(productData);
        setFilteredItems(productData);

        purchasesService
          .listCategories()
          .then(setCategorias)
          .catch(() => setCategorias([]));

        // Obtener tasa BCV del backend
        try {
          const rateData = await api.get<{
            rate: number;
            source: string;
            timestamp: string;
          }>('/api/exchange/bcv-rate');
          if (typeof rateData.rate === 'number' && rateData.rate > 0) {
            if (rateData.source === 'fallback') {
              // Tasa no disponible, mostrar aviso y permitir editar
              setBcvRate(null);
              setBcvSource('fallback');
              setBcvEditableRate('');
            } else {
              // Tasa disponible
              setBcvRate(rateData.rate);
              setBcvSource(rateData.source);
              setBcvEditableRate('');
            }
          } else {
            setBcvRate(null);
            setBcvSource('error');
            setBcvEditableRate('');
          }
        } catch (error) {
          console.error('[RegisterPurchase] Error fetching BCV rate:', error);
          setBcvRate(null);
          setBcvSource('error');
          setBcvEditableRate('');
        }
      } catch (error) {
        console.error('[RegisterPurchase] Init error:', error);
        showAlert('Error', 'No se pudieron cargar los datos iniciales');
      } finally {
        setIsLoading(false);
      }
    };

    initializeScreen();
  }, []);

  // Filtrar suppliers
  useEffect(() => {
    setFilteredSuppliers(filtrarLocal(suppliers, supplierSearch, ['name']));
  }, [supplierSearch, suppliers]);

  // Filtrar productos
  useEffect(() => {
    setFilteredItems(filtrarLocal(products, itemSearch, ['name']));
  }, [itemSearch, products]);

  // Sincronizar item cost USD/BS
  useEffect(() => {
    if (itemCurrency === 'BS' && itemCost) {
      const rate =
        bcvRate || (bcvEditableRate ? parseFloat(bcvEditableRate) : 0);
      if (rate > 0) {
        const usd = bsToUsd(parseFloat(itemCost), rate);
        setItemCostUsd(isNaN(usd) ? '' : usd.toFixed(2));
      } else {
        setItemCostUsd('');
      }
    } else if (itemCurrency === 'USD' && itemCostUsd) {
      // Aquí simplemente mostramos el equivalente en BS
    }
  }, [itemCost, itemCurrency, bcvRate, bcvEditableRate]);

  // Manejar agregar item
  const handleAddItem = async () => {
    if (!selectedItem || !itemCost || !itemQty) {
      showAlert('Validación', 'Completa todos los campos del artículo');
      return;
    }

    // Si la moneda es BS y no hay tasa disponible, requiere ingresarla manualmente
    if (itemCurrency === 'BS' && !bcvRate && !bcvEditableRate) {
      showAlert('Validación', 'Ingresa la tasa BCV manualmente para continuar');
      return;
    }

    const cost = parseFloat(itemCost);
    if (isNaN(cost) || cost <= 0) {
      showAlert('Validación', 'El costo debe ser mayor a 0');
      return;
    }

    const qty = parseFloat(itemQty);
    if (isNaN(qty) || qty <= 0) {
      showAlert('Validación', 'La cantidad debe ser mayor a 0');
      return;
    }

    const newItem: ItemForForm = {
      productId: selectedItem.id,
      productName: selectedItem.name,
      quantity: qty,
      unit: itemUnit || 'und',
      unitCost: itemCurrency === 'BS' ? cost : parseFloat(itemCostUsd || '0'),
      currency: itemCurrency,
    };

    setItems([...items, newItem]);
    setSelectedItem(null);
    setItemQty('1');
    setItemUnit('kg');
    setItemCost('');
    setItemCostUsd('');
    setShowItemPicker(false);
    showAlert('Éxito', 'Artículo agregado');
  };

  // Remover item
  const removeItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
  };

  // Seleccionar producto
  const selectProduct = (product: InsumoProduct) => {
    setSelectedItem(product);
    setItemSearch('');
    const baseUnit = baseUnitFromPresentation(product.presentation);
    setItemUnit(baseUnit === 'GR' ? 'kg' : baseUnit === 'ML' ? 'l' : 'und');
    setShowItemPicker(false);
  };

  // Detectar si hay insumo creado desde CreateInsumoScreen
  useFocusEffect(
    useCallback(() => {
      if (route.params?.createdInsumo) {
        const newInsumo = route.params.createdInsumo;
        setProducts([...products, newInsumo]);
        setFilteredItems([...filteredItems, newInsumo]);
        selectProduct(newInsumo);
        navigation.setParams({ createdInsumo: undefined });
      }
    }, [route.params?.createdInsumo, products, filteredItems]),
  );

  // FEATURE 2: Buscar producto por código de barras exacto
  const handleSearchByBarcode = (codeToSearch?: string) => {
    const code = (codeToSearch || barcodeInput).trim();
    if (!code) {
      return;
    }

    const exactMatch = products.find((p) => p.barcode?.trim() === code);

    if (exactMatch) {
      selectProduct(exactMatch);
      setBarcodeInput('');
    } else {
      showAlert(
        'Código no encontrado',
        '¿Deseas crear un nuevo insumo con este código?',
        [
          {
            text: 'Crear',
            onPress: () => {
              navigation.navigate('CreateInsumo', {
                prefillBarcode: code,
                origin: 'RegisterPurchase',
              });
            },
          },
          {
            text: 'Cancelar',
            style: 'cancel',
          },
        ],
      );
    }
  };

  // FEATURE 2: Handler para código de barras escaneado desde el modal
  const handleBarcodeScanned = (code: string) => {
    setBarcodeInput(code);
    handleSearchByBarcode(code);
  };

  // Subir la imagen de la factura, venga de la camara o de un archivo.
  //
  // Antes SOLO abria la camara: si la factura llegaba por WhatsApp o ya estaba
  // guardada en el telefono (o en la PC, con la PWA), no habia forma de
  // adjuntarla y tocaba fotografiar la pantalla.
  const subirImagenFactura = async (uri: string) => {
    try {
      setIsUploadingPhotos(true);
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        // En web la URI puede ser blob/data sin extensión — sanear a las permitidas
        const rawExt = (uri.split('.').pop() || '').toLowerCase();
        const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt)
          ? rawExt
          : 'jpg';

        try {
          const uploadResponse = await api.post<{ url: string }>(
            '/api/uploads/image',
            {
              category: 'invoices',
              subPath: new Date().toISOString().slice(0, 7), // YYYY-MM
              imageBase64: base64,
              extension: ext,
            },
            { timeoutMs: 60000 },
          );
          setInvoicePhotos([...invoicePhotos, uploadResponse.url]);
          showAlert('Éxito', 'Factura adjuntada correctamente');
        } catch (error) {
          console.error('Upload error:', error);
          showAlert('Error', 'No se pudo subir la factura');
        } finally {
          setIsUploadingPhotos(false);
        }
      };
    } catch (error) {
      console.error('Photo processing error:', error);
      showAlert('Error', 'Error procesando la imagen');
      setIsUploadingPhotos(false);
    }
  };

  const tomarConCamara = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permisos', 'Se necesitan permisos de cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await subirImagenFactura(result.assets[0].uri);
    }
  };

  const elegirArchivo = async () => {
    // En web esto abre el explorador de archivos (el "adjunto"); en el telefono,
    // la galeria. No pide permiso de camara a proposito: no hace falta.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await subirImagenFactura(result.assets[0].uri);
    }
  };

  const handleAddPhoto = () => setShowOrigenFoto(true);

  // Manejar OCR
  const handleOcr = async (photoUrl: string, idx: number) => {
    // Sin proveedor no hay memoria que aplicar: el OCR igual lee, pero cada
    // renglon habria que mapearlo a mano otra vez. Mejor avisar antes.
    if (!selectedSupplier) {
      showAlert(
        'Elige el proveedor primero',
        'Con el proveedor seleccionado, la app reconoce sola los renglones que ya mapeaste en facturas anteriores.',
      );
      return;
    }

    try {
      setIsOcring(true);
      setOcrPhotoIdx(idx);

      // Descargar imagen y convertir a base64
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const ext = photoUrl.split('.').pop() || 'jpg';

        try {
          const ocrResult = await purchasesService.ocrInvoice(
            base64,
            ext,
            selectedSupplier?.id,
          );

          if (ocrResult.lines.length === 0) {
            showAlert(
              'OCR',
              'No se pudo leer la factura. Ingresa los datos manualmente.',
            );
          } else {
            // Navegar a OcrConfirmScreen
            navigation.navigate('OcrConfirm', {
              lines: ocrResult.lines,
            });
          }
        } catch (error) {
          console.error('OCR error:', error);
          showAlert('Error', 'No se pudo procesar la factura con OCR');
        } finally {
          setIsOcring(false);
          setOcrPhotoIdx(null);
        }
      };
    } catch (error) {
      console.error('Photo download error:', error);
      showAlert('Error', 'Error descargando la foto');
      setIsOcring(false);
      setOcrPhotoIdx(null);
    }
  };

  // Manejar guardar compra
  const handleSavePurchase = async () => {
    if (!selectedSupplier) {
      showAlert('Validación', 'Selecciona un lugar');
      return;
    }

    if (items.length === 0) {
      showAlert('Validación', 'Agrega al menos un artículo');
      return;
    }

    // Tasa a usar: la del backend o la editada manualmente
    const effectiveRate =
      bcvRate || (bcvEditableRate ? parseFloat(bcvEditableRate) : null);
    if (itemCurrency === 'BS' && (!effectiveRate || effectiveRate <= 0)) {
      showAlert(
        'Validación',
        'Ingresa la tasa BCV para guardar la compra en Bs',
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const dto: CreatePurchaseDto = {
        placeId: selectedSupplier.id,
        category: categoria.trim() || undefined,
        // sin warehouseId: el backend usa el almacén por defecto del área GENERAL
        clientRequestId: purchaseRequestIdRef.current,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit as 'kg' | 'gr' | 'l' | 'ml' | 'und' | 'unidad-compra',
          unitCost: item.unitCost,
          // Con esto el backend aprende como factura este proveedor.
          invoiceText: item.invoiceText,
          unitsPerPack: item.unitsPerPack,
        })),
        invoiceUrls: invoicePhotos,
        currency: itemCurrency,
        bcvRate:
          itemCurrency === 'BS' && effectiveRate ? effectiveRate : undefined,
      };

      const result = await purchasesService.createPurchase(dto);
      // Compra creada: el próximo guardado desde esta pantalla es otra compra
      purchaseRequestIdRef.current = genClientRequestId();

      if (result.alerts && result.alerts.length > 0) {
        showAlert(
          'Compra Registrada',
          `Se registró la compra.\n\n⚠️ ${result.alerts.length} variaciones de precio detectadas`,
        );
      } else {
        showAlert('Éxito', 'Compra registrada correctamente');
      }

      // Volver a lista de compras
      navigation.navigate('PurchasesList');
    } catch (error) {
      console.error('[RegisterPurchase] Save error:', error);
      showAlert('Error', 'No se pudo guardar la compra');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando datos...</Text>
      </View>
    );
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    // Android usa adjustPan (manifest): KAV con 'height' desalinea la ventana
    // y deja la UI intocable — KAV solo en iOS
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Categoria del gasto */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categoría de Compra</Text>
          <TouchableOpacity
            style={styles.supplierButton}
            onPress={() => setShowCategoriaPicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="pricetag" size={20} color={COLORS.primary} />
            <Text style={styles.supplierButtonText} numberOfLines={1}>
              {categoria || 'Seleccionar categoría...'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Selector de lugar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lugar de Compra</Text>
          <TouchableOpacity
            style={styles.supplierButton}
            onPress={() => setShowSupplierPicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="storefront" size={20} color={COLORS.primary} />
            <Text style={styles.supplierButtonText} numberOfLines={1}>
              {selectedSupplier?.name || 'Seleccionar lugar...'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Control de moneda */}
        <View style={styles.section}>
          <View style={styles.currencyHeader}>
            <Text style={styles.sectionTitle}>Moneda de Compra</Text>
            <View style={styles.currencyToggle}>
              <TouchableOpacity
                style={[
                  styles.currencyButton,
                  itemCurrency === 'BS' && styles.currencyButtonActive,
                ]}
                onPress={() => setItemCurrency('BS')}
              >
                <Text
                  style={[
                    styles.currencyButtonText,
                    itemCurrency === 'BS' && styles.currencyButtonTextActive,
                  ]}
                >
                  Bs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.currencyButton,
                  itemCurrency === 'USD' && styles.currencyButtonActive,
                ]}
                onPress={() => setItemCurrency('USD')}
              >
                <Text
                  style={[
                    styles.currencyButtonText,
                    itemCurrency === 'USD' && styles.currencyButtonTextActive,
                  ]}
                >
                  USD
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {bcvRate !== null ? (
            <View style={styles.rateInfo}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={COLORS.success}
              />
              <Text style={styles.rateText}>
                Tasa BCV: {bcvRate.toFixed(2)} ({bcvSource})
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.rateInfo, styles.rateWarning]}>
                <Ionicons name="warning" size={16} color={COLORS.warning} />
                <Text style={styles.rateWarningText}>
                  ⚠️ No se pudo obtener la tasa BCV — ingrésala manualmente
                </Text>
              </View>
              <TextInput
                style={styles.rateInput}
                keyboardType="decimal-pad"
                placeholder="Ingresa la tasa BCV (ej: 724.50)"
                placeholderTextColor={COLORS.textSecondary}
                value={bcvEditableRate}
                onChangeText={setBcvEditableRate}
              />
            </>
          )}
        </View>

        {/* Agregar artículos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Artículos ({totalItems})</Text>

          {/* FEATURE 2: Input de código de barras */}
          <View style={styles.barcodeContainer}>
            <View style={styles.barcodeInputWrapper}>
              <Ionicons name="barcode" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.barcodeInput}
                placeholder="Código de barras..."
                placeholderTextColor={COLORS.textSecondary}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                onSubmitEditing={() => handleSearchByBarcode()}
                keyboardType="numeric"
              />
              <TouchableOpacity
                onPress={() => handleSearchByBarcode()}
                disabled={!barcodeInput.trim()}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={
                    barcodeInput.trim() ? COLORS.primary : COLORS.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>

            {/* FEATURE 2: Botón de escanear */}
            <TouchableOpacity
              style={styles.scannerButton}
              onPress={() => setShowBarcodeScanner(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={20} color={COLORS.background} />
              <Text style={styles.scannerButtonText}>Escanear</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyText}>Sin artículos agregados</Text>
          ) : (
            items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemDetail}>
                    {item.quantity} {item.unit}
                  </Text>
                </View>
                <View style={styles.itemCostContainer}>
                  <Text style={styles.itemCostText}>
                    {item.currency} {item.unitCost.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeItem(idx)}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={COLORS.error}
                  />
                </TouchableOpacity>
              </View>
            ))
          )}

          <TouchableOpacity
            style={styles.addItemButton}
            onPress={() => setShowItemPicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={COLORS.background} />
            <Text style={styles.addItemButtonText}>Agregar Artículo</Text>
          </TouchableOpacity>
        </View>

        {/* Fotos de factura */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Facturas ({invoicePhotos.length})
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoScroll}
          >
            {invoicePhotos.map((photo, idx) => (
              <View key={idx} style={styles.photoContainer}>
                <Image source={{ uri: photo }} style={styles.photoThumbnail} />
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => handleOcr(photo, idx)}
                  disabled={isOcring}
                >
                  {isOcring && ocrPhotoIdx === idx ? (
                    <ActivityIndicator size="small" color={COLORS.background} />
                  ) : (
                    <>
                      <Ionicons
                        name="document-text"
                        size={16}
                        color={COLORS.background}
                      />
                      <Text style={styles.photoButtonText}>OCR</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.photoAddButton}
              onPress={handleAddPhoto}
              disabled={isUploadingPhotos}
            >
              {isUploadingPhotos ? (
                <ActivityIndicator size="large" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="camera" size={32} color={COLORS.primary} />
                  <Text style={styles.photoAddText}>Foto</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Botón guardar */}
      {selectedSupplier && items.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              isSubmitting && styles.saveButtonDisabled,
            ]}
            onPress={handleSavePurchase}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-done"
                  size={20}
                  color={COLORS.background}
                />
                <Text style={styles.saveButtonText}>Guardar Compra</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Modal selector de categoria del gasto */}
      {/* De dónde sale la factura: cámara o archivo ya guardado */}
      <Modal
        visible={showOrigenFoto}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOrigenFoto(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adjuntar factura</Text>
              <TouchableOpacity onPress={() => setShowOrigenFoto(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.origenOpcion}
              onPress={() => {
                setShowOrigenFoto(false);
                void tomarConCamara();
              }}
            >
              <Ionicons name="camera" size={22} color={COLORS.primary} />
              <Text style={styles.origenTexto}>Tomar foto con la cámara</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.origenOpcion}
              onPress={() => {
                setShowOrigenFoto(false);
                void elegirArchivo();
              }}
            >
              <Ionicons name="attach" size={22} color={COLORS.primary} />
              <Text style={styles.origenTexto}>
                Elegir archivo o imagen guardada
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCategoriaPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoriaPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Categoría de Compra</Text>
              <TouchableOpacity onPress={() => setShowCategoriaPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={categorias}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setCategoria(item);
                    setShowCategoriaPicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  {categoria === item && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
            />

            {/* Crear una nueva: escribirla la crea, sin ABM aparte */}
            <View style={styles.nuevaCategoriaRow}>
              <TextInput
                style={styles.nuevaCategoriaInput}
                placeholder="Nueva categoría..."
                placeholderTextColor={COLORS.textSecondary}
                value={nuevaCategoria}
                onChangeText={setNuevaCategoria}
              />
              <TouchableOpacity
                style={styles.modalNewButton}
                onPress={() => {
                  const nombre = nuevaCategoria.trim();
                  if (!nombre) return;
                  setCategorias((prev) =>
                    prev.includes(nombre) ? prev : [...prev, nombre].sort(),
                  );
                  setCategoria(nombre);
                  setNuevaCategoria('');
                  setShowCategoriaPicker(false);
                }}
              >
                <Ionicons name="add" size={20} color={COLORS.background} />
                <Text style={styles.modalNewButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal selector de supplier */}
      <Modal
        visible={showSupplierPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSupplierPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Lugar</Text>
              <TouchableOpacity onPress={() => setShowSupplierPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar lugar..."
                placeholderTextColor={COLORS.textSecondary}
                value={supplierSearch}
                onChangeText={setSupplierSearch}
              />
            </View>

            <FlatList
              data={filteredSuppliers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedSupplier(item);
                    setShowSupplierPicker(false);
                    setSupplierSearch('');
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.modalNewButton}
              onPress={() => {
                // Navegar a PlacesScreen
                setShowSupplierPicker(false);
                navigation.navigate('Places');
              }}
            >
              <Ionicons name="add" size={20} color={COLORS.background} />
              <Text style={styles.modalNewButtonText}>Nuevo Lugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal selector de item */}
      <Modal
        visible={showItemPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowItemPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Artículo</Text>
              <TouchableOpacity onPress={() => setShowItemPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {!selectedItem ? (
              <>
                <View style={styles.searchContainer}>
                  <Ionicons
                    name="search"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar artículo..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={itemSearch}
                    onChangeText={setItemSearch}
                  />
                </View>

                {filteredItems.length === 0 && itemSearch.trim() && (
                  <TouchableOpacity
                    style={styles.modalNewButton}
                    onPress={() => {
                      setShowItemPicker(false);
                      navigation.navigate('CreateInsumo', {
                        prefillName: itemSearch,
                        origin: 'RegisterPurchase',
                      });
                    }}
                  >
                    <Ionicons name="add" size={20} color={COLORS.background} />
                    <Text style={styles.modalNewButtonText}>
                      + Crear insumo «{itemSearch}»
                    </Text>
                  </TouchableOpacity>
                )}

                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={() => selectProduct(item)}
                    >
                      <Text style={styles.modalItemText}>{item.name}</Text>
                      {item.presentation && (
                        <Text style={styles.modalItemSubtext}>
                          {item.presentation}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : (
              <ScrollView style={styles.itemFormContainer}>
                <Text style={styles.itemFormTitle}>{selectedItem.name}</Text>

                {/* Cantidad */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Cantidad</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={COLORS.textSecondary}
                    value={itemQty}
                    onChangeText={setItemQty}
                  />
                </View>

                {/* Unidad */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Unidad</Text>
                  <View style={styles.unitPicker}>
                    {['kg', 'gr', 'l', 'ml', 'und'].map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitButton,
                          itemUnit === unit && styles.unitButtonActive,
                        ]}
                        onPress={() => setItemUnit(unit)}
                      >
                        <Text
                          style={[
                            styles.unitButtonText,
                            itemUnit === unit && styles.unitButtonTextActive,
                          ]}
                        >
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Costo */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>
                    Costo por {itemUnit} ({itemCurrency})
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textSecondary}
                    value={itemCost}
                    onChangeText={setItemCost}
                  />
                </View>

                {/* Equivalente en otra moneda */}
                {itemCost && itemCurrency === 'BS' && (
                  <View style={styles.equivalentContainer}>
                    <Ionicons
                      name="swap-horizontal"
                      size={16}
                      color={COLORS.info}
                    />
                    <Text style={styles.equivalentText}>
                      ≈ ${itemCostUsd} USD
                    </Text>
                  </View>
                )}

                {/* Botón agregar */}
                <TouchableOpacity
                  style={styles.formConfirmButton}
                  onPress={handleAddItem}
                >
                  <Text style={styles.formConfirmButtonText}>
                    Agregar Artículo
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de escáner de código de barras */}
      <BarcodeScannerModal
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScanned={handleBarcodeScanned}
      />
    </KeyboardAvoidingView>
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
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  supplierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOWS.small,
  },
  supplierButtonText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
  },
  currencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  currencyToggle: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  currencyButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  currencyButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  currencyButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  currencyButtonTextActive: {
    color: COLORS.background,
  },
  rateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: `${COLORS.info}15`,
    borderRadius: BORDER_RADIUS.md,
  },
  rateText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.info,
  },
  rateWarning: {
    backgroundColor: `${COLORS.warning}15`,
    marginBottom: SPACING.md,
  },
  rateWarningText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.warning,
    fontWeight: FONT_WEIGHT.medium,
  },
  rateInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  itemDetail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  itemCostContainer: {
    marginHorizontal: SPACING.md,
  },
  itemCostText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  addItemButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  origenOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  origenTexto: { color: COLORS.text, fontSize: FONT_SIZE.md },
  photoScroll: {
    marginVertical: SPACING.md,
  },
  photoContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  photoThumbnail: {
    width: 120,
    height: 160,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  photoButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  photoButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  photoAddButton: {
    width: 120,
    height: 160,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  photoAddText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  modalItem: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalItemText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  modalItemSubtext: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  nuevaCategoriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  nuevaCategoriaInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  modalNewButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  itemFormContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  itemFormTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  formField: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  formInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  unitPicker: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  unitButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  unitButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  unitButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  unitButtonTextActive: {
    color: COLORS.background,
  },
  equivalentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: `${COLORS.info}15`,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  equivalentText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.info,
  },
  formConfirmButton: {
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    ...SHADOWS.small,
  },
  formConfirmButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  formConfirmButtonDisabled: {
    opacity: 0.6,
  },
  // FEATURE 2: Código de barras
  barcodeContainer: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  barcodeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  barcodeInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  scannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  scannerButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
});

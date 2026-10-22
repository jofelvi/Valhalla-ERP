import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
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
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../../constants';
import { useModal } from '../../hooks/useModal';
import { purchasesService, OcrLine } from '../../services/purchasesService';
import {
  inventoryService,
  InsumoProduct,
} from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { BarcodeScannerModal } from '../../components/BarcodeScannerModal';
import { filtrarLocal } from '../../utils/busquedaTexto';

type ScreenRouteProp = RouteProp<RootStackParamList, 'OcrConfirm'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface OcrLineWithState extends OcrLine {
  discarded?: boolean;
  qtyEdited?: number;
  costEdited?: number;
}

export const OcrConfirmScreen: React.FC = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [lines, setLines] = useState<OcrLineWithState[]>(
    route.params?.lines || [],
  );
  const [products, setProducts] = useState<InsumoProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number | null>(null);
  const productModal = useModal('productSelectorModal');
  const [searchText, setSearchText] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<InsumoProduct[]>([]);

  // Estado para escaneo de EAN
  const barcodeScanner = useModal('barcodeScannerModal');
  const [selectedLineIdxForScan, setSelectedLineIdxForScan] = useState<
    number | null
  >(null);
  const [isUpdatingBarcode, setIsUpdatingBarcode] = useState(false);

  // Ref para guardar el índice de línea cuando se crea insumo
  const createInsumoForLineIdxRef = useRef<number | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        const data = await inventoryService.getInsumos();
        setProducts(data);
      } catch (error) {
        console.error('[OcrConfirmScreen] Error loading products:', error);
        showAlert('Error', 'No se pudieron cargar los insumos');
      } finally {
        setIsLoading(false);
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    setFilteredProducts(filtrarLocal(products, searchText, ['name']));
  }, [searchText, products]);

  const toggleLineDiscarded = (idx: number) => {
    const updated = [...lines];
    updated[idx].discarded = !updated[idx].discarded;
    setLines(updated);
  };

  const editLineQty = (idx: number, qty: number) => {
    const updated = [...lines];
    updated[idx].qtyEdited = qty;
    setLines(updated);
  };

  const editLineCost = (idx: number, cost: number) => {
    const updated = [...lines];
    updated[idx].costEdited = cost;
    setLines(updated);
  };

  const selectProduct = (product: InsumoProduct) => {
    if (selectedLineIdx !== null) {
      const updated = [...lines];
      updated[selectedLineIdx].matchedProductId = product.id;
      updated[selectedLineIdx].matchedProductName = product.name;
      setLines(updated);
      productModal.close();
      setSearchText('');
      setSelectedLineIdx(null);
    }
  };

  // Manejar escaneo de EAN en la línea
  const handleBarcodeScanned = async (code: string) => {
    if (selectedLineIdxForScan === null) return;

    try {
      setIsUpdatingBarcode(true);
      const line = lines[selectedLineIdxForScan];

      if (line.matchedProductId) {
        // Línea ya matcheada: actualizar producto con barcode
        const matchedProduct = products.find(
          (p) => p.id === line.matchedProductId,
        );
        if (!matchedProduct) {
          showAlert('Error', 'Producto no encontrado');
          return;
        }

        // Verificar si el producto ya tiene barcode diferente
        if (matchedProduct.barcode && matchedProduct.barcode !== code) {
          showAlert(
            'Barcode existente',
            `Este producto ya tiene código: ${matchedProduct.barcode}\n\n¿Deseas sobrescribirlo?`,
            [
              {
                text: 'Sobrescribir',
                onPress: async () => {
                  try {
                    await productService.updateProduct(matchedProduct.id, {
                      barcode: code,
                    });
                    // Actualizar la lista local de productos
                    const updatedProducts = products.map((p) =>
                      p.id === matchedProduct.id ? { ...p, barcode: code } : p,
                    );
                    setProducts(updatedProducts);
                    showAlert(
                      'Éxito',
                      `Código guardado en ${matchedProduct.name}`,
                    );
                  } catch (error) {
                    console.error(
                      '[OcrConfirmScreen] Error updating barcode:',
                      error,
                    );
                    showAlert('Error', 'No se pudo actualizar el código');
                  }
                },
              },
              { text: 'Cancelar', style: 'cancel' },
            ],
          );
        } else {
          // Sin barcode o igual al actual: guardar
          try {
            await productService.updateProduct(matchedProduct.id, {
              barcode: code,
            });
            // Actualizar la lista local
            const updatedProducts = products.map((p) =>
              p.id === matchedProduct.id ? { ...p, barcode: code } : p,
            );
            setProducts(updatedProducts);
            showAlert('Éxito', `Código guardado en ${matchedProduct.name}`);
          } catch (error) {
            console.error('[OcrConfirmScreen] Error updating barcode:', error);
            showAlert('Error', 'No se pudo actualizar el código');
          }
        }
      } else {
        // Línea sin matchear: buscar en catálogo
        const existingProduct = products.find(
          (p) => p.barcode?.trim() === code.trim(),
        );

        if (existingProduct) {
          // Encontrado: vincular automáticamente
          const updated = [...lines];
          updated[selectedLineIdxForScan].matchedProductId = existingProduct.id;
          updated[selectedLineIdxForScan].matchedProductName =
            existingProduct.name;
          setLines(updated);
          showAlert('Éxito', `Vinculado a "${existingProduct.name}"`);
        } else {
          // No existe: navegar a crear insumo
          createInsumoForLineIdxRef.current = selectedLineIdxForScan;
          navigation.navigate('CreateInsumo', {
            prefillName: line.text,
            prefillBarcode: code,
            origin: 'OcrConfirm',
          });
        }
      }
    } catch (error) {
      console.error('[OcrConfirmScreen] Error handling barcode scan:', error);
      showAlert('Error', 'Error procesando el código');
    } finally {
      setIsUpdatingBarcode(false);
      setSelectedLineIdxForScan(null);
      barcodeScanner.close();
    }
  };

  // Detectar si hay insumo creado desde CreateInsumoScreen
  useFocusEffect(
    useCallback(() => {
      if (route.params?.createdInsumo) {
        const newInsumo = route.params.createdInsumo;
        const lineIdx = createInsumoForLineIdxRef.current;

        // Actualizar lista local
        setProducts([...products, newInsumo]);

        // Vincular la línea al producto nuevo
        if (lineIdx !== null) {
          const updated = [...lines];
          updated[lineIdx].matchedProductId = newInsumo.id;
          updated[lineIdx].matchedProductName = newInsumo.name;
          setLines(updated);
          showAlert('Éxito', `Insumo «${newInsumo.name}» creado y vinculado`);
        }

        // Limpiar
        createInsumoForLineIdxRef.current = null;
        navigation.setParams({ createdInsumo: undefined });
      }
    }, [route.params?.createdInsumo, products, lines]),
  );

  /**
   * Expande el bulto a unidades: 15 cajas x 36 = 540 botellas, y el costo pasa
   * de 23,01 por caja a 0,639 por botella.
   *
   * Solo se aplica a insumos que se llevan por unidad. En uno que se mide por
   * peso la expansion mentiria: "3.6KGx4UN" son 4 envases de 3,6 kg, no 4
   * unidades, y multiplicar ahi inflaria el inventario cuatro veces.
   */
  const expandirBulto = (line: OcrLineWithState) => {
    const cantidadFacturada = line.qtyEdited ?? line.qty;
    const costoPorBulto = line.costEdited ?? line.unitCost;
    const contenido = line.unitsPerPack ?? null;
    const producto = products.find((p) => p.id === line.matchedProductId);

    // La columna de la factura manda: "15 C" son cajas y hay que expandir;
    // "2 U" son unidades sueltas y expandir inflaria el inventario. Cuando el
    // OCR no logro leer esa letra se cae al criterio del insumo.
    const facturadoSuelto = line.invoiceUnit === 'UNIDAD';
    const facturadoEnBulto =
      line.invoiceUnit === 'CAJA' || line.invoiceUnit === 'BULTO';

    const aplica =
      !!contenido &&
      contenido > 1 &&
      !facturadoSuelto &&
      producto?.baseUnit === 'UND';

    if (!aplica || !contenido) {
      return {
        cantidad: cantidadFacturada,
        costoUnitario: costoPorBulto,
        contenido: null as number | null,
        aplica: false,
        etiqueta: '',
      };
    }

    return {
      cantidad: cantidadFacturada * contenido,
      costoUnitario: costoPorBulto / contenido,
      contenido,
      aplica: true,
      etiqueta: facturadoEnBulto
        ? line.invoiceUnit === 'CAJA'
          ? cantidadFacturada === 1
            ? 'caja'
            : 'cajas'
          : cantidadFacturada === 1
            ? 'bulto'
            : 'bultos'
        : '',
    };
  };

  const countValidLines = (): number => {
    return lines.filter((l) => !l.discarded).length;
  };

  const handleAddToCart = () => {
    const validLines = lines.filter((l) => !l.discarded && l.matchedProductId);
    if (validLines.length === 0) {
      showAlert('Validación', 'Debes tener al menos un artículo seleccionado');
      return;
    }

    // Pasar los items confirmados de vuelta a RegisterPurchaseScreen
    // En una implementación real, usarías la navegación para pasar datos
    navigation.navigate('RegisterPurchase', {
      ocrItems: validLines.map((line) => {
        const bulto = expandirBulto(line);
        return {
          productId: line.matchedProductId || '',
          productName: line.matchedProductName || '',
          quantity: bulto.cantidad,
          unitCost: bulto.costoUnitario,
          // Se manda siempre el texto crudo: es lo que el backend convierte en
          // alias para que la proxima factura se reconozca sola.
          invoiceText: line.text,
          unitsPerPack: line.unitsPerPack ?? undefined,
        };
      }),
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando insumos...</Text>
      </View>
    );
  }

  const validCount = countValidLines();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.headerTitle}>Confirmar Lectura OCR</Text>
          <Text style={styles.headerSubtitle}>
            {lines.length} líneas — {validCount} válidas
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Lista de líneas OCR */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {lines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={48}
              color={COLORS.textSecondary}
            />
            <Text style={styles.emptyText}>
              No se detectaron líneas en la factura
            </Text>
          </View>
        ) : (
          lines.map((line, idx) => (
            <View
              key={idx}
              style={[
                styles.lineCard,
                line.discarded && styles.lineCardDiscarded,
              ]}
            >
              {/* Header de línea */}
              <View style={styles.lineHeader}>
                <TouchableOpacity
                  style={styles.discardButton}
                  onPress={() => toggleLineDiscarded(idx)}
                >
                  <Ionicons
                    name={
                      line.discarded
                        ? 'close-circle'
                        : 'checkmark-circle-outline'
                    }
                    size={24}
                    color={line.discarded ? COLORS.error : COLORS.success}
                  />
                </TouchableOpacity>

                <View style={styles.lineText}>
                  <Text
                    style={[
                      styles.lineRawText,
                      line.discarded && styles.textStrike,
                    ]}
                  >
                    "{line.text}"
                  </Text>
                  {line.source === 'alias' ? (
                    <View style={styles.aprendidoChip}>
                      <Ionicons
                        name="sparkles"
                        size={12}
                        color={COLORS.success}
                      />
                      <Text style={styles.aprendidoTexto}>
                        Reconocido de facturas anteriores
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.lineScore}>
                      Confianza: {(line.score * 100).toFixed(0)}%
                    </Text>
                  )}
                  {(() => {
                    const bulto = expandirBulto(line);
                    if (!bulto.aplica) return null;
                    return (
                      <Text style={styles.bultoTexto}>
                        {line.qtyEdited ?? line.qty}
                        {bulto.etiqueta ? ' ' + bulto.etiqueta : ''} x{' '}
                        {bulto.contenido} ={' '}
                        <Text style={styles.bultoFuerte}>
                          {bulto.cantidad} und
                        </Text>
                        {'  ·  '}
                        {bulto.costoUnitario.toFixed(3)} c/u
                      </Text>
                    );
                  })()}
                </View>
              </View>

              {/* Datos editables */}
              {!line.discarded && (
                <View style={styles.lineData}>
                  {/* Producto + Botones */}
                  <View style={styles.productRow}>
                    <TouchableOpacity
                      style={[
                        styles.productSelector,
                        styles.productSelectorFlex,
                      ]}
                      onPress={() => {
                        setSelectedLineIdx(idx);
                        productModal.open();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.productLabel}>Artículo</Text>
                      <Text style={styles.productValue} numberOfLines={1}>
                        {line.matchedProductName || 'Sin seleccionar'}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>

                    {/* Botón escanear EAN */}
                    <TouchableOpacity
                      style={styles.scanEanButton}
                      onPress={() => {
                        setSelectedLineIdxForScan(idx);
                        barcodeScanner.open();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="barcode-outline"
                        size={20}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>

                    {/* Chip EAN si existe */}
                    {line.matchedProductId &&
                      products.find((p) => p.id === line.matchedProductId)
                        ?.barcode && (
                        <View style={styles.eanChip}>
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={COLORS.success}
                          />
                          <Text style={styles.eanChipText}>EAN</Text>
                        </View>
                      )}
                  </View>

                  {/* Cantidad */}
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Cantidad</Text>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="decimal-pad"
                      value={String(
                        line.qtyEdited !== undefined
                          ? line.qtyEdited
                          : line.qty,
                      )}
                      onChangeText={(text) =>
                        editLineQty(idx, parseFloat(text) || 0)
                      }
                      placeholder="0"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>

                  {/* Costo */}
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Costo Bs</Text>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="decimal-pad"
                      value={String(
                        line.costEdited !== undefined
                          ? line.costEdited
                          : line.unitCost,
                      )}
                      onChangeText={(text) =>
                        editLineCost(idx, parseFloat(text) || 0)
                      }
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Botones de acción */}
      {lines.length > 0 && validCount > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Descartar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleAddToCart}
          >
            <Ionicons name="add-circle" size={20} color={COLORS.background} />
            <Text style={styles.confirmButtonText}>
              Agregar {validCount} {validCount === 1 ? 'artículo' : 'artículos'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal selector de producto */}
      <Modal
        visible={productModal.isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => productModal.close()}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Artículo</Text>
              <TouchableOpacity onPress={() => productModal.close()}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Búsqueda */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar artículo..."
                placeholderTextColor={COLORS.textSecondary}
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText !== '' && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Lista de productos */}
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productItem}
                  onPress={() => selectProduct(item)}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={styles.productItemName}>{item.name}</Text>
                    {item.presentation && (
                      <Text style={styles.productItemPresentation}>
                        {item.presentation}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de escaneo de EAN */}
      <BarcodeScannerModal
        visible={barcodeScanner.isOpen && isUpdatingBarcode === false}
        onClose={() => {
          barcodeScanner.close();
          setSelectedLineIdxForScan(null);
        }}
        onScanned={handleBarcodeScanned}
      />
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
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  lineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  lineCardDiscarded: {
    opacity: 0.5,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  discardButton: {
    padding: SPACING.sm,
  },
  lineText: {
    flex: 1,
  },
  lineRawText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  textStrike: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  lineScore: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  aprendidoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aprendidoTexto: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    flexShrink: 1,
  },
  bultoTexto: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bultoFuerte: {
    fontWeight: '700',
    color: COLORS.text,
  },
  lineData: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  productSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  productLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING.md,
    minWidth: 70,
  },
  productValue: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
  },
  fieldContainer: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  fieldInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...SHADOWS.small,
  },
  confirmButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
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
    maxHeight: '80%',
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
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  productItemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  productItemPresentation: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  // Escaneo de EAN
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  productSelectorFlex: {
    flex: 1,
  },
  scanEanButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
  },
  eanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.success}20`,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  eanChipText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.success,
  },
  // ScrollView adicional
  scrollViewContainer: {
    paddingBottom: SPACING.xl,
  },
});

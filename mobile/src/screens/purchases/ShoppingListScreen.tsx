import React, { useState, useEffect } from 'react';
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
  Switch,
  Share,
} from 'react-native';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
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
  shoppingListService,
  ShoppingList,
  SuggestedItem,
  ShoppingListItem,
} from '../../services/shoppingListService';
import {
  inventoryService,
  InsumoProduct,
} from '../../services/inventoryService';
import { useAuthStore } from '../../store';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { useBusqueda } from '../../hooks/useBusqueda';
import { formatearUsd } from '../../utils/dinero';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'ShoppingList'>;

const mapAreaToStation = (area?: string): 'COCINA' | 'PIZZERIA' | 'BARRA' => {
  switch (area) {
    case 'PIZZERIA':
      return 'PIZZERIA';
    case 'BARRA':
      return 'BARRA';
    default:
      return 'COCINA';
  }
};

export const ShoppingListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const user = useAuthStore((state) => state.user);
  const warehouseArea = route.params?.warehouseArea;
  const station = mapAreaToStation(warehouseArea);

  // Estado
  const [currentList, setCurrentList] = useState<ShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Agregar item manual
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [products, setProducts] = useState<InsumoProduct[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<InsumoProduct | null>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemUnit, setItemUnit] = useState('und');

  useFocusEffect(
    React.useCallback(() => {
      loadList();
    }, []),
  );

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await inventoryService.getInsumos();
        setProducts(data);
      } catch (error) {
        console.error('[ShoppingListScreen] Error loading products:', error);
      }
    };
    loadProducts();
  }, []);

  const loadList = async () => {
    try {
      setIsLoading(true);
      const list = await shoppingListService.getCurrentList();
      setCurrentList(list);
    } catch (error) {
      console.error('[ShoppingListScreen] Error loading list:', error);
      showAlert('Error', 'No se pudo cargar la lista');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = useBusqueda(products, itemSearch, ['name']);

  const handleGenerateSuggestions = async () => {
    try {
      setIsGenerating(true);

      // Obtener sugerencias (sin área específica por ahora)
      const suggestions = await shoppingListService.getSuggestions();

      if (suggestions.length === 0) {
        showAlert('Sugerencias', 'No hay sugerencias para esta semana');
        setIsGenerating(false);
        return;
      }

      // Proponer los items
      const proposeDto = {
        station,
        items: suggestions.map((s) => ({
          productId: s.productId,
          quantity: s.suggestedQty,
          unit: s.unit,
          reason: s.reason,
        })),
      };

      const newList = await shoppingListService.proposeItems(proposeDto);
      setCurrentList(newList);
      showAlert('Éxito', `${suggestions.length} artículos sugeridos agregados`);
    } catch (error) {
      console.error(
        '[ShoppingListScreen] Error generating suggestions:',
        error,
      );
      showAlert('Error', 'No se pudieron generar las sugerencias');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBuildAiPlan = async () => {
    if (!currentList?.id || isGeneratingPlan) return;

    try {
      setIsGeneratingPlan(true);
      const updated = await shoppingListService.buildAiPlan(currentList.id);
      setCurrentList(updated);

      if (updated.aiError) {
        showAlert('Información', `IA no disponible: ${updated.aiError}`);
      } else {
        showAlert('Éxito', 'Plan por lugar generado');
      }
    } catch (error) {
      console.error('[ShoppingListScreen] Error building AI plan:', error);
      showAlert('Error', 'No se pudo generar el plan');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleAddManualItem = async () => {
    if (!selectedItem || !itemQty) {
      showAlert('Validación', 'Completa todos los campos');
      return;
    }

    if (!currentList) {
      showAlert('Error', 'No hay lista activa');
      return;
    }

    try {
      setIsSubmitting(true);
      const qty = parseFloat(itemQty);

      const proposeDto = {
        station,
        items: [
          {
            productId: selectedItem.id,
            quantity: qty,
            unit: itemUnit,
            reason: 'Manual',
          },
        ],
      };

      const updated = await shoppingListService.proposeItems(proposeDto);
      setCurrentList(updated);
      setShowAddItemModal(false);
      setSelectedItem(null);
      setItemQty('1');
      setItemUnit('und');
      setItemSearch('');
      showAlert('Éxito', 'Artículo agregado a la lista');
    } catch (error) {
      console.error('[ShoppingListScreen] Error adding item:', error);
      showAlert('Error', 'No se pudo agregar el artículo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePurchased = async (
    productId: string,
    currentValue: boolean,
  ) => {
    if (!currentList) return;

    try {
      const updated = await shoppingListService.updateListItem(
        currentList.id,
        productId,
        { purchased: !currentValue },
      );
      setCurrentList(updated);
    } catch (error) {
      console.error('[ShoppingListScreen] Error updating item:', error);
      showAlert('Error', 'No se pudo actualizar el artículo');
    }
  };

  const handleDiscardItem = async (productId: string) => {
    if (!currentList) return;

    try {
      const updated = await shoppingListService.updateListItem(
        currentList.id,
        productId,
        { discarded: true },
      );
      setCurrentList(updated);
    } catch (error) {
      console.error('[ShoppingListScreen] Error discarding item:', error);
      showAlert('Error', 'No se pudo descartar el artículo');
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const handleApproveList = async () => {
    if (!currentList) return;

    try {
      setIsSubmitting(true);
      const updated = await shoppingListService.approveList(currentList.id);
      setCurrentList(updated);
      showAlert('Éxito', 'Lista aprobada');
    } catch (error) {
      console.error('[ShoppingListScreen] Error approving list:', error);
      showAlert('Error', 'No se pudo aprobar la lista');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareList = async () => {
    if (!currentList) return;

    const items = currentList.items
      .filter((item) => !item.discarded)
      .map(
        (item) =>
          `• ${item.productName} — ${item.adjustedQty || item.suggestedQty} ${item.unit}`,
      )
      .join('\n');

    let message = `Lista de Compras - Semana ${currentList.weekStart.toLocaleDateString('es-VE')}\n\n${items}`;

    // Incluir plan por lugar si existe
    if (currentList.aiPlanByPlace && currentList.aiPlanByPlace.length > 0) {
      message += '\n\n── Plan por Lugar ──\n';
      for (const group of currentList.aiPlanByPlace) {
        message += `\n${group.placeName}:\n`;
        for (const item of group.items) {
          message += `  • ${item.productName} — ${item.qty ?? 0} ${item.unit}\n`;
        }
        message += `  Total estimado: ${formatearUsd(group.estimatedTotal)}`;
        if (group.savingsVsWorst > 0) {
          message += ` (Ahorro: ${formatearUsd(group.savingsVsWorst)})`;
        }
        message += '\n';
      }

      if (currentList.aiSummary) {
        message += `\n── Resumen IA ──\n${currentList.aiSummary}`;
      }
    }

    try {
      await Share.share({
        message,
        title: 'Lista de Compras',
      });
    } catch (error) {
      console.error('[ShoppingListScreen] Error sharing list:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando lista...</Text>
      </View>
    );
  }

  if (!currentList) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="clipboard-outline"
            size={48}
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyText}>Sin lista de compras esta semana</Text>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateSuggestions}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color={COLORS.background} />
                <Text style={styles.generateButtonText}>
                  Generar Sugerencias
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const validItems = currentList.items.filter((item) => !item.discarded);
  const purchasedCount = validItems.filter((item) => item.purchased).length;

  return (
    <View style={styles.container}>
      {/* Header con info de la lista */}
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.headerTitle}>Lista de Compras</Text>
          <Text style={styles.headerSubtitle}>
            {currentList.status === 'APROBADA' ? '✓' : '○'} {purchasedCount}/
            {validItems.length} completadas
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShareList}
          >
            <Ionicons name="share-social" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          {isAdmin && currentList.status !== 'APROBADA' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleApproveList}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons
                  name="checkmark-done"
                  size={20}
                  color={COLORS.success}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Botón generar sugerencias */}
      {validItems.length === 0 && (
        <TouchableOpacity
          style={styles.generateButtonContainer}
          onPress={handleGenerateSuggestions}
          disabled={isGenerating}
        >
          <Ionicons name="sparkles" size={20} color={COLORS.background} />
          <Text style={styles.generateButtonContainerText}>
            Generar Sugerencias
          </Text>
        </TouchableOpacity>
      )}

      {/* Banner de error AI (si existe) */}
      {currentList.aiError && (
        <View style={styles.aiErrorBanner}>
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={COLORS.warning}
          />
          <Text style={styles.aiErrorText}>
            IA no disponible: {currentList.aiError}
          </Text>
        </View>
      )}

      {/* Botón organizar con IA (solo PROPUESTA o APROBADA) */}
      {validItems.length > 0 &&
        (currentList.status === 'PROPUESTA' ||
          currentList.status === 'APROBADA') && (
          <TouchableOpacity
            style={styles.aiPlanButtonContainer}
            onPress={handleBuildAiPlan}
            disabled={isGeneratingPlan}
          >
            {isGeneratingPlan ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <>
                <Text style={styles.aiPlanButtonEmoji}>🧠</Text>
                <Text style={styles.aiPlanButtonText}>Organizar con IA</Text>
              </>
            )}
          </TouchableOpacity>
        )}

      {/* Lista de items */}
      {validItems.length > 0 ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {/* Items regulares */}
          {validItems.map((item, idx) => (
            <View key={idx} style={styles.itemContainer}>
              <View style={styles.itemRow}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() =>
                    handleTogglePurchased(
                      item.productId,
                      item.purchased || false,
                    )
                  }
                >
                  <Ionicons
                    name={item.purchased ? 'checkbox' : 'checkbox-outline'}
                    size={24}
                    color={
                      item.purchased ? COLORS.success : COLORS.textSecondary
                    }
                  />
                </TouchableOpacity>

                <View
                  style={[
                    styles.itemInfo,
                    item.purchased && styles.itemPurchased,
                  ]}
                >
                  <Text
                    style={[
                      styles.itemName,
                      item.purchased && styles.itemNamePurchased,
                    ]}
                  >
                    {item.productName}
                  </Text>
                  <Text style={styles.itemQty}>
                    {item.adjustedQty || item.suggestedQty} {item.unit}
                  </Text>
                  {item.reason && (
                    <Text style={styles.itemReason}>Razón: {item.reason}</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDiscardItem(item.productId)}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={COLORS.error}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Plan por lugar (si existe) */}
          {currentList.aiPlanByPlace &&
            currentList.aiPlanByPlace.length > 0 && (
              <View style={styles.aiPlanSection}>
                <Text style={styles.aiPlanSectionTitle}>📍 Plan por Lugar</Text>

                {currentList.aiPlanByPlace.map((group, groupIdx) => (
                  <View key={groupIdx} style={styles.planGroupCard}>
                    <Text style={styles.planGroupName}>{group.placeName}</Text>

                    <View style={styles.planGroupItems}>
                      {group.items.map((item, itemIdx) => (
                        <View key={itemIdx} style={styles.planItemRow}>
                          <Text style={styles.planItemName}>
                            {item.productName}
                          </Text>
                          <Text style={styles.planItemQty}>
                            {item.qty} {item.unit}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.planGroupFooter}>
                      <View>
                        <Text style={styles.planGroupTotal}>
                          Total: {formatearUsd(group.estimatedTotal)}
                        </Text>
                        {group.savingsVsWorst > 0 && (
                          <Text style={styles.planGroupSavings}>
                            Ahorro: {formatearUsd(group.savingsVsWorst)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}

                {/* Narrativa AI (si existe) */}
                {currentList.aiSummary && (
                  <View style={styles.aiSummaryCard}>
                    <Text style={styles.aiSummaryTitle}>💡 Análisis IA</Text>
                    <Text style={styles.aiSummaryText}>
                      {currentList.aiSummary}
                    </Text>
                  </View>
                )}
              </View>
            )}
        </ScrollView>
      ) : (
        <View style={styles.emptyItemsContainer}>
          <Text style={styles.emptyItemsText}>Sin artículos en la lista</Text>
        </View>
      )}

      {/* Botones inferiores */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addItemButton}
          onPress={() => setShowAddItemModal(true)}
        >
          <Ionicons name="add" size={20} color={COLORS.background} />
          <Text style={styles.addItemButtonText}>Agregar Manual</Text>
        </TouchableOpacity>
      </View>

      {/* Modal agregar item */}
      <Modal
        visible={showAddItemModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddItemModal(false);
          setSelectedItem(null);
          setItemSearch('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Artículo</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddItemModal(false);
                  setSelectedItem(null);
                  setItemSearch('');
                }}
              >
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

                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={() => {
                        setSelectedItem(item);
                        setItemUnit(
                          item.baseUnit === 'GR'
                            ? 'kg'
                            : item.baseUnit === 'ML'
                              ? 'l'
                              : 'und',
                        );
                      }}
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

                {/* Botón agregar */}
                <TouchableOpacity
                  style={styles.formConfirmButton}
                  onPress={handleAddManualItem}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={COLORS.background} />
                  ) : (
                    <Text style={styles.formConfirmButtonText}>
                      Agregar Artículo
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
  },
  generateButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  generateButtonContainerText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  itemContainer: {
    marginBottom: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  checkboxContainer: {
    padding: SPACING.sm,
    marginRight: SPACING.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemPurchased: {
    opacity: 0.6,
  },
  itemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  itemNamePurchased: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  itemQty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  itemReason: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: SPACING.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  emptyItemsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyItemsText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  generateButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '90%',
    paddingTop: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
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
  aiErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255, 159, 64, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  aiErrorText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.warning,
    fontWeight: FONT_WEIGHT.medium,
  },
  aiPlanButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOWS.small,
  },
  aiPlanButtonEmoji: {
    fontSize: 20,
  },
  aiPlanButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  aiPlanSection: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  aiPlanSectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  planGroupCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  planGroupName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  planGroupItems: {
    marginBottom: SPACING.lg,
  },
  planItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  planItemName: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  planItemQty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  planGroupFooter: {
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary,
  },
  planGroupTotal: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  planGroupSavings: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    marginTop: SPACING.xs,
  },
  aiSummaryCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  aiSummaryTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  aiSummaryText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
});

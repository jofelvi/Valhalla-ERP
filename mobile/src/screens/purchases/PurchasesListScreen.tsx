import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { useModal } from '../../hooks/useModal';
import {
  purchasesService,
  PurchaseListItem,
  Purchase,
} from '../../services/purchasesService';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { formatearUsd, formatearBs } from '../../utils/dinero';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const PurchasesListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [purchases, setPurchases] = useState<PurchaseListItem[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const detailModal = useModal('purchaseDetailModal');

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      setIsLoading(true);
      const data = await purchasesService.getPurchases({ limit: 50 });
      setPurchases(data);
    } catch (error) {
      console.error('[PurchasesListScreen] Error loading purchases:', error);
      showAlert('Error', 'No se pudieron cargar las compras');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchasePress = async (purchaseId: string) => {
    try {
      setIsLoadingDetail(true);
      const detail = await purchasesService.getPurchase(purchaseId);
      setSelectedPurchase(detail);
      detailModal.open();
    } catch (error) {
      console.error(
        '[PurchasesListScreen] Error loading purchase detail:',
        error,
      );
      showAlert('Error', 'No se pudo cargar el detalle de la compra');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const formatDate = (date: Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('es-VE', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando compras...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header con botón nuevas compras */}
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.headerTitle}>Compras Recientes</Text>
          <Text style={styles.headerSubtitle}>
            {purchases.length} registros
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newPurchaseButton}
          onPress={() => navigation.navigate('RegisterPurchase', {})}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color={COLORS.background} />
          <Text style={styles.newPurchaseText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de compras */}
      {purchases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="receipt-outline"
            size={48}
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyText}>Sin compras registradas</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('RegisterPurchase', {})}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>Registrar primera compra</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.purchaseCard}
              onPress={() => handlePurchasePress(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.purchaseName} numberOfLines={1}>
                    {item.placeName}
                  </Text>
                  <Text style={styles.purchaseDate}>
                    {formatDate(item.date)}
                  </Text>
                </View>
                <Text style={styles.purchaseTotal}>
                  {formatearUsd(item.total)}
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.cardBadge}>
                  <Ionicons name="list" size={14} color={COLORS.primary} />
                  <Text style={styles.badgeText}>
                    {item.itemsCount} artículos
                  </Text>
                </View>
                {item.invoiceUrls && item.invoiceUrls.length > 0 && (
                  <View style={styles.cardBadge}>
                    <Ionicons name="image" size={14} color={COLORS.info} />
                    <Text style={styles.badgeText}>
                      {item.invoiceUrls.length}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal detalle de compra */}
      {detailModal.isOpen && selectedPurchase && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedPurchase.placeName}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  detailModal.close();
                  setSelectedPurchase(null);
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {isLoadingDetail ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <ScrollView style={styles.modalContent}>
                {/* Fotos de factura */}
                {selectedPurchase.invoiceUrls &&
                  selectedPurchase.invoiceUrls.length > 0 && (
                    <View style={styles.invoiceContainer}>
                      <Text style={styles.sectionTitle}>Facturas</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.invoiceScroll}
                      >
                        {selectedPurchase.invoiceUrls.map((url, idx) => (
                          <Image
                            key={idx}
                            source={{ uri: url }}
                            style={styles.invoiceImage}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                {/* Artículos */}
                <View style={styles.itemsContainer}>
                  <Text style={styles.sectionTitle}>
                    Artículos ({selectedPurchase.items.length})
                  </Text>
                  {selectedPurchase.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.productName}</Text>
                        <Text style={styles.itemUnit}>
                          {item.quantity} {item.unit} = {item.baseQty}{' '}
                          {item.baseUnit}
                        </Text>
                      </View>
                      <Text style={styles.itemCost}>
                        {formatearUsd(item.subtotal)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Totales */}
                <View style={styles.totalsContainer}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      {formatearUsd(selectedPurchase.total)}
                    </Text>
                  </View>
                  {selectedPurchase.totalBs && (
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total Bs</Text>
                      <Text style={styles.totalValue}>
                        {formatearBs(selectedPurchase.totalBs)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Alertas de precio */}
                {selectedPurchase.alerts &&
                  selectedPurchase.alerts.length > 0 && (
                    <View style={styles.alertsContainer}>
                      <Text style={styles.sectionTitle}>
                        <Ionicons
                          name="warning"
                          size={16}
                          color={COLORS.warning}
                        />{' '}
                        Variaciones de precio
                      </Text>
                      {selectedPurchase.alerts.map((alert, idx) => (
                        <View key={idx} style={styles.alertItem}>
                          <Text style={styles.alertName}>
                            {alert.productName}
                          </Text>
                          <Text
                            style={[
                              styles.alertText,
                              { color: COLORS.warning },
                            ]}
                          >
                            {alert.variationPct > 0 ? '+' : ''}
                            {alert.variationPct.toFixed(1)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                {/* Sugerencias de mejores lugares */}
                {selectedPurchase.bestPlaceHints &&
                  selectedPurchase.bestPlaceHints.length > 0 && (
                    <View style={styles.hintsContainer}>
                      <Text style={styles.sectionTitle}>
                        <Ionicons name="flame" size={16} color={COLORS.info} />{' '}
                        Mejores lugares
                      </Text>
                      {selectedPurchase.bestPlaceHints.map((hint, idx) => (
                        <View key={idx} style={styles.hintItem}>
                          <View>
                            <Text style={styles.hintName}>
                              {hint.placeName}
                            </Text>
                            <Text style={styles.hintProduct}>
                              {hint.costPerBase.toFixed(2)} por base
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.hintSaving,
                              { color: COLORS.success },
                            ]}
                          >
                            −{hint.savingPct.toFixed(1)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                detailModal.close();
                setSelectedPurchase(null);
              }}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  newPurchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
    ...SHADOWS.small,
  },
  newPurchaseText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  listContent: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  purchaseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  cardTitleContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  purchaseName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  purchaseDate: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  purchaseTotal: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
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
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.small,
  },
  emptyButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingTop: SPACING.lg,
    maxHeight: '90%',
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
  modalLoading: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    maxHeight: '70%',
  },
  invoiceContainer: {
    marginBottom: SPACING.lg,
  },
  invoiceScroll: {
    marginTop: SPACING.md,
  },
  invoiceImage: {
    width: 120,
    height: 160,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.md,
    backgroundColor: COLORS.background,
  },
  itemsContainer: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  itemUnit: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  itemCost: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  totalsContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  totalLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  totalValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  alertsContainer: {
    marginBottom: SPACING.lg,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: `${COLORS.warning}15`,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  alertName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  alertText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  hintsContainer: {
    marginBottom: SPACING.lg,
  },
  hintItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: `${COLORS.info}15`,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  hintName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  hintProduct: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  hintSaving: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  modalCloseButton: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.background,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
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
} from '../../constants';
import { inventoryService, Warehouse } from '../../services/inventoryService';
import { RootStackParamList } from '../../navigation/types';
import { showAlert } from '../../utils/alert';
import { useAuthStore } from '../../store';
import { Card } from '../../components/ui/Card';
import {
  areaDelRol,
  esGerencia,
  puedeMoverInventario,
  tieneAccesoAlInventario,
} from '../../utils/almacenDelRol';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface WarehouseGroup {
  area: string;
  warehouses: Warehouse[];
}

export const InventoryHubScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(
    null,
  );

  // Mesoneros NO tienen acceso al inventario (pedido del dueño 16/07).
  // Pizza sí: elabora masas y salsa, y hasta el 05/08 quedó fuera por olvido.
  // La tabla vive en utils/almacenDelRol, espejo de station-scope.util.ts.
  const isAdmin = esGerencia(user?.role);
  const isInventoryRole = tieneAccesoAlInventario(user?.role);
  const puedeMover = puedeMoverInventario(user?.role);
  // Una estación trabaja SOBRE UN SOLO almacén: el de su área.
  const areaPropia = areaDelRol(user?.role);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setIsLoading(true);
        const data = await inventoryService.getWarehouses();
        // El servidor devuelve TODOS los almacenes, incluidos los dados de
        // baja: "ZZ Test E2E" (isActive:false) salia como un chip mas.
        const vivos = data.filter((w) => w.isActive !== false);
        setWarehouses(vivos);

        // Una estación entra parada en el almacén de SU área. Antes se
        // elegia `isDefault || data[0]`, y como cuatro almacenes tienen
        // `isDefault: true` ganaba Depósito General: el unico que una
        // estación NO puede consultar. Tocar "Ver Stock" daba 403 de entrada.
        const deSuArea = areaPropia
          ? vivos.find((w) => w.area === areaPropia)
          : null;
        const porDefecto = vivos.find((w) => w.isDefault);
        setSelectedWarehouse(deSuArea || porDefecto || vivos[0] || null);
      } catch (error) {
        console.error('[InventoryHub] Error loading warehouses:', error);
        showAlert('Error', 'No se pudieron cargar los almacenes');
      } finally {
        setIsLoading(false);
      }
    };
    loadWarehouses();
  }, [areaPropia]);

  const groupedWarehouses = warehouses.reduce<WarehouseGroup[]>((acc, w) => {
    const existing = acc.find((g) => g.area === w.area);
    if (existing) {
      existing.warehouses.push(w);
    } else {
      acc.push({ area: w.area, warehouses: [w] });
    }
    return acc;
  }, []);

  const areaLabel = (area: string): string => {
    const labels: Record<string, string> = {
      GENERAL: 'Depósito General',
      COCINA: 'Cocina',
      PIZZERIA: 'Pizzería',
      BARRA: 'Barra',
    };
    return labels[area] || area;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando almacenes...</Text>
      </View>
    );
  }

  if (warehouses.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.emptyText}>Sin almacenes disponibles</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Tarjetas de Compras y Lista de Compras */}
      <View style={styles.purchasesSection}>
        {/* Lo primero para la estación: declarar lo que elaboró */}
        {isInventoryRole && !isAdmin && (
          <Card
            variant="elevated"
            padding="lg"
            style={styles.actionCardWrapper}
          >
            <TouchableOpacity
              onPress={() => navigation.navigate('StationProduction')}
              activeOpacity={0.85}
              style={styles.actionCard}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons
                  name="hammer-outline"
                  size={28}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.actionTitle}>Registrar producción</Text>
              <Text style={styles.actionDesc}>
                Masas, salsa, porciones… se descuenta el crudo y lo autoriza
                gerencia
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {isInventoryRole && !isAdmin && (
          <Card
            variant="elevated"
            padding="lg"
            style={styles.actionCardWrapper}
          >
            <TouchableOpacity
              onPress={() => navigation.navigate('StationNewInsumo')}
              activeOpacity={0.85}
              style={styles.actionCard}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons
                  name="add-circle-outline"
                  size={28}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.actionTitle}>Solicitar insumo nuevo</Text>
              <Text style={styles.actionDesc}>
                ¿Falta algo en la lista? Pide que lo agreguen al catálogo
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {isAdmin && (
          <Card
            variant="elevated"
            padding="lg"
            style={styles.actionCardWrapper}
          >
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('InsumoRequestsAdmin');
              }}
              activeOpacity={0.85}
              style={styles.actionCard}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons
                  name="file-tray-full-outline"
                  size={28}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.actionTitle}>Solicitudes de insumos</Text>
              <Text style={styles.actionDesc}>
                Aprueba pedidos de reposición de las estaciones (transfiere del
                depósito)
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {isAdmin && (
          <Card
            variant="elevated"
            padding="lg"
            style={styles.actionCardWrapper}
          >
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('PurchasesList');
              }}
              activeOpacity={0.85}
              style={styles.actionCard}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons
                  name="cart-outline"
                  size={28}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.actionTitle}>Compras</Text>
              <Text style={styles.actionDesc}>
                Registra y visualiza compras de insumos
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {isAdmin && (
          <Card
            variant="elevated"
            padding="lg"
            style={styles.actionCardWrapper}
          >
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('ProductsAdmin');
              }}
              activeOpacity={0.85}
              style={styles.actionCard}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons
                  name="pricetags-outline"
                  size={28}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.actionTitle}>Productos</Text>
              <Text style={styles.actionDesc}>
                Crea y edita productos, precios y códigos
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {isInventoryRole && (
          <Card
            variant="elevated"
            padding="lg"
            style={styles.actionCardWrapper}
          >
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('ShoppingList', {
                  warehouseArea: selectedWarehouse?.area,
                });
              }}
              activeOpacity={0.85}
              style={styles.actionCard}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons
                  name="clipboard-outline"
                  size={28}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.actionTitle}>Lista de Compras</Text>
              <Text style={styles.actionDesc}>
                Gestiona la lista semanal de compras
              </Text>
            </TouchableOpacity>
          </Card>
        )}
      </View>

      {/* Selector de almacén por área. Solo gerencia: una estación tiene un
          solo almacén y elegir otro le devuelve 403, asi que los chips solo
          le daban de donde equivocarse. */}
      {isAdmin &&
        groupedWarehouses.map((group) => (
          <View key={group.area} style={styles.areaSection}>
            <Text style={styles.areaLabel}>{areaLabel(group.area)}</Text>
            <View style={styles.chipContainer}>
              {group.warehouses.map((warehouse) => (
                <TouchableOpacity
                  key={warehouse.id}
                  style={[
                    styles.chip,
                    selectedWarehouse?.id === warehouse.id &&
                      styles.chipSelected,
                  ]}
                  onPress={() => setSelectedWarehouse(warehouse)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedWarehouse?.id === warehouse.id &&
                        styles.chipTextSelected,
                    ]}
                  >
                    {warehouse.name}
                  </Text>
                  {selectedWarehouse?.id === warehouse.id && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={COLORS.background}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

      {/* Tarjetas de acción */}
      {selectedWarehouse && (
        <View style={styles.actionsContainer}>
          {/* Ver stock */}
          <Card
            variant="elevated"
            padding="lg"
            style={styles.actionCardWrapper}
          >
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('InventoryStock', {
                  warehouseId: selectedWarehouse.id,
                  warehouseName: selectedWarehouse.name,
                });
              }}
              activeOpacity={0.85}
              style={styles.actionCard}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons
                  name="cube-outline"
                  size={28}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.actionTitle}>Ver Stock</Text>
              <Text style={styles.actionDesc}>
                Visualiza el inventario actual del almacén
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Traslado, conteo y merma son SOLO_GERENCIA en el servidor
              (movements.controller.ts / counts.controller.ts). Una
              estación los veía y cobraba un 403 al final del formulario,
              merma incluida: con la foto obligatoria ya subida. */}
          {puedeMover && (
            <>
              {/* Retiro/Traslado */}
              <Card
                variant="elevated"
                padding="lg"
                style={styles.actionCardWrapper}
              >
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('InventoryTransfer', {
                      warehouseId: selectedWarehouse.id,
                      warehouseName: selectedWarehouse.name,
                    });
                  }}
                  activeOpacity={0.85}
                  style={styles.actionCard}
                >
                  <View style={styles.actionIconContainer}>
                    <Ionicons
                      name="arrow-forward-outline"
                      size={28}
                      color={COLORS.primary}
                    />
                  </View>
                  <Text style={styles.actionTitle}>Retiro / Traslado</Text>
                  <Text style={styles.actionDesc}>
                    Registra movimientos entre almacenes
                  </Text>
                </TouchableOpacity>
              </Card>

              {/* Conteo físico */}
              <Card
                variant="elevated"
                padding="lg"
                style={styles.actionCardWrapper}
              >
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('InventoryCount', {
                      warehouseId: selectedWarehouse.id,
                      warehouseName: selectedWarehouse.name,
                    });
                  }}
                  activeOpacity={0.85}
                  style={styles.actionCard}
                >
                  <View style={styles.actionIconContainer}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={28}
                      color={COLORS.primary}
                    />
                  </View>
                  <Text style={styles.actionTitle}>Conteo Físico</Text>
                  <Text style={styles.actionDesc}>
                    Realiza conteos diarios o semanales
                  </Text>
                </TouchableOpacity>
              </Card>

              {/* Declarar merma */}
              <Card
                variant="elevated"
                padding="lg"
                style={styles.actionCardWrapper}
              >
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('InventoryWaste', {
                      warehouseId: selectedWarehouse.id,
                      warehouseName: selectedWarehouse.name,
                    });
                  }}
                  activeOpacity={0.85}
                  style={styles.actionCard}
                >
                  <View style={styles.actionIconContainer}>
                    <Ionicons
                      name="warning-outline"
                      size={28}
                      color={COLORS.warning}
                    />
                  </View>
                  <Text style={styles.actionTitle}>Declarar Merma</Text>
                  <Text style={styles.actionDesc}>
                    Registra pérdidas con foto obligatoria
                  </Text>
                </TouchableOpacity>
              </Card>
            </>
          )}
        </View>
      )}
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
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  purchasesSection: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  areaSection: {
    marginBottom: SPACING.xl,
  },
  areaLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  chipTextSelected: {
    color: COLORS.background,
  },
  actionsContainer: {
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  actionCardWrapper: {
    width: '100%',
  },
  actionCard: {
    flex: 1,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  actionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  actionDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

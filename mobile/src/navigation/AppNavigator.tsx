import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Text,
  View,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore } from '../store';
import { OfflineBanner } from '../components';
import { useSincronizarOrdenesPorSocket } from '../queries/useOrdenes';
import { UserRoleEnum } from '../types';
import {
  LoginScreen,
  RegisterScreen,
  RegisterStep1Screen,
  RegisterStep2Screen,
  RegisterStep3Screen,
  RegisterStep4Screen,
  RegisterStep5Screen,
  HomeScreen,
  ProductsScreen,
  ProductsAdminScreen,
  ProductEditScreen,
  CartScreen,
  OrdersScreen,
  OrderDetailScreen,
  TableConnectScreen,
  ScanTableScreen,
  MyTableScreen,
  VerifyEmailScreen,
  ProfileScreen,
  TablesScreen,
  WaiterMenuScreen,
  WaiterCreateOrderScreen,
  WaiterOrdersScreen,
  WaiterPaymentScreen,
  WaiterAttendanceScreen,
  WaiterCommissionsScreen,
  WaiterCommissionDetailScreen,
  WaiterSalesScreen,
  WaiterSaleDetailScreen,
  ZonesScreen,
  ChatScreen,
  CashierOrdersScreen,
  CashierCreateOrderScreen,
  CashierPaymentScreen,
  CashierZonesScreen,
  CashierCloseScreen,
  CashierHistoryScreen,
  KitchenScreen,
  KitchenInventoryScreen,
  BarScreen,
  PizzaScreen,
  DispatchScreen,
  InventoryHubScreen,
  InsumoRequestsAdminScreen,
  InventoryStockScreen,
  InventoryTransferScreen,
  InventoryCountScreen,
  InventoryWasteScreen,
  StationProductionScreen,
  StationNewInsumoScreen,
  PurchasesListScreen,
  RegisterPurchaseScreen,
  OcrConfirmScreen,
  CreateInsumoScreen,
  ShoppingListScreen,
  PlacesScreen,
  AdminDashboardScreen,
  SalonScreen,
  AlmacenScreen,
} from '../screens';
import {
  RootStackParamList,
  MainTabParamList,
  WaiterTabParamList,
  CashierTabParamList,
  AdminTabParamList,
} from './types';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  SHADOWS,
  BORDER_RADIUS,
} from '../constants';
import { useNombreApp } from '../config/hooks';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const WaiterTab = createBottomTabNavigator<WaiterTabParamList>();
const CashierTab = createBottomTabNavigator<CashierTabParamList>();
const AdminTab = createBottomTabNavigator<AdminTabParamList>();

type TabIconName =
  | 'home'
  | 'home-outline'
  | 'cart'
  | 'cart-outline'
  | 'receipt'
  | 'receipt-outline'
  | 'person'
  | 'person-outline';

const getTabIcon = (routeName: string, focused: boolean): TabIconName => {
  const icons: Record<
    string,
    { focused: TabIconName; unfocused: TabIconName }
  > = {
    Home: { focused: 'home', unfocused: 'home-outline' },
    Cart: { focused: 'cart', unfocused: 'cart-outline' },
    Orders: { focused: 'receipt', unfocused: 'receipt-outline' },
    Profile: { focused: 'person', unfocused: 'person-outline' },
  };
  const icon = icons[routeName];
  return focused ? icon.focused : icon.unfocused;
};

type WaiterTabIconName =
  | 'grid'
  | 'grid-outline'
  | 'map'
  | 'map-outline'
  | 'restaurant'
  | 'restaurant-outline'
  | 'receipt'
  | 'receipt-outline'
  | 'wallet'
  | 'wallet-outline'
  | 'person'
  | 'person-outline'
  | 'finger-print'
  | 'finger-print-outline'
  | 'cube'
  | 'cube-outline';

const getWaiterTabIcon = (
  routeName: string,
  focused: boolean,
): WaiterTabIconName => {
  const icons: Record<
    string,
    { focused: WaiterTabIconName; unfocused: WaiterTabIconName }
  > = {
    Tables: { focused: 'grid', unfocused: 'grid-outline' },
    Zones: { focused: 'map', unfocused: 'map-outline' },
    WaiterMenu: { focused: 'restaurant', unfocused: 'restaurant-outline' },
    WaiterOrders: { focused: 'receipt', unfocused: 'receipt-outline' },
    WaiterSales: { focused: 'wallet', unfocused: 'wallet-outline' },
    WaiterAttendance: {
      focused: 'finger-print',
      unfocused: 'finger-print-outline',
    },
    Profile: { focused: 'person', unfocused: 'person-outline' },
  };
  const icon = icons[routeName] ?? icons.Profile;
  return focused ? icon.focused : icon.unfocused;
};

/**
 * Opciones de la barra inferior, ajustadas al ancho real del telefono.
 *
 * Con 7 pestañas en una pantalla de 320dp cada una recibe ~45dp: la etiqueta
 * "Asistencia" pedia 45px de texto en una caja de 36 y se recortaba. Medido en
 * la PWA a 320/360/412. En vez de sacar pestañas —que es decision de negocio—
 * la barra achica su tipografia y su padding cuando hace falta, y solo ahi.
 */
const getTabBarScreenOptions = (
  insets: { bottom: number },
  anchoPantalla: number,
) => {
  const pantallaChica = anchoPantalla < 360;
  return {
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.textSecondary,
    tabBarStyle: {
      backgroundColor: COLORS.surface,
      borderTopColor: COLORS.border,
      borderTopWidth: 1,
      paddingTop: SPACING.xs,
      // 56 no alcanzaba: entre el padding, el icono de 24 y su margen, a la
      // etiqueta le quedaban 5px de caja para una fuente de 10 y salia cortada
      // por abajo en TODOS los roles (medido en la PWA a 320/360/390/412/430).
      height: 64 + insets.bottom,
      paddingBottom: Math.max(insets.bottom, 8),
      ...SHADOWS.small,
    },
    tabBarLabelStyle: {
      fontSize: pantallaChica ? 9 : FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.medium,
      marginTop: 2,
      // Alto de linea explicito: sin el, la caja del texto se encoge hasta
      // recortar las letras cuando la barra va justa de alto.
      lineHeight: pantallaChica ? 12 : 13,
      // Android le suma un padding invisible a la fuente que roba altura.
      includeFontPadding: false,
    },
    // Sin esto, el padding lateral por defecto le come a la etiqueta el ancho
    // que necesita y la recorta aunque la fuente ya sea mas chica.
    tabBarItemStyle: pantallaChica
      ? { paddingHorizontal: 0 }
      : { paddingHorizontal: 2 },
    headerStyle: {
      backgroundColor: COLORS.background,
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    headerTintColor: COLORS.text,
    headerTitleStyle: {
      fontWeight: FONT_WEIGHT.semibold as '600',
      fontSize: FONT_SIZE.lg,
    },
  };
};

// Loading screen separado con animaciones
const SplashScreen: React.FC = () => {
  const nombre = useNombreApp();
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 55,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.7,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <View style={styles.loadingContainer}>
      {/* Blobs decorativos */}
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <Animated.View
        style={{ opacity: opacityAnim, transform: [{ scale: scaleAnim }] }}
      >
        {/* Glow detrás del logo */}
        <Animated.View style={[styles.logoGlow, { opacity: glowOpacity }]} />

        <LinearGradient
          colors={[`${COLORS.primary}25`, `${COLORS.primary}08`]}
          style={styles.logoContainer}
        >
          <Ionicons name="restaurant" size={52} color={COLORS.primary} />
        </LinearGradient>
      </Animated.View>

      <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
        <Text style={styles.appName}>{nombre}</Text>
        <Text style={styles.loadingText}>Preparando todo para ti...</Text>
      </Animated.View>

      {/* Puntos de carga */}
      <Animated.View style={[styles.dotsRow, { opacity: textOpacity }]}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
};

// Main Tab Navigator (Customer)
const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: anchoPantalla } = useWindowDimensions();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => (
          <Ionicons
            name={getTabIcon(route.name, color === COLORS.primary)}
            size={24}
            color={color}
          />
        ),
        ...getTabBarScreenOptions(insets, anchoPantalla),
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Inicio', headerShown: false }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: 'Carrito',
          headerTitle: 'Mi Carrito',
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          title: 'Pedidos',
          headerTitle: 'Mis Pedidos',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Perfil',
          headerTitle: 'Mi Perfil',
        }}
      />
    </Tab.Navigator>
  );
};

// Waiter Tab Navigator
const WaiterTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: anchoPantalla } = useWindowDimensions();
  return (
    <WaiterTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => (
          <Ionicons
            name={getWaiterTabIcon(route.name, color === COLORS.primary)}
            size={24}
            color={color}
          />
        ),
        ...getTabBarScreenOptions(insets, anchoPantalla),
      })}
    >
      <WaiterTab.Screen
        name="Tables"
        component={TablesScreen}
        options={{ title: 'Mesas', headerTitle: 'Mesas' }}
      />
      <WaiterTab.Screen
        name="Zones"
        component={ZonesScreen}
        options={{ title: 'Zonas', headerTitle: 'Zonas' }}
      />
      <WaiterTab.Screen
        name="WaiterMenu"
        component={WaiterMenuScreen}
        options={{ title: 'Menú', headerTitle: 'Menú' }}
      />
      <WaiterTab.Screen
        name="WaiterOrders"
        component={WaiterOrdersScreen}
        options={{ title: 'Pedidos', headerTitle: 'Mis Pedidos' }}
      />
      <WaiterTab.Screen
        name="WaiterSales"
        component={WaiterSalesScreen}
        options={{ title: 'Ventas', headerTitle: 'Mis Ventas' }}
      />
      <WaiterTab.Screen
        name="WaiterAttendance"
        component={WaiterAttendanceScreen}
        options={{
          title: 'Asistencia',
          headerTitle: 'Asistencia',
          // La pestaña dice "Fichar" y la pantalla sigue diciendo "Asistencia":
          // con 7 pestañas en 320dp cada caja mide 36px y "Asistencia" pide 41
          // aun con la fuente reducida a 9px, asi que se recortaba en el unico
          // boton que el personal necesita para marcar entrada y salida.
          tabBarLabel: 'Fichar',
        }}
      />
      <WaiterTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Perfil', headerTitle: 'Mi Perfil' }}
      />
    </WaiterTab.Navigator>
  );
};

type CashierTabIconName =
  | 'cash'
  | 'cash-outline'
  | 'grid'
  | 'grid-outline'
  | 'map'
  | 'map-outline'
  | 'person'
  | 'person-outline'
  | 'finger-print'
  | 'finger-print-outline';

const getCashierTabIcon = (
  routeName: string,
  focused: boolean,
): CashierTabIconName => {
  const icons: Record<
    string,
    { focused: CashierTabIconName; unfocused: CashierTabIconName }
  > = {
    CashierOrders: { focused: 'cash', unfocused: 'cash-outline' },
    Tables: { focused: 'grid', unfocused: 'grid-outline' },
    Zones: { focused: 'map', unfocused: 'map-outline' },
    CashierAttendance: {
      focused: 'finger-print',
      unfocused: 'finger-print-outline',
    },
    Profile: { focused: 'person', unfocused: 'person-outline' },
  };
  const icon = icons[routeName];
  return focused ? icon.focused : icon.unfocused;
};

// Cashier Tab Navigator
const CashierTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: anchoPantalla } = useWindowDimensions();
  return (
    <CashierTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => (
          <Ionicons
            name={getCashierTabIcon(route.name, color === COLORS.primary)}
            size={24}
            color={color}
          />
        ),
        ...getTabBarScreenOptions(insets, anchoPantalla),
      })}
    >
      <CashierTab.Screen
        name="CashierOrders"
        component={CashierOrdersScreen}
        options={{ title: 'Caja', headerTitle: 'Caja' }}
      />
      <CashierTab.Screen
        name="Tables"
        component={TablesScreen}
        options={{ title: 'Mesas', headerTitle: 'Mesas' }}
      />
      <CashierTab.Screen
        name="Zones"
        component={CashierZonesScreen}
        options={{ title: 'Zonas', headerTitle: 'Zonas' }}
      />
      <CashierTab.Screen
        name="CashierAttendance"
        component={WaiterAttendanceScreen}
        options={{
          title: 'Asistencia',
          headerTitle: 'Asistencia',
          // La pestaña dice "Fichar" y la pantalla sigue diciendo "Asistencia":
          // con 7 pestañas en 320dp cada caja mide 36px y "Asistencia" pide 41
          // aun con la fuente reducida a 9px, asi que se recortaba en el unico
          // boton que el personal necesita para marcar entrada y salida.
          tabBarLabel: 'Fichar',
        }}
      />
      <CashierTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Perfil', headerTitle: 'Mi Perfil' }}
      />
    </CashierTab.Navigator>
  );
};

// Cashier Stack Navigator
const CashierStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.backgroundSecondary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="CashierTabs"
        component={CashierTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CashierCreateOrder"
        component={CashierCreateOrderScreen}
        options={{ title: 'Crear Pedido' }}
      />
      <Stack.Screen
        name="CashierPayment"
        component={CashierPaymentScreen}
        options={{ title: 'Cobrar Orden' }}
      />
      <Stack.Screen
        name="CashierClose"
        component={CashierCloseScreen}
        options={{ title: 'Cerrar Caja' }}
      />
      <Stack.Screen
        name="CashierHistory"
        component={CashierHistoryScreen}
        options={{ title: 'Historial de Caja' }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ title: 'Detalle del Pedido' }}
      />
      <Stack.Screen
        name="TableConnect"
        component={TableConnectScreen}
        options={{ title: 'Mesa Conectada' }}
      />
      <Stack.Screen
        name="WaiterCreateOrder"
        component={WaiterCreateOrderScreen}
        options={{ title: 'Agregar Productos' }}
      />
      {/* Con COMANDA_AL_PAGAR, crear un pedido desde Mesas termina aqui (replace). */}
      <Stack.Screen
        name="WaiterPayment"
        component={WaiterPaymentScreen}
        options={{ title: 'Cobrar Mesa' }}
      />
      <Stack.Screen
        name="Products"
        component={ProductsScreen}
        options={{ title: 'Productos' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
};

// Admin Tab Icons
type AdminTabIconName =
  | 'bar-chart'
  | 'bar-chart-outline'
  | 'restaurant'
  | 'restaurant-outline'
  | 'cash'
  | 'cash-outline'
  | 'cube'
  | 'cube-outline'
  | 'person'
  | 'person-outline';

const getAdminTabIcon = (
  routeName: string,
  focused: boolean,
): AdminTabIconName => {
  const icons: Record<
    string,
    { focused: AdminTabIconName; unfocused: AdminTabIconName }
  > = {
    AdminPanel: { focused: 'bar-chart', unfocused: 'bar-chart-outline' },
    Salon: { focused: 'restaurant', unfocused: 'restaurant-outline' },
    CashierOrders: { focused: 'cash', unfocused: 'cash-outline' },
    Almacen: { focused: 'cube', unfocused: 'cube-outline' },
    Profile: { focused: 'person', unfocused: 'person-outline' },
  };
  const icon = icons[routeName];
  return focused ? icon.focused : icon.unfocused;
};

// Admin Tab Navigator (5 tabs: Panel, Salón, Caja, Almacén, Perfil)
const AdminTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: anchoPantalla } = useWindowDimensions();
  return (
    <AdminTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => (
          <Ionicons
            name={getAdminTabIcon(route.name, color === COLORS.primary)}
            size={24}
            color={color}
          />
        ),
        ...getTabBarScreenOptions(insets, anchoPantalla),
      })}
    >
      <AdminTab.Screen
        name="AdminPanel"
        component={AdminDashboardScreen}
        options={{ title: 'Panel', headerTitle: 'Panel de Control' }}
      />
      <AdminTab.Screen
        name="Salon"
        component={SalonScreen}
        options={{ title: 'Salón', headerTitle: 'Salón' }}
      />
      <AdminTab.Screen
        name="CashierOrders"
        component={CashierOrdersScreen}
        options={{ title: 'Caja', headerTitle: 'Caja' }}
      />
      <AdminTab.Screen
        name="Almacen"
        component={AlmacenScreen}
        options={{ title: 'Almacén', headerTitle: 'Almacén' }}
      />
      <AdminTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Perfil', headerTitle: 'Mi Perfil' }}
      />
    </AdminTab.Navigator>
  );
};

// Admin Stack Navigator (all cashier + waiter screens)
const AdminStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.backgroundSecondary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="AdminTabs"
        component={AdminTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CashierCreateOrder"
        component={CashierCreateOrderScreen}
        options={{ title: 'Crear Pedido' }}
      />
      <Stack.Screen
        name="CashierPayment"
        component={CashierPaymentScreen}
        options={{ title: 'Cobrar Orden' }}
      />
      <Stack.Screen
        name="CashierClose"
        component={CashierCloseScreen}
        options={{ title: 'Cerrar Caja' }}
      />
      <Stack.Screen
        name="CashierHistory"
        component={CashierHistoryScreen}
        options={{ title: 'Historial de Caja' }}
      />
      <Stack.Screen
        name="WaiterCreateOrder"
        component={WaiterCreateOrderScreen}
        options={({ route }) => ({
          title: route.params?.orderId ? 'Agregar Productos' : 'Crear Pedido',
        })}
      />
      <Stack.Screen
        name="WaiterPayment"
        component={WaiterPaymentScreen}
        options={{ title: 'Cobrar Mesa' }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ title: 'Detalle del Pedido' }}
      />
      <Stack.Screen
        name="TableConnect"
        component={TableConnectScreen}
        options={{ title: 'Mesa Conectada' }}
      />
      <Stack.Screen
        name="Products"
        component={ProductsScreen}
        options={{ title: 'Productos' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
      <Stack.Screen
        name="InsumoRequestsAdmin"
        component={InsumoRequestsAdminScreen}
        options={{ title: 'Solicitudes de insumos' }}
      />
      <Stack.Screen
        name="InventoryStock"
        component={InventoryStockScreen}
        options={{ title: 'Stock' }}
      />
      <Stack.Screen
        name="InventoryTransfer"
        component={InventoryTransferScreen}
        options={{ title: 'Retiro / Traslado' }}
      />
      <Stack.Screen
        name="InventoryCount"
        component={InventoryCountScreen}
        options={{ title: 'Conteo Físico' }}
      />
      <Stack.Screen
        name="InventoryWaste"
        component={InventoryWasteScreen}
        options={{ title: 'Declarar Merma' }}
      />
      <Stack.Screen
        name="PurchasesList"
        component={PurchasesListScreen}
        options={{ title: 'Compras' }}
      />
      <Stack.Screen
        name="ProductsAdmin"
        component={ProductsAdminScreen}
        options={{ title: 'Productos' }}
      />
      <Stack.Screen
        name="ProductEdit"
        component={ProductEditScreen}
        options={{ title: 'Producto' }}
      />
      <Stack.Screen
        name="RegisterPurchase"
        component={RegisterPurchaseScreen}
        options={{ title: 'Registrar Compra' }}
      />
      <Stack.Screen
        name="OcrConfirm"
        component={OcrConfirmScreen}
        options={{ title: 'Confirmar Lectura' }}
      />
      <Stack.Screen
        name="CreateInsumo"
        component={CreateInsumoScreen}
        options={{ title: 'Crear Insumo' }}
      />
      <Stack.Screen
        name="ShoppingList"
        component={ShoppingListScreen}
        options={{ title: 'Lista de Compras' }}
      />
      <Stack.Screen
        name="Places"
        component={PlacesScreen}
        options={{ title: 'Lugares de Compra' }}
      />
      <Stack.Screen
        name="Dispatch"
        component={DispatchScreen}
        options={{ title: 'Despacho' }}
      />
    </Stack.Navigator>
  );
};

// Kitchen Stack Navigator (rol KITCHEN — pantalla de órdenes + inventario)
const KitchenStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.backgroundSecondary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Kitchen"
        component={KitchenScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="KitchenInventory"
        component={KitchenInventoryScreen}
        options={{ title: 'Inventario (legacy)' }}
      />
      <Stack.Screen
        name="InventoryHub"
        component={InventoryHubScreen}
        options={{ title: 'Inventario' }}
      />
      <Stack.Screen
        name="InsumoRequestsAdmin"
        component={InsumoRequestsAdminScreen}
        options={{ title: 'Solicitudes de insumos' }}
      />
      <Stack.Screen
        name="InventoryStock"
        component={InventoryStockScreen}
        options={{ title: 'Stock' }}
      />
      <Stack.Screen
        name="InventoryTransfer"
        component={InventoryTransferScreen}
        options={{ title: 'Retiro / Traslado' }}
      />
      <Stack.Screen
        name="InventoryCount"
        component={InventoryCountScreen}
        options={{ title: 'Conteo Físico' }}
      />
      <Stack.Screen
        name="InventoryWaste"
        component={InventoryWasteScreen}
        options={{ title: 'Declarar Merma' }}
      />
      {/* Asistencia: cocina/barra/pizza fichan igual que el resto del personal */}
      <Stack.Screen
        name="StationAttendance"
        component={WaiterAttendanceScreen}
        options={{ title: 'Asistencia' }}
      />
      <Stack.Screen
        name="ShoppingList"
        component={ShoppingListScreen}
        options={{ title: 'Lista de Compras' }}
      />
      {/* La estacion declara lo que elaboro; gerencia lo autoriza */}
      <Stack.Screen
        name="StationProduction"
        component={StationProductionScreen}
        options={{ title: 'Registrar produccion' }}
      />
      <Stack.Screen
        name="StationNewInsumo"
        component={StationNewInsumoScreen}
        options={{ title: 'Solicitar insumo nuevo' }}
      />
    </Stack.Navigator>
  );
};

// Bar Stack Navigator (rol BAR — pantalla de comandas + inventario)
const BarStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Bar"
        component={BarScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="InventoryHub"
        component={InventoryHubScreen}
        options={{ title: 'Inventario' }}
      />
      <Stack.Screen
        name="InsumoRequestsAdmin"
        component={InsumoRequestsAdminScreen}
        options={{ title: 'Solicitudes de insumos' }}
      />
      <Stack.Screen
        name="InventoryStock"
        component={InventoryStockScreen}
        options={{ title: 'Stock' }}
      />
      <Stack.Screen
        name="InventoryTransfer"
        component={InventoryTransferScreen}
        options={{ title: 'Retiro / Traslado' }}
      />
      <Stack.Screen
        name="InventoryCount"
        component={InventoryCountScreen}
        options={{ title: 'Conteo Físico' }}
      />
      <Stack.Screen
        name="InventoryWaste"
        component={InventoryWasteScreen}
        options={{ title: 'Declarar Merma' }}
      />
      {/* Asistencia: cocina/barra/pizza fichan igual que el resto del personal */}
      <Stack.Screen
        name="StationAttendance"
        component={WaiterAttendanceScreen}
        options={{ title: 'Asistencia' }}
      />
      <Stack.Screen
        name="ShoppingList"
        component={ShoppingListScreen}
        options={{ title: 'Lista de Compras' }}
      />
      {/* La estacion declara lo que elaboro; gerencia lo autoriza */}
      <Stack.Screen
        name="StationProduction"
        component={StationProductionScreen}
        options={{ title: 'Registrar produccion' }}
      />
      <Stack.Screen
        name="StationNewInsumo"
        component={StationNewInsumoScreen}
        options={{ title: 'Solicitar insumo nuevo' }}
      />
    </Stack.Navigator>
  );
};

const PizzaStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      // Pizza (los pedidos) es la raiz, igual que en cocina y barra. Cuando
      // Asistencia estaba declarada primero era ella la raiz: al tocar
      // "Asistencia" el navigate hacia pop y desmontaba los pedidos, dejando
      // al pizzero en una pantalla sin boton atras y sin tabs — atrapado.
      initialRouteName="Pizza"
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Pizza"
        component={PizzaScreen}
        options={{ headerShown: false }}
      />
      {/* Asistencia: pizza ficha igual que cocina y barra */}
      <Stack.Screen
        name="StationAttendance"
        component={WaiterAttendanceScreen}
        options={{ title: 'Asistencia' }}
      />
      {/* Inventario: pizza elabora masas y salsa, asi que necesita las mismas
          pantallas que cocina y barra. Hasta el 05/08 no tenia ninguna. */}
      <Stack.Screen
        name="InventoryHub"
        component={InventoryHubScreen}
        options={{ title: 'Inventario' }}
      />
      <Stack.Screen
        name="InventoryStock"
        component={InventoryStockScreen}
        options={{ title: 'Stock' }}
      />
      <Stack.Screen
        name="InventoryCount"
        component={InventoryCountScreen}
        options={{ title: 'Conteo Físico' }}
      />
      <Stack.Screen
        name="InsumoRequestsAdmin"
        component={InsumoRequestsAdminScreen}
        options={{ title: 'Solicitudes de insumos' }}
      />
      {/* La estacion declara lo que elaboro; gerencia lo autoriza */}
      {/* El hub ofrece "Lista de Compras" a toda estacion; sin registrarla
          aqui, el pizzero tocaba el boton y la navegacion fallaba. */}
      <Stack.Screen
        name="ShoppingList"
        component={ShoppingListScreen}
        options={{ title: 'Lista de Compras' }}
      />
      <Stack.Screen
        name="StationProduction"
        component={StationProductionScreen}
        options={{ title: 'Registrar produccion' }}
      />
      <Stack.Screen
        name="StationNewInsumo"
        component={StationNewInsumoScreen}
        options={{ title: 'Solicitar insumo nuevo' }}
      />
    </Stack.Navigator>
  );
};

// Auth Stack Navigator
const AuthStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
      <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
      <Stack.Screen name="RegisterStep3" component={RegisterStep3Screen} />
      <Stack.Screen name="RegisterStep4" component={RegisterStep4Screen} />
      <Stack.Screen name="RegisterStep5" component={RegisterStep5Screen} />
    </Stack.Navigator>
  );
};

// Main Stack Navigator (Customer)
const MainStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.backgroundSecondary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Products"
        component={ProductsScreen}
        options={{ title: 'Productos' }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ title: 'Detalle del Pedido' }}
      />
      <Stack.Screen
        name="ScanTable"
        component={ScanTableScreen}
        options={{ title: 'Escanear mesa' }}
      />
      <Stack.Screen
        name="MyTable"
        component={MyTableScreen}
        options={{ title: 'Mi mesa' }}
      />
      <Stack.Screen
        name="VerifyEmail"
        component={VerifyEmailScreen}
        options={{ title: 'Verificar correo' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
};

// Waiter Stack Navigator
const WaiterStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.semibold,
          fontSize: FONT_SIZE.lg,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.backgroundSecondary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="WaiterTabs"
        component={WaiterTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WaiterCreateOrder"
        component={WaiterCreateOrderScreen}
        options={({ route }) => ({
          title: route.params?.orderId ? 'Agregar Productos' : 'Crear Pedido',
        })}
      />
      <Stack.Screen
        name="WaiterPayment"
        component={WaiterPaymentScreen}
        options={{ title: 'Cobrar Mesa' }}
      />
      <Stack.Screen
        name="WaiterCommissions"
        component={WaiterCommissionsScreen}
        options={{ title: 'Mis comisiones' }}
      />
      <Stack.Screen
        name="WaiterCommissionDetail"
        component={WaiterCommissionDetailScreen}
        options={{ title: 'Detalle de liquidación' }}
      />
      <Stack.Screen
        name="WaiterSaleDetail"
        component={WaiterSaleDetailScreen}
        options={{ title: 'Detalle de venta' }}
      />
      <Stack.Screen
        name="Products"
        component={ProductsScreen}
        options={{ title: 'Productos' }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ title: 'Detalle del Pedido' }}
      />
      <Stack.Screen
        name="TableConnect"
        component={TableConnectScreen}
        options={{ title: 'Mesa Conectada' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
};

// Root Navigator
export const AppNavigator: React.FC = () => {
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.role);

  // El socket de ordenes se monta UNA vez, aca arriba, y escribe en la cache de
  // React Query. Antes cada pantalla montaba y desmontaba su propia
  // suscripcion: en la caja eso pasaba cada 5 segundos y dejaba 3,6 s de cada 5
  // sin escuchar `order:created`, porque los listeners se enganchan despues del
  // fetch inicial. Una orden que entrara en esa ventana no aparecia.
  //
  // VA ANTES del `return` de isInitializing: un hook despues de un return
  // temprano no se ejecuta siempre y React lo rechaza.
  useSincronizarOrdenesPorSocket();

  if (isInitializing) {
    return <SplashScreen />;
  }

  const isAdmin = role === UserRoleEnum.ADMIN;

  const isWaiter =
    role === UserRoleEnum.WAITER || role === UserRoleEnum.MANAGER;

  const isCashier = role === UserRoleEnum.CASHIER;

  const isKitchen = role === UserRoleEnum.KITCHEN;
  const isBar = role === UserRoleEnum.BAR;
  const isPizza = role === UserRoleEnum.PIZZA;

  return (
    <View style={{ flex: 1 }}>
      {/* Va ARRIBA y en el flujo: empuja la app, no la tapa. Ver el
          docblock de OfflineBanner: la version absoluta se comia la
          flecha de volver de la cabecera. */}
      <OfflineBanner />
      <NavigationContainer>
        {!isAuthenticated ? (
          <AuthStackNavigator />
        ) : isAdmin ? (
          <AdminStackNavigator />
        ) : isCashier ? (
          <CashierStackNavigator />
        ) : isKitchen ? (
          <KitchenStackNavigator />
        ) : isBar ? (
          <BarStackNavigator />
        ) : isPizza ? (
          <PizzaStackNavigator />
        ) : isWaiter ? (
          <WaiterStackNavigator />
        ) : (
          <MainStackNavigator />
        )}
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.xl,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    opacity: 0.05,
  },
  blobTop: {
    width: 300,
    height: 300,
    top: -80,
    right: -80,
  },
  blobBottom: {
    width: 250,
    height: 250,
    bottom: -60,
    left: -80,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primary,
    alignSelf: 'center',
    top: -20,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
  },
  appName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  loadingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 18,
    borderRadius: 3,
  },
});

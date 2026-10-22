// Auth screens
export { LoginScreen } from './auth/LoginScreen';
export { RegisterScreen } from './auth/RegisterScreen';
export { RegisterStep1Screen } from './auth/RegisterStep1Screen';
export { RegisterStep2Screen } from './auth/RegisterStep2Screen';
export { RegisterStep3Screen } from './auth/RegisterStep3Screen';
export { RegisterStep4Screen } from './auth/RegisterStep4Screen';
export { RegisterStep5Screen } from './auth/RegisterStep5Screen';

// Main screens
export { HomeScreen } from './home/HomeScreen';
export { ProductsScreen } from './products/ProductsScreen';
export { ProductsAdminScreen } from './products/ProductsAdminScreen';
export { ProductEditScreen } from './products/ProductEditScreen';
export { CartScreen } from './cart/CartScreen';
export { OrdersScreen } from './orders/OrdersScreen';
export { OrderDetailScreen } from './orders/OrderDetailScreen';
export { TableConnectScreen } from './orders/TableConnectScreen';
export { ProfileScreen } from './profile/ProfileScreen';

// Mesa Conectada (cliente)
export { ScanTableScreen } from './customer/ScanTableScreen';
export { MyTableScreen } from './customer/MyTableScreen';
export { VerifyEmailScreen } from './customer/VerifyEmailScreen';

// Waiter screens
export { TablesScreen } from './waiter/TablesScreen';
export { WaiterMenuScreen } from './waiter/WaiterMenuScreen';
export { WaiterCreateOrderScreen } from './waiter/WaiterCreateOrderScreen';
export { WaiterOrdersScreen } from './waiter/WaiterOrdersScreen';
export { WaiterPaymentScreen } from './waiter/WaiterPaymentScreen';
export { WaiterAttendanceScreen } from './waiter/WaiterAttendanceScreen';
export { WaiterCommissionsScreen } from './waiter/WaiterCommissionsScreen';
export { WaiterCommissionDetailScreen } from './waiter/WaiterCommissionDetailScreen';
export { WaiterSalesScreen } from './waiter/WaiterSalesScreen';
export { WaiterSaleDetailScreen } from './waiter/WaiterSaleDetailScreen';
export { ZonesScreen } from './waiter/ZonesScreen';

// Cashier screens
export { CashierOrdersScreen } from './cashier/CashierOrdersScreen';
export { CashierCreateOrderScreen } from './cashier/CashierCreateOrderScreen';
export { CashierPaymentScreen } from './cashier/CashierPaymentScreen';
export { CashierZonesScreen } from './cashier/CashierZonesScreen';
export { CashierCloseScreen } from './cashier/CashierCloseScreen';
export { CashierHistoryScreen } from './cashier/CashierHistoryScreen';

// Chat
export { ChatScreen } from './chat/ChatScreen';

// Kitchen / Bar (Fase 3)
export {
  KitchenScreen,
  BarScreen,
  PizzaScreen,
  StationOrdersScreen,
  KitchenInventoryScreen,
  DispatchScreen,
} from './station';

// Inventory screens (Fase 2)
export { InventoryHubScreen } from './inventory/InventoryHubScreen';
export { InsumoRequestsAdminScreen } from './inventory/InsumoRequestsAdminScreen';
export { InventoryStockScreen } from './inventory/InventoryStockScreen';
export { InventoryTransferScreen } from './inventory/InventoryTransferScreen';
export { InventoryCountScreen } from './inventory/InventoryCountScreen';
export { InventoryWasteScreen } from './inventory/InventoryWasteScreen';
export { StationProductionScreen } from './inventory/StationProductionScreen';
export { StationNewInsumoScreen } from './inventory/StationNewInsumoScreen';

// Purchases screens (Fase 3)
export { PurchasesListScreen } from './purchases/PurchasesListScreen';
export { RegisterPurchaseScreen } from './purchases/RegisterPurchaseScreen';
export { OcrConfirmScreen } from './purchases/OcrConfirmScreen';
export { CreateInsumoScreen } from './purchases/CreateInsumoScreen';
export { ShoppingListScreen } from './purchases/ShoppingListScreen';
export { PlacesScreen } from './purchases/PlacesScreen';

// Admin screens (5-tab bar)
export { AdminDashboardScreen } from './admin/AdminDashboardScreen';
export { SalonScreen } from './admin/SalonScreen';
export { AlmacenScreen } from './admin/AlmacenScreen';

import { UserRoleEnum } from '@/shared/types/enumShared';

// Rutas públicas (accesibles sin autenticación)
export const PUBLIC_ROUTES = {
  LOGIN: '/public/login',
  ROOT: '/',
  REPORT_PAYMENT: (accountReceivableId: string) =>
    `/public/reportar-pago/${accountReceivableId}`,
} as const;

// Rutas para usuarios CUSTOMER
export const CUSTOMER_ROUTES = {
  HOME: '/customer/home',
  CATALOG: '/customer/catalog',
  HISTORY: '/customer/history',
  CURRENT_ORDER: '/customer/current-order',
} as const;

// Rutas para usuarios STAFF/ADMIN (no customer)
export const PRIVATE_ROUTES = {
  DASHBOARD: '/private/dashboard',

  // Bitacora de despliegues: que se subio, cuando, y reversion
  RELEASES: '/private/releases',

  // Recetas por estación (cocina/pizza/barra cargan las suyas)
  RECIPES: '/private/recipes',

  // Productos
  PRODUCTS: '/private/products',
  PRODUCTS_NEW: '/private/products/new',
  PRODUCTS_DETAILS: (id: string) => `/private/products/${id}/details`,
  PRODUCTS_EDIT: (id: string) => `/private/products/${id}`,

  // Categorías
  CATEGORIES: '/private/categories',
  CATEGORIES_NEW: '/private/categories/new',
  CATEGORIES_DETAILS: (id: string) => `/private/categories/${id}/details`,
  CATEGORIES_EDIT: (id: string) => `/private/categories/${id}`,

  // Clientes
  CUSTOMERS: '/private/customers',
  CUSTOMERS_DETAILS: (id: string) => `/private/customers/${id}`,
  CUSTOMERS_NEW: '/private/customers/new',
  CUSTOMERS_EDIT: (id: string) => `/private/customers/${id}/edit`,

  // Cuentas por Cobrar
  ACCOUNTS_RECEIVABLE: '/private/accounts-receivable',
  ACCOUNTS_RECEIVABLE_NEW: '/private/accounts-receivable/new',
  ACCOUNTS_RECEIVABLE_DETAILS: (id: string) =>
    `/private/accounts-receivable/${id}`,
  ACCOUNTS_RECEIVABLE_EDIT: (id: string) =>
    `/private/accounts-receivable/${id}/edit`,

  // Reportes de Pago (enviados desde link publico)
  PAYMENT_REPORTS: '/private/payment-reports',

  // Logs de WhatsApp
  WHATSAPP_LOGS: '/private/whatsapp-logs',

  // Verificacion masiva de pagos (pensado para eventos)
  VERIFY_PAYMENTS: '/private/verify-payments',

  // Órdenes
  ORDERS: '/private/orders',
  ORDERS_BY_WAITER: '/private/orders-by-waiter',
  ORDER_DETAILS: (orderId: string) => `/private/orders/${orderId}`,
  ORDER_EDIT: (orderId: string) => `/private/orders/${orderId}/edit`,

  // Ventas
  SALES: '/private/sales',

  // Facturas
  INVOICES: '/private/invoices',
  INVOICES_DETAILS: (id: string) => `/private/invoices/${id}/details`,

  // POS (Point of Sale)
  POS: '/private/pos',
  POS_ORDER: '/private/pos/order',
  POS_PAYMENT: (orderId: string) => `/private/pos/payment/${orderId}`,
  POS_RECEIPT: (orderId: string) => `/private/pos/receipt/${orderId}`,

  // Waiter web (espejo mobile para mesoneros)
  WAITER: '/private/waiter',
  WAITER_TABLES: '/private/waiter',
  WAITER_ZONES: '/private/waiter/zonas',
  WAITER_ORDERS: '/private/waiter/pedidos',
  WAITER_PROFILE: '/private/waiter/perfil',
  WAITER_CREATE_ORDER: '/private/waiter/crear-orden',
  WAITER_ORDER_DETAIL: (orderId: string) => `/private/waiter/orden/${orderId}`,
  WAITER_PAYMENT: (orderId: string) => `/private/waiter/cobrar/${orderId}`,

  // Órdenes de compra
  PURCHASE_ORDERS: '/private/purchase-orders',
  PURCHASE_ORDERS_NEW: '/private/purchase-orders/new',
  PURCHASE_ORDERS_DETAILS: (id: string) =>
    `/private/purchase-orders/${id}/details`,
  PURCHASE_ORDERS_EDIT: (id: string) => `/private/purchase-orders/${id}`,
  PURCHASE_ORDERS_RECEIVE: (id: string) =>
    `/private/purchase-orders/${id}/receive`,

  // Compras (entrada simplificada en 3 pasos, enlazada con costo/margen)
  COMPRAS: '/private/compras',

  // Proveedores
  SUPPLIERS: '/private/suppliers',
  SUPPLIERS_NEW: '/private/suppliers/new',
  SUPPLIERS_EDIT: (id: string) => `/private/suppliers/${id}`,

  // Mesas
  TABLES: '/private/tables',
  TABLES_NEW: '/private/tables/new',
  TABLES_DETAILS: (id: string) => `/private/tables/${id}/details`,
  TABLES_EDIT: (id: string) => `/private/tables/${id}`,

  // Usuarios
  USERS: '/private/users',
  USERS_NEW: '/private/users/new',
  USERS_DETAILS: (id: string) => `/private/users/${id}/details`,
  USERS_EDIT: (id: string) => `/private/users/${id}`,

  // Empleados
  EMPLOYEES: '/private/employees',
  EMPLOYEES_NEW: '/private/employees/new',
  EMPLOYEES_DETAILS: (id: string) => `/private/employees/${id}`,
  EMPLOYEES_EDIT: (id: string) => `/private/employees/${id}/edit`,
  EMPLOYEES_ATTENDANCE: (id: string) => `/private/employees/${id}/attendance`,
  EMPLOYEES_PAYROLL: (id: string) => `/private/employees/${id}/payroll`,

  // Nóminas
  PAYROLL: '/private/payroll',
  PAYROLL_NEW: '/private/payroll/new',
  // Detalle de las ordenes que sustentan la comision de un mesonero
  PAYROLL_WAITER_ORDERS: (employeeId: string) =>
    `/private/payroll/mesonero/${employeeId}`,

  // Reportes
  REPORTS: '/private/reports',

  // Asistencia
  ATTENDANCE: '/private/attendance',
  ATTENDANCE_CHECKIN: '/private/attendance/checkin',
  ATTENDANCE_CHECKOUT: '/private/attendance/checkout',

  // Configuración
  SETTINGS: '/private/settings',
  SETTINGS_GENERAL: '/private/settings/general',
  SETTINGS_BRANCHES: '/private/settings/branches',
  SETTINGS_BRANCHES_NEW: '/private/settings/branches/new',
  SETTINGS_BRANCHES_EDIT: (id: string) => `/private/settings/branches/${id}`,

  // Comisiones de Mesonero (pagos del 5%)
  COMISIONES: '/private/comisiones',

  // Reservas de eventos (El Golazo Llanero)
  EVENT_RESERVATIONS: '/private/event-reservations',

  // Almacén / Caja
  ALMACEN: '/private/almacen',
  ALMACEN_DIARIO: '/private/almacen/diario',
  ALMACEN_GENERAL: '/private/almacen/general',

  // Presupuestos para Eventos
  BUDGETS: '/private/budgets',
  BUDGETS_NEW: '/private/budgets/new',
  BUDGETS_DETAILS: (id: string) => `/private/budgets/${id}`,
  BUDGETS_EDIT: (id: string) => `/private/budgets/${id}/edit`,

  // Calendario de Eventos
  CALENDARIO: '/private/calendario',

  // Inventario
  INVENTORY: '/private/inventory',

  // Solicitudes de Crédito (POS)
  CREDIT_REQUESTS: '/private/pos/credit-requests',
} as const;

// Rutas de autenticación
export const AUTH_ROUTES = {
  SIGNIN: '/public/login',
  SIGNOUT: '/api/auth/signout',
} as const;

// Función para obtener la ruta por defecto según el rol del usuario
export const getDefaultRouteByRole = (role: UserRoleEnum): string => {
  switch (role) {
    case UserRoleEnum.CUSTOMER:
      return CUSTOMER_ROUTES.HOME;
    case UserRoleEnum.CASHIER:
      return PRIVATE_ROUTES.POS; // Cajero va directo al POS
    case UserRoleEnum.WAITER:
      return PRIVATE_ROUTES.WAITER; // Mesero va a su vista dedicada estilo mobile
    // El personal de estación entra a cargar las recetas de SU estación; el
    // dashboard les salía vacío porque no tienen permiso de ninguna tarjeta.
    case UserRoleEnum.KITCHEN:
    case UserRoleEnum.BAR:
    case UserRoleEnum.PIZZA:
      return PRIVATE_ROUTES.RECIPES;
    case UserRoleEnum.ADMIN:
    case UserRoleEnum.MANAGER:
    default:
      return PRIVATE_ROUTES.DASHBOARD;
  }
};

// Función para verificar si una ruta es accesible para un rol específico
export const isRouteAccessibleForRole = (
  route: string,
  role: UserRoleEnum,
): boolean => {
  // Rutas públicas son accesibles para todos
  if (
    Object.values(PUBLIC_ROUTES).includes(
      route as string & (typeof PUBLIC_ROUTES)[keyof typeof PUBLIC_ROUTES],
    )
  ) {
    return true;
  }

  // Rutas de customer solo para customers
  if (route.startsWith('/customer') && role === UserRoleEnum.CUSTOMER) {
    return true;
  }

  // Rutas privadas solo para no-customers
  if (route.startsWith('/private') && role !== UserRoleEnum.CUSTOMER) {
    return true;
  }

  return false;
};

// Función para redirigir a una ruta apropiada si la actual no es accesible
export const getRedirectRouteForRole = (
  currentRoute: string,
  role: UserRoleEnum,
): string | null => {
  if (isRouteAccessibleForRole(currentRoute, role)) {
    return null; // No necesita redirección
  }

  return getDefaultRouteByRole(role);
};

// Todas las rutas organizadas por tipo de acceso
export const ROUTES_BY_ACCESS = {
  PUBLIC: PUBLIC_ROUTES,
  CUSTOMER: CUSTOMER_ROUTES,
  PRIVATE: PRIVATE_ROUTES,
  AUTH: AUTH_ROUTES,
} as const;

// Rutas que requieren autenticación
export const PROTECTED_ROUTE_PATTERNS = ['/private/*', '/customer/*'] as const;

// Rutas que NO requieren autenticación
export const PUBLIC_ROUTE_PATTERNS = ['/public/*', '/', '/api/*'] as const;

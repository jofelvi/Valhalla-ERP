import { UserRoleEnum } from '@/shared/types/enumShared';
import { PRIVATE_ROUTES } from './routes';

/**
 * Define qué elementos del sidebar son visibles para cada rol
 *
 * Roles:
 * - ADMIN: Acceso total al sistema
 * - MANAGER: Acceso a gestión y reportes
 * - CASHIER: Acceso a caja, ventas y cobros
 * - WAITER: Acceso a POS, órdenes y asistencia
 * - KITCHEN: Acceso a órdenes de cocina
 */

export interface SidebarPermissions {
  [key: string]: UserRoleEnum[];
}

export const SIDEBAR_PERMISSIONS: SidebarPermissions = {
  // Dashboard - Solo admin y manager
  [PRIVATE_ROUTES.DASHBOARD]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Bitacora - la ven admin y gerencia. REVERTIR un despliegue es solo de
  // ADMIN: eso lo decide la pantalla y lo valida el backend con PIN.
  [PRIVATE_ROUTES.RELEASES]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Categorías - Solo admin y manager
  [PRIVATE_ROUTES.CATEGORIES]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Productos - Solo admin y manager
  [PRIVATE_ROUTES.PRODUCTS]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Recetas - el personal de estación carga las de SU estación (el filtro por
  // station lo aplica la página y lo valida el backend)
  [PRIVATE_ROUTES.RECIPES]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.KITCHEN,
    UserRoleEnum.BAR,
    UserRoleEnum.PIZZA,
  ],

  // Órdenes - Admin, Manager, Cashier, Waiter, Kitchen
  [PRIVATE_ROUTES.ORDERS]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
    UserRoleEnum.WAITER,
    UserRoleEnum.KITCHEN,
  ],

  // Pedidos por Mesonero (reporte por intervalo) - Admin, Manager
  [PRIVATE_ROUTES.ORDERS_BY_WAITER]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Facturas - Admin, Manager, Cashier
  [PRIVATE_ROUTES.INVOICES]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
  ],

  // Proveedores - Solo admin y manager
  [PRIVATE_ROUTES.SUPPLIERS]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Mesas - Admin, Manager, Waiter, Kitchen
  [PRIVATE_ROUTES.TABLES]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.WAITER,
    UserRoleEnum.KITCHEN,
  ],

  // Órdenes de Compra - Solo admin y manager
  [PRIVATE_ROUTES.PURCHASE_ORDERS]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Clientes - Admin, Manager, Cashier
  [PRIVATE_ROUTES.CUSTOMERS]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
  ],

  // Empleados - Solo admin y manager
  [PRIVATE_ROUTES.EMPLOYEES]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Usuarios - Solo admin
  [PRIVATE_ROUTES.USERS]: [UserRoleEnum.ADMIN],

  // Nóminas - Solo admin y manager
  [PRIVATE_ROUTES.PAYROLL]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Reportes - Solo admin y manager
  [PRIVATE_ROUTES.REPORTS]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Cuentas por Cobrar - Admin, Manager, Cashier
  [PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
  ],

  // Logs WhatsApp - Admin, Manager
  [PRIVATE_ROUTES.WHATSAPP_LOGS]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Verificar pagos masivos - Admin, Manager, Cashier
  [PRIVATE_ROUTES.VERIFY_PAYMENTS]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
  ],

  // Punto de Venta - Admin, Manager, Cashier, Waiter
  [PRIVATE_ROUTES.POS]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
    UserRoleEnum.WAITER,
  ],

  // Solicitudes de Crédito - quien cobra y quien autoriza
  [PRIVATE_ROUTES.CREDIT_REQUESTS]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
  ],

  // Configuración - Solo admin y manager
  [PRIVATE_ROUTES.SETTINGS]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Comisiones de Mesonero - Solo admin y manager
  [PRIVATE_ROUTES.COMISIONES]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Reservas de eventos - Solo admin y manager
  [PRIVATE_ROUTES.EVENT_RESERVATIONS]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
  ],

  // Almacén - Admin, Manager, Cashier
  // Inventario - SOLO GERENCIA: desde aquí se ajusta stock, se registran
  // compras y mermas. Es el dinero del negocio, no una pantalla de consulta.
  [PRIVATE_ROUTES.INVENTORY]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Compras - SOLO GERENCIA: registra el ingreso de mercancía, que mueve stock,
  // costo y márgenes. Mismo criterio que Inventario.
  [PRIVATE_ROUTES.COMPRAS]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  [PRIVATE_ROUTES.ALMACEN]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
  ],

  // Almacén General - Admin, Manager, Cashier
  [PRIVATE_ROUTES.ALMACEN_GENERAL]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
  ],

  // Almacén / Caja Diario - Admin, Manager, Cashier
  [PRIVATE_ROUTES.ALMACEN_DIARIO]: [
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
  ],

  // Presupuestos para Eventos - Admin, Manager
  [PRIVATE_ROUTES.BUDGETS]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],

  // Calendario de Eventos - Admin, Manager
  [PRIVATE_ROUTES.CALENDARIO]: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER],
};

/**
 * Define qué roles pueden ver las acciones de asistencia (Check-in/Check-out)
 */
export const ATTENDANCE_ACTIONS_ROLES: UserRoleEnum[] = [
  UserRoleEnum.ADMIN,
  UserRoleEnum.MANAGER,
  UserRoleEnum.CASHIER,
  UserRoleEnum.WAITER,
  UserRoleEnum.KITCHEN,
];

/**
 * Verifica si un rol tiene permiso para ver un elemento del sidebar
 */
export function hasPermission(path: string, role?: UserRoleEnum): boolean {
  if (!role) return false;

  // Admin siempre tiene acceso a todo
  if (role === UserRoleEnum.ADMIN) return true;

  const allowedRoles = SIDEBAR_PERMISSIONS[path];
  if (!allowedRoles) return false;

  return allowedRoles.includes(role);
}

/**
 * Verifica si un rol puede ver las acciones de asistencia
 */
export function canSeeAttendanceActions(role?: UserRoleEnum): boolean {
  if (!role) return false;
  return ATTENDANCE_ACTIONS_ROLES.includes(role);
}

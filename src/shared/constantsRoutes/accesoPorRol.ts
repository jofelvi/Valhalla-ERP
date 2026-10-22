/**
 * Quién puede ABRIR cada pantalla, en un solo sitio.
 *
 * El menú solo esconde: si una ruta no está aquí, cualquiera con sesión entra
 * escribiendo la URL. Antes esto vivía como listas de texto sueltas dentro de
 * `middleware.ts`, y una de ellas decía `/private/reportes` —con "e"— cuando
 * la carpeta real es `/private/reports`. Resultado medido con Playwright el
 * 07/09/2026: mesoneros y las tres estaciones entraban a los reportes, que
 * enseñan el ingreso del mes, los métodos de pago y el catálogo con costos.
 * Justo lo que se había cerrado para `/private/products`, con una letra de
 * diferencia.
 *
 * Por eso este archivo NO importa nada (el middleware corre en el Edge) y
 * tiene al lado una prueba que falla si alguna de estas rutas deja de existir
 * como página. Una ruta mal escrita ya no puede pasar en silencio.
 */

/** Los roles tal como viajan en el token de sesión. */
export type RolDeStaff =
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'waiter'
  | 'kitchen'
  | 'bar'
  | 'pizza';

export const GERENCIA: RolDeStaff[] = ['admin', 'manager'];
export const ESTACIONES: RolDeStaff[] = ['kitchen', 'bar', 'pizza'];

/**
 * Pantallas que enseñan dinero del negocio, costos o datos del personal.
 * Solo gerencia.
 */
export const SOLO_GERENCIA: string[] = [
  '/private/dashboard',
  '/private/products',
  '/private/categories',
  '/private/reports',
  '/private/sales',
  '/private/payment-reports',
  '/private/payroll',
  '/private/employees',
  '/private/users',
  '/private/suppliers',
  '/private/purchase-orders',
  '/private/budgets',
  '/private/orders-by-waiter',
  '/private/cobros-incompletos',
  '/private/cronograma-socios',
  '/private/whatsapp-logs',
  '/private/event-reservations',
  '/private/releases',
  '/private/settings',
];

/**
 * Recetas y el inventario: gerencia MÁS el personal de estación, que es quien
 * cuenta y declara merma en su propia área.
 */
export const DE_ESTACION: string[] = ['/private/recipes', '/private/inventory'];

/**
 * Pedir insumos es justamente lo que la estación usa para pedirle material a
 * gerencia: queda fuera del cierre de `/private/inventory`.
 */
export const EXCEPCIONES_DE_ESTACION: string[] = [
  '/private/inventory/insumo-requests',
];

/**
 * Cuentas por cobrar y solicitudes de crédito: gerencia y caja. El cajero las
 * necesita para cobrar y para aprobar un consumo a crédito.
 */
export const GERENCIA_Y_CAJA: string[] = [
  '/private/accounts-receivable',
  '/private/pos/credit-requests',
];

/** Todas las rutas gobernadas por este archivo (para la prueba). */
export const TODAS_LAS_RUTAS_CON_ACCESO: string[] = [
  ...SOLO_GERENCIA,
  ...DE_ESTACION,
  ...EXCEPCIONES_DE_ESTACION,
  ...GERENCIA_Y_CAJA,
];

const cubre = (lista: string[], ruta: string): boolean =>
  lista.some((r) => ruta === r || ruta.startsWith(r + '/'));

/**
 * A dónde mandar a quien no puede entrar: a SU pantalla, no a un error. El
 * personal de estación vive en Recetas y el mesonero en su vista de pedidos.
 */
export const pantallaDeInicio = (rol?: string): string => {
  if (rol === 'waiter') return '/private/waiter';
  if (rol === 'cashier') return '/private/pos';
  if (rol === 'kitchen' || rol === 'bar' || rol === 'pizza') {
    return '/private/recipes';
  }
  return '/private/dashboard';
};

/**
 * `null` si el rol puede abrir la ruta; si no, la pantalla a la que se le
 * redirige.
 */
export const redireccionPorAcceso = (
  ruta: string,
  rol?: string,
): string | null => {
  const esGerencia = rol === 'admin' || rol === 'manager';
  const esEstacion = rol === 'kitchen' || rol === 'bar' || rol === 'pizza';
  const esCaja = rol === 'cashier';

  if (esGerencia) return null;

  if (cubre(EXCEPCIONES_DE_ESTACION, ruta)) return null;

  if (cubre(DE_ESTACION, ruta) && !esEstacion) return pantallaDeInicio(rol);

  if (cubre(GERENCIA_Y_CAJA, ruta) && !esCaja) return pantallaDeInicio(rol);

  if (cubre(SOLO_GERENCIA, ruta)) return pantallaDeInicio(rol);

  return null;
};

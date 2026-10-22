/**
 * Las claves de React Query, en un solo sitio.
 *
 * Nunca se escribe un `queryKey: ['ordenes', algo]` a mano en una pantalla.
 * Toda clave sale de aca, porque de eso depende que la invalidacion funcione:
 * dos sitios que escriben la misma clave con una forma distinta son dos cachés
 * separadas que no se enteran la una de la otra. Ya paso en la web con
 * `useSuppliers`, que tenia `['suppliers', …]` en un archivo y
 * `['inventory','suppliers']` en otro: crear un proveedor no refrescaba la
 * pantalla de proveedores y nadie entendia por que.
 *
 * Forma: de lo general a lo particular, para que `invalidateQueries` con el
 * prefijo alcance a todo lo que cuelga. `claves.ordenes.todas` invalida
 * cualquier lista de ordenes; `claves.ordenes.una(id)` solo esa.
 */

export const claves = {
  ordenes: {
    todas: ['ordenes'] as const,
    /** Listas (cualquier filtro). Prefijo comun para invalidar de una. */
    listas: () => [...claves.ordenes.todas, 'lista'] as const,
    lista: (filtro: Record<string, unknown>) =>
      [...claves.ordenes.listas(), filtro] as const,
    una: (orderId: string) =>
      [...claves.ordenes.todas, 'una', orderId] as const,
    cargaPorMesonero: (waiterIds: string[]) =>
      [...claves.ordenes.todas, 'carga-por-mesonero', [...waiterIds].sort()] as const,
  },

  caja: {
    todas: ['caja'] as const,
    sesionActiva: (userId: string) =>
      [...claves.caja.todas, 'sesion-activa', userId] as const,
    resumen: (sessionId: string) =>
      [...claves.caja.todas, 'resumen', sessionId] as const,
  },

  productos: {
    todas: ['productos'] as const,
    /**
     * El menu: lo vendible hoy, con los campos de venta. Clave distinta de
     * `admin` a proposito — son dos respuestas distintas del mismo endpoint y
     * compartir clave haria que la pantalla de administracion pisara el menu
     * con productos inactivos (o al reves, que el menu se quedara sin campos).
     */
    menu: () => [...claves.productos.todas, 'menu'] as const,
    admin: () => [...claves.productos.todas, 'admin'] as const,
    porCategoria: (categoryId: string) =>
      [...claves.productos.todas, 'categoria', categoryId] as const,
    uno: (id: string) => [...claves.productos.todas, 'uno', id] as const,
  },

  categorias: {
    todas: ['categorias'] as const,
    lista: () => [...claves.categorias.todas, 'lista'] as const,
  },

  mesas: {
    todas: ['mesas'] as const,
    lista: () => [...claves.mesas.todas, 'lista'] as const,
  },

  mesoneros: {
    todas: ['mesoneros'] as const,
    activos: () => [...claves.mesoneros.todas, 'activos'] as const,
  },

  tasaBcv: {
    todas: ['tasa-bcv'] as const,
    actual: () => [...claves.tasaBcv.todas, 'actual'] as const,
  },
} as const;

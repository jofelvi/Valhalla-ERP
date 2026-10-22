/**
 * Proyeccion y techo para `GET /api/customers`.
 *
 * `findAll()` era `find().lean()` sin nada. Medido en PRE el 22/09/2026:
 * **2.955 clientes, 1.159.958 bytes, 2,2 s**, y lo piden SIETE pantallas de la
 * web.
 *
 * Lo llamativo al medirlo campo por campo: los valores solo explican el 54%
 * del peso. **El resto son los nombres de campo repetidos 2.955 veces.**
 * `_firestoreCreatedAt` y `_firestoreUpdatedAt` juntos —metadata muerta de la
 * migracion, que nadie lee desde que se apago Firebase— son 54 KB de valores
 * mas unos 136 KB solo en repetir sus nombres: **~190 KB de puro lastre**.
 * Por eso aca el recorte rinde mas que en otros endpoints: cada campo que sale
 * se lleva su valor Y su nombre.
 *
 * Los consumidores, mirados uno por uno:
 *
 * | Pantalla | Que lee |
 * |---|---|
 * | `/private/customers` | name, phone, email, identificationId, memberAction, isActive |
 * | `UsersManagement` | name, email, phone, isActive |
 * | `AccountReceivableForm` | id, name, isActive |
 * | `LinkedCustomerCard` | id, name |
 * | `/private/orders` | id -> name (un mapa para mostrar el nombre) |
 *
 * Ni una sola lee `createdAt`, `updatedAt`, los limites de credito ni la
 * direccion. De ahi sale `CAMPOS_DEL_LISTADO`.
 */

/** Lo que las cinco pantallas leen de verdad. Nada mas. */
export const CAMPOS_DEL_LISTADO = [
  '_id',
  'name',
  'phone',
  'email',
  'identificationType',
  'identificationId',
  'memberAction',
  'isActive',
] as const;

export function proyeccionDeListado(): Record<string, 1> {
  return Object.fromEntries(CAMPOS_DEL_LISTADO.map((c) => [c, 1])) as Record<
    string,
    1
  >;
}

/**
 * `null` = sin proyeccion: el cliente completo, como siempre.
 *
 * Opt-in, y por una razon concreta: el APK **si** lee fichas completas (por
 * `/search` y `/by-member`) y la pantalla de detalle de la web necesita el
 * credito, la direccion y las fechas. Un recorte por defecto los dejaria en
 * blanco sin un solo error. Basura en `vista` manda de MAS, nunca de menos.
 */
export function proyeccionPedida(vista?: string): Record<string, 1> | null {
  return vista === 'lista' ? proyeccionDeListado() : null;
}

/**
 * Techo de seguridad, **no** paginacion.
 *
 * Aca no se pone un defecto bajo como en facturas, y es deliberado: esto es un
 * directorio que la pantalla busca EN EL NAVEGADOR. Un defecto de 500 sobre
 * 2.955 clientes no "pagina": esconde 2.455 personas del buscador, y el que
 * busca a alguien que no aparece concluye que no esta registrado. Eso es peor
 * que el megabyte.
 *
 * El techo existe igual para que el endpoint deje de ser ilimitado mientras el
 * padron crece. Si algun dia se llega a 5.000, la respuesta correcta es mover
 * la busqueda al servidor —el endpoint `/search` ya existe—, no subir el
 * numero.
 */
export const TOPE_DE_CLIENTES = { defecto: 5000, duro: 5000 };

/** Solo activos. Lo usan los selectores, que no deben ofrecer bajas. */
export function condicionDeActivos(
  activos?: string,
): Record<string, unknown> | null {
  // `isActive` falta en fichas viejas: `$ne: false` las cuenta como activas,
  // que es como lo hacen hoy las pantallas con `.filter((c) => c.isActive)`
  // sobre un normalize que rellena `true`. Con `isActive: true` a secas
  // desapareceria gente que hoy si aparece.
  return activos === 'true' ? { isActive: { $ne: false } } : null;
}

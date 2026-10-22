// Registro de tobos/cajas "mixtos": al pedirlos, la app abre el selector de
// variantes (Light/Pilsen/Azul) con steppers hasta sumar el total.
//
// Por qué un registro explícito y no `presentationQuantity`: en la data de
// producción ese campo es inconsistente (un tobo de 12 tenía
// presentationQuantity: 1). Aquí el total y el envase son explícitos.
//
// Todo el registro nace VACÍO: cada negocio define sus tobos, variantes y almacén de barra
// (módulo `packsAndBuckets`). Se cargan con `registrarTobos`.

// Almacén de barra donde se descuentan las variantes. Vacío hasta que el negocio lo registre.
export let BARRA_WAREHOUSE_ID = '';

export type ToboContainer = 'lata' | 'botella';

export interface ToboVariant {
  variantProductId: string;
  name: string;
}

export interface ToboConfig {
  totalUnits: number;
  container: ToboContainer;
}

// Variantes por envase (p. ej. Light/Pilsen/Azul). Vacías hasta que el negocio las registre.
export const TOBO_VARIANTS: Record<ToboContainer, ToboVariant[]> = {
  botella: [],
  lata: [],
};

// Productos tobo/caja componibles: productId -> { totalUnits, container }.
// Los tobos con color en el nombre ("Verde", "azul") NO van aquí — son de una
// sola variante. Las cajas sin total/envase claro quedan pendientes de confirmar.
// Los totales salen de PACK_SIZES (services/packPricing) para que el tamaño del
// pack tenga UN solo lugar: aca solo se agrega el envase, que es lo que decide
// que variantes ofrece el selector.
export const TOBO_REGISTRY: Record<string, ToboConfig> = {};

/** Carga el registro del negocio (o un fixture de prueba). Reemplaza lo que hubiera. */
export function registrarTobos(datos: {
  tobos: Record<string, ToboConfig>;
  variantes: Record<ToboContainer, ToboVariant[]>;
  almacenBarraId: string;
}): void {
  for (const k of Object.keys(TOBO_REGISTRY)) delete TOBO_REGISTRY[k];
  Object.assign(TOBO_REGISTRY, datos.tobos);
  TOBO_VARIANTS.botella = datos.variantes.botella;
  TOBO_VARIANTS.lata = datos.variantes.lata;
  BARRA_WAREHOUSE_ID = datos.almacenBarraId;
}

export function getToboConfig(productId: string): ToboConfig | undefined {
  return TOBO_REGISTRY[productId];
}

// El mapa inverso de "que cerveza va a que pack" y los precios de cada pack
// VIVIAN AQUI y se borraron el 21/09/2026. Dos motivos, los dos de dinero:
//
//   - Los precios estaban cableados y se habian quedado atras: este archivo
//     decia $11 para el tobo de lata y la ficha del producto dice $14. El
//     servidor pisa el precio del cliente con el del catalogo en cada PATCH,
//     asi que la pantalla mostraba un numero y la cuenta decia otro.
//   - Cambiar el precio de un tobo obligaba a publicar una APK nueva y a
//     esperar a que los telefonos se actualizaran.
//
// Ahora el calculo lo hace el servidor y el APK pregunta:
// `services/packConversion.ts` → GET /api/orders/:id/opciones-conversion.

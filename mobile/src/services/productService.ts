import { api } from './api/apiClient';
import { toSafeDate } from './dateUtils';
import { Product, ProductStationEnum } from '../types';

interface RawIngredient {
  productId: string;
  quantity: number;
  unit: string;
  wastePercentage: number;
}

interface RawProduct {
  id?: string;
  _id?: string;
  name: string;
  description?: string | null;
  price?: number;
  currency?: string;
  type?: string;
  categoryId?: string;
  subcategoryId?: string;
  supplierIds?: string[] | null;
  isActive?: boolean;
  isForSale?: boolean;
  cost?: number;
  category?: string;
  sku?: string | null;
  barcode?: string | null;
  barcodes?: string[] | null;
  stock?: number;
  minStock?: number | null;
  presentation?: string | null;
  presentationQuantity?: number | null;
  imageUrl?: string | null;
  ingredients?: RawIngredient[] | null;
  nivel?: number | null;
  station?: ProductStationEnum | null;
  stationParts?: { label: string; station: string }[] | null;
  prepTimeMinutes?: number | null;
  preparedByEmployeeId?: string | null;
  preparedByName?: string | null;
  laborCost?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

const normalize = (raw: RawProduct): Product => ({
  id: String(raw.id ?? raw._id ?? ''),
  name: raw.name,
  description: raw.description ?? null,
  price: raw.price ?? 0,
  currency: raw.currency as Product['currency'],
  type: raw.type as Product['type'],
  categoryId: raw.categoryId as Product['categoryId'],
  subcategoryId: raw.subcategoryId ?? undefined,
  supplierIds: raw.supplierIds ?? null,
  createdAt: toSafeDate(raw.createdAt),
  isActive: raw.isActive ?? true,
  isForSale: raw.isForSale ?? true,
  cost: raw.cost as Product['cost'],
  category: raw.category as Product['category'],
  sku: raw.sku ?? null,
  barcode: raw.barcode ?? null,
  barcodes: raw.barcodes ?? null,
  stock: raw.stock ?? 0,
  minStock: raw.minStock ?? null,
  presentation: raw.presentation ?? null,
  presentationQuantity: raw.presentationQuantity ?? null,
  updatedAt: toSafeDate(raw.updatedAt),
  imageUrl: raw.imageUrl ?? null,
  ingredients: raw.ingredients ?? null,
  nivel: raw.nivel ?? null,
  station: (raw.station as ProductStationEnum | null) ?? null,
  stationParts: raw.stationParts ?? null,
  // Sin estas cuatro lineas la pantalla abria en blanco el tiempo ya guardado
  // y el proximo guardado lo borraba: normalize DESCARTA lo que no lista.
  prepTimeMinutes: raw.prepTimeMinutes ?? null,
  preparedByEmployeeId: raw.preparedByEmployeeId ?? null,
  preparedByName: raw.preparedByName ?? null,
  laborCost: raw.laborCost ?? null,
});

const sortByName = (a: Product, b: Product) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

// Campos editables de un producto desde el APK (admin). Todos opcionales para
// PATCH; en create el backend exige name, categoryId y price.
export interface ProductWriteInput {
  name?: string;
  description?: string | null;
  categoryId?: string;
  subcategoryId?: string | null;
  price?: number;
  cost?: number;
  currency?: string;
  type?: string;
  station?: ProductStationEnum | null;
  isActive?: boolean;
  isForSale?: boolean;
  barcode?: string | null;
  barcodes?: string[] | null;
}

/**
 * Lo que se le pide al servidor para una pantalla que vende.
 *
 * `forSale=true` = activo Y a la venta (lo que antes se filtraba en el
 * telefono). `vista=menu` = solo los campos de venta. Las dos son OPT-IN en la
 * API: un APK viejo que no las mande sigue recibiendo lo de siempre.
 */
const PARAMS_DEL_MENU = { forSale: 'true', vista: 'menu' } as const;

/**
 * A partir de cuantos resultados se asume que el servidor NO filtro.
 *
 * Ninguna busqueda de una persona devuelve 200 productos; un catalogo entero,
 * si (586 en produccion). Ver la red en `buscar()`.
 */
const UMBRAL_SIN_FILTRAR = 200;

/**
 * La misma criba que hacia el telefono antes, conservada COMO RED.
 *
 * `forSale=true` la resuelve Mongo, asi que contra la API nueva esto descarta
 * cero productos y no cuesta nada. Existe por el desfase de despliegue: el APK
 * y la API se suben por separado, los dos perfiles de EAS apuntan a
 * la API de producción, y un telefono puede quedar con esta version del
 * codigo hablandole a una API que todavia ignora `forSale`.
 *
 * Sin esta red, ese teléfono mostraria los 585 productos —inactivos y no
 * vendibles incluidos— y el mesonero podria comandar algo que no se vende, sin
 * un solo error. Quitar un filtro del cliente confiando en que el servidor ya
 * filtra solo es seguro cuando los dos se despliegan juntos, y aca no se
 * despliegan juntos.
 */
const soloVendibles = (productos: Product[]): Product[] =>
  productos.filter((p) => p.isActive && p.isForSale);

export const productService = {
  async getByCategory(categoryId: string): Promise<Product[]> {
    const list = await api.get<RawProduct[]>('/api/products', {
      categoryId,
      ...PARAMS_DEL_MENU,
    });
    return soloVendibles(list.map(normalize)).sort(sortByName);
  },

  /**
   * El menu: lo que se puede vender hoy.
   *
   * El `.filter((p) => p.isActive && p.isForSale)` que habia aca lo hace ahora
   * Mongo (`forSale=true`), y `vista=menu` recorta los campos que una pantalla
   * de venta no usa. Medido en produccion el 22/09/2026: de 585 productos y
   * 484.283 bytes crudos se pasa a 368 productos y 115.577 -> **76% menos**.
   *
   * Lo que se dejaba de lado eran 88 KB de `ingredients` (la receta de cada
   * producto, que el mesonero no mira), 17 KB de `description` y 16 KB de
   * `_firestoreCreatedAt`/`_firestoreUpdatedAt`, metadata muerta de la
   * migracion que nadie lee desde que se apago Firebase.
   *
   * Y esto lo llamaban NUEVE pantallas distintas, cada una con su peticion.
   * Ver `useProductosDelMenu`: ahora comparten una sola.
   */
  async getActiveProducts(): Promise<Product[]> {
    const list = await api.get<RawProduct[]>('/api/products', PARAMS_DEL_MENU);
    return soloVendibles(list.map(normalize)).sort(sortByName);
  },

  /**
   * Le pide al SERVIDOR que busque, con la regla que vale para todos.
   *
   * La pantalla ya filtra en memoria lo que tiene cargado —eso es instantaneo y
   * sigue funcionando sin internet—, pero lo que tiene cargado no siempre
   * alcanza: `vista=menu` recorta `description` y demas campos para ahorrar
   * bytes, asi que un producto que se busca por su SKU o su codigo de barras no
   * puede aparecer nunca en el filtro local. Esto es para eso.
   *
   * `?q=` ignora tildes y mayusculas y acepta las palabras en cualquier orden
   * (`apps/api/src/common/busqueda-texto.util.ts`). Devuelve `[]` si la
   * peticion falla: quien llama se queda con lo que ya tenia.
   */
  async buscar(texto: string): Promise<Product[]> {
    const q = texto.trim();
    if (q.length < 2) return [];
    try {
      const list = await api.get<RawProduct[]>('/api/products', {
        q,
        ...PARAMS_DEL_MENU,
      });
      const encontrados = soloVendibles(list.map(normalize)).sort(sortByName);
      // RED POR DESFASE DE DESPLIEGUE, igual que `soloVendibles`.
      //
      // Una API anterior a 1.8.16 no conoce `q` y —con el ValidationPipe en
      // `whitelist`— lo descarta EN SILENCIO: responde el catalogo entero con
      // un 200, sin un solo error. Medido contra produccion el 25/09/2026:
      // `?q=xxxxnoexiste` devolvio los 586 productos.
      //
      // Como esto solo se llama cuando el filtro local NO encontro nada, sin
      // esta red el mesonero que busca algo inexistente veria el menu completo
      // como si fuera el resultado. Se comprueba que el servidor de verdad
      // filtro: si devuelve tanto como el catalogo, no filtro.
      return encontrados.length >= UMBRAL_SIN_FILTRAR ? [] : encontrados;
    } catch {
      return [];
    }
  },

  async getById(id: string): Promise<Product | null> {
    try {
      const raw = await api.get<RawProduct>(`/api/products/${id}`);
      return normalize(raw);
    } catch {
      return null;
    }
  },

  /**
   * Guarda SOLO la receta, por el endpoint dedicado.
   *
   * No se usa el PATCH general a proposito: ese acepta precio, nombre y
   * categoria, y el personal de estacion no debe poder tocarlos. El endpoint de
   * receta tiene un DTO minimo (el precio es inalcanzable) y valida que cada
   * estacion solo edite productos de SU estacion. Ademas convierte el producto
   * a MIXED y recalcula su costo con los ingredientes.
   */
  async updateRecipe(
    id: string,
    ingredients: Array<{
      productId: string;
      quantity: number;
      unit: string;
      wastePercentage?: number;
    }>,
    extra?: { prepTimeMinutes?: number; preparedByEmployeeId?: string },
  ): Promise<Product> {
    const raw = await api.patch<RawProduct>(`/api/products/${id}/recipe`, {
      ingredients,
      ...(extra?.prepTimeMinutes !== undefined
        ? { prepTimeMinutes: extra.prepTimeMinutes }
        : {}),
      ...(extra?.preparedByEmployeeId !== undefined
        ? { preparedByEmployeeId: extra.preparedByEmployeeId }
        : {}),
    });
    return normalize(raw);
  },

  /** Quienes pueden figurar como preparadores (sin sueldos: el server no los manda). */
  async listPreparers(): Promise<
    Array<{ id: string; name: string; position: string }>
  > {
    return api.get('/api/products/preparers');
  },

  async updateProduct(id: string, dto: ProductWriteInput): Promise<Product> {
    const raw = await api.patch<RawProduct>(`/api/products/${id}`, dto);
    return normalize(raw);
  },

  async createProduct(dto: ProductWriteInput): Promise<Product> {
    const raw = await api.post<RawProduct>('/api/products', dto);
    return normalize(raw);
  },

  // Todos los productos (incluidos inactivos y no-a-la-venta) para la pantalla
  // de administración. GET /api/products sin filtro devuelve todo.
  async getAllForAdmin(): Promise<Product[]> {
    const list = await api.get<RawProduct[]>('/api/products');
    return list.map(normalize).sort(sortByName);
  },
};

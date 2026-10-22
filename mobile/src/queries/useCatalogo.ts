import { useQuery } from '@tanstack/react-query';
import { productService } from '../services/productService';
import { categoryService } from '../services/categoryService';
import { claves } from './claves';

/**
 * El catalogo, una sola vez para toda la app.
 *
 * `productService.getActiveProducts()` se llamaba desde **nueve pantallas**
 * (mesonero, cajero, estacion, despacho, home, cliente, detalle de orden...),
 * cada una con su `useEffect` y su peticion propia. Medido en produccion el
 * 22/09/2026: **76.087 bytes comprimidos por llamada**. Abrir el turno y pasar
 * por cuatro pantallas eran cuatro descargas del mismo catalogo.
 *
 * Con una clave compartida, React Query hace **una** peticion y las nueve leen
 * de la misma cache.
 *
 * El `staleTime` es largo a proposito: un catalogo no cambia durante un turno.
 * Cuando SI cambia —se edita un producto, se sube un precio— lo correcto es
 * invalidar la clave en la mutacion, no reconsultar cada treinta segundos por
 * si acaso. Un precio viejo en pantalla es un cobro equivocado, y eso no se
 * arregla poniendo un intervalo mas corto: se arregla invalidando.
 */
const UN_TURNO = 10 * 60 * 1000;

/** Lo vendible hoy, con los campos de venta. Para cualquier pantalla que cobra. */
export function useProductosDelMenu(habilitada = true) {
  return useQuery({
    queryKey: claves.productos.menu(),
    queryFn: () => productService.getActiveProducts(),
    enabled: habilitada,
    staleTime: UN_TURNO,
  });
}

/**
 * El catalogo COMPLETO, incluidos inactivos y no vendibles.
 *
 * Clave distinta de la del menu porque es otra respuesta: si compartieran
 * clave, abrir administracion meteria productos inactivos en el menu del
 * mesonero, o al reves, el menu dejaria la pantalla de administracion sin los
 * campos que necesita para editar.
 */
export function useProductosParaAdmin(habilitada = true) {
  return useQuery({
    queryKey: claves.productos.admin(),
    queryFn: () => productService.getAllForAdmin(),
    enabled: habilitada,
    staleTime: UN_TURNO,
  });
}

/** Las categorias. Las pedian dos services distintos por su cuenta. */
export function useCategorias(habilitada = true) {
  return useQuery({
    queryKey: claves.categorias.lista(),
    queryFn: () => categoryService.getActiveCategories(),
    enabled: habilitada,
    staleTime: UN_TURNO,
  });
}

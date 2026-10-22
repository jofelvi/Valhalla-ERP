import { useMemo } from 'react';
import { filtrarLocal } from '../utils/busquedaTexto';

/**
 * Filtra una lista por un texto escrito por una persona.
 *
 * Hasta el 25/09/2026 hacia `String(valor).toLowerCase().includes(texto)`, que
 * ignora las mayusculas pero **no las tildes**: buscar `cafe` no encontraba
 * «CAFÉ BALLET» y `te de jamaica` no encontraba «Té de Jamaica». Eso ultimo
 * costo un producto duplicado en el catalogo, con su propio inventario
 * descontandose por separado. Tampoco toleraba el orden: «caja pizza» no
 * encontraba «Caja de Pizza».
 *
 * Ahora delega en `utils/busquedaTexto.ts`, que espeja la regla del servidor
 * (`apps/api/src/common/busqueda-texto.util.ts`). Las pantallas que ya tenian
 * la lista cargada siguen filtrando sin tocar la red.
 *
 * @param items - la lista a filtrar
 * @param query - lo que se escribio; en blanco devuelve la lista entera
 * @param searchFields - los campos en los que mirar
 *
 * @example
 * const resultados = useBusqueda(productos, 'te de jamaica', ['name']);
 */
export const useBusqueda = <T>(
  items: T[],
  query: string,
  searchFields: (keyof T)[],
): T[] =>
  useMemo(
    () => filtrarLocal(items, query, searchFields),
    [items, query, searchFields],
  );

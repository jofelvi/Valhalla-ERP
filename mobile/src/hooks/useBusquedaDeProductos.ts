import { useEffect, useMemo, useRef, useState } from 'react';
import { filtrarLocal } from '../utils/busquedaTexto';
import { productService } from '../services/productService';
import type { Product } from '../types/models';

/**
 * Buscar un producto: primero lo que la pantalla ya tiene, y el servidor solo
 * cuando hace falta.
 *
 * El dueno lo pidio asi el 25/09/2026 —«hazlo a nivel de api asi queda para los
 * dos»— para que la web y la APK no tuvieran cada una su propia idea de que es
 * buscar. La regla vive en la API. Pero el local pierde internet a
 * menudo (28 cortes medidos en 30 dias, el peor de 116 minutos) y un cajero que
 * no puede buscar un producto no puede cobrar, asi que la peticion nunca es la
 * unica via.
 *
 * Como funciona:
 *
 * 1. **Siempre** se filtra en memoria lo que la pantalla ya cargo. Es
 *    instantaneo, no gasta red y funciona con el WiFi caido.
 * 2. Si eso encuentra algo, ahi se acaba: **cero peticiones** en el caso
 *    normal, que es el 99% de las veces (la pantalla suele tener el catalogo
 *    entero).
 * 3. Si NO encuentra nada y hay al menos 2 letras, recien entonces se le
 *    pregunta al servidor, que busca ademas por SKU, codigo de barras y
 *    descripcion — campos que `vista=menu` recorta y que por eso el filtro
 *    local no puede ver nunca.
 * 4. Si esa peticion falla, se devuelve la lista vacia del local y la pantalla
 *    se comporta como siempre. Nunca se rompe por no haber red.
 */

/** Los mismos campos en los que busca el servidor, para que no discrepen. */
const CAMPOS: (keyof Product)[] = ['name', 'sku', 'barcode', 'description'];

/** Lo que se espera a que deje de teclear antes de molestar al servidor. */
const ESPERA_MS = 350;

/** Menos de esto no se consulta: devolveria medio catalogo. */
const MINIMO = 2;

export interface BusquedaDeProductos {
  /** Lo que hay que pintar. */
  resultados: Product[];
  /** `true` mientras se le pregunta al servidor (solo pasa si el local fallo). */
  buscandoEnServidor: boolean;
}

export const useBusquedaDeProductos = (
  locales: Product[],
  texto: string,
): BusquedaDeProductos => {
  const local = useMemo(
    () => filtrarLocal(locales, texto, CAMPOS),
    [locales, texto],
  );

  const [delServidor, setDelServidor] = useState<Product[]>([]);
  const [buscandoEnServidor, setBuscandoEnServidor] = useState(false);

  // Identifica la busqueda en curso: si el usuario sigue escribiendo, la
  // respuesta que llega tarde se descarta en vez de pisar a la nueva.
  const vigente = useRef(0);

  const hayLocal = local.length > 0;
  const consultable = texto.trim().length >= MINIMO;

  useEffect(() => {
    if (hayLocal || !consultable) {
      setDelServidor([]);
      setBuscandoEnServidor(false);
      return;
    }

    const turno = ++vigente.current;
    setBuscandoEnServidor(true);

    const temporizador = setTimeout(() => {
      void productService
        .buscar(texto)
        .then((encontrados) => {
          if (turno !== vigente.current) return;
          setDelServidor(encontrados);
        })
        .finally(() => {
          if (turno === vigente.current) setBuscandoEnServidor(false);
        });
    }, ESPERA_MS);

    return () => {
      clearTimeout(temporizador);
    };
  }, [texto, hayLocal, consultable]);

  return {
    resultados: hayLocal ? local : delServidor,
    buscandoEnServidor,
  };
};

/**
 * Ofuscación de recetas para catálogos de muestra.
 *
 * Cuando el catálogo que se importa viene de un negocio real, las fórmulas (cantidades por
 * ingrediente) son su secreto comercial. Esto las distorsiona lo justo para que sigan sirviendo de
 * ESTIMADO pero no se puedan clonar:
 *
 *   - Cada ingrediente de cada receta se multiplica por un factor PROPIO entre `minFactor` y
 *     `maxFactor` (siempre > 1: nunca se baja un valor). Como los factores son distintos entre sí,
 *     las PROPORCIONES entre ingredientes (que es lo que define una receta) cambian; escalar todo
 *     por igual no protegería nada.
 *   - El orden de los ingredientes se baraja.
 *   - El rendimiento del lote (`presentationQuantity`) se ajusta con la misma proporción, para que
 *     el costo por gramo siga siendo coherente.
 *   - Los costos de compra suben un poco (`minCosto`..`maxCosto`): el estimado queda por encima.
 *   - Las descripciones de los preparados pierden cualquier cantidad, "receta", "rendimiento", etc.
 *
 * Todo sale de un HMAC con una semilla secreta: la misma semilla da siempre los mismos valores
 * (reimportar no cambia nada) y sin ella no se puede deshacer. La semilla NO vive en el repo.
 */
import { createHmac } from 'node:crypto';

const UNIDADES_CONTADAS = new Set(['Unidad', 'Bolsa']);
const PATRON_CANTIDAD =
  /\d+(?:[.,]\d+)?\s*(?:kg|gr?|ml|lts?|l|und|unid\w*|%)\b/i;
const PATRON_RECETA =
  /\b(?:receta|rendimiento|rinde|lote|reducci[oó]n|escalad[ao])\b/i;

/** Redondea a 2 cifras significativas (3600, 14, 0.52): se ve como una receta escrita a mano. */
export const dosCifras = (n) => {
  if (!Number.isFinite(n) || n === 0) return 0;
  const paso = 10 ** (Math.floor(Math.log10(Math.abs(n))) - 1);
  return Math.round(n / paso) * paso;
};

export function crearOfuscador(semilla, opciones = {}) {
  if (typeof semilla !== 'string' || semilla.length < 16) {
    throw new Error(
      'La semilla de ofuscación debe tener al menos 16 caracteres.',
    );
  }
  const {
    minFactor = 1.1,
    maxFactor = 1.35,
    minCosto = 1.05,
    maxCosto = 1.15,
  } = opciones;
  if (
    !(minFactor > 1) ||
    !(maxFactor >= minFactor) ||
    !(minCosto >= 1) ||
    !(maxCosto >= minCosto)
  ) {
    throw new Error(
      'Los factores deben ser mayores que 1: nunca se baja un valor.',
    );
  }

  const unitario = (clave) =>
    createHmac('sha256', semilla).update(clave).digest().readUInt32BE(0) /
    0x100000000;
  const entre = (clave, a, b) => a + (b - a) * unitario(clave);

  const cantidad = (productoId, ing) => {
    const q = Number(ing.quantity);
    if (!Number.isFinite(q) || q <= 0) return ing.quantity;
    const f = entre(
      `cantidad|${productoId}|${ing.productId}`,
      minFactor,
      maxFactor,
    );
    if (UNIDADES_CONTADAS.has(ing.unit) && Number.isInteger(q)) {
      // Conteos enteros: una sola unidad no se puede esconder; de 2 en adelante siempre sube.
      // Una fracción de unidad (0,0278 de un paquete) sí es una receta y se trata como un peso.
      return q < 2 ? q : Math.ceil(q * f);
    }
    return Math.max(q, dosCifras(q * f));
  };

  const pesoDe = (ings) =>
    ings.reduce((s, i) => {
      const q = Number(i.quantity) || 0;
      if (i.unit === 'Gramo' || i.unit === 'Mililitro') return s + q;
      if (i.unit === 'Litro') return s + q * 1000;
      return s;
    }, 0);

  const descripcion = (texto, esVenta) => {
    if (typeof texto !== 'string' || texto === '') return texto;
    const filtra = (t) => PATRON_CANTIDAD.test(t) || PATRON_RECETA.test(t);
    if (!filtra(texto)) return texto;
    // Un preparado no se vende: su descripción solo existe para quien conoce la receta.
    if (!esVenta) return 'Preparado de la casa.';
    const sanas = texto.split(/(?<=[.!?])\s+/).filter((s) => !filtra(s));
    return sanas.join(' ').trim();
  };

  /** Devuelve una copia del producto ya ofuscada. No muta el original. */
  const producto = (p) => {
    const q = { ...p };
    const id = String(p._id);
    if (typeof q.cost === 'number' && q.cost > 0) {
      q.cost = Number(
        (q.cost * entre(`costo|${id}`, minCosto, maxCosto)).toFixed(4),
      );
    }
    if (q.type === 'COMPUESTO') {
      const ingredientes = Array.isArray(p.ingredients) ? p.ingredients : [];
      const antes = pesoDe(ingredientes);
      const nuevos = ingredientes.map((i) => ({
        ...i,
        quantity: cantidad(id, i),
      }));
      nuevos.sort(
        (a, b) =>
          unitario(`orden|${id}|${a.productId}`) -
          unitario(`orden|${id}|${b.productId}`),
      );
      q.ingredients = nuevos;
      const despues = pesoDe(nuevos);
      if (
        antes > 0 &&
        typeof q.presentationQuantity === 'number' &&
        (q.presentation === 'Gramo' || q.presentation === 'Mililitro')
      ) {
        q.presentationQuantity = Math.round(
          (q.presentationQuantity * despues) / antes,
        );
      }
      for (const campo of ['gramsPerUnit', 'mlPerUnit']) {
        if (typeof q[campo] === 'number' && q[campo] > 0) {
          q[campo] = Math.max(
            q[campo],
            dosCifras(q[campo] * entre(`${campo}|${id}`, 1.05, 1.2)),
          );
        }
      }
    }
    if (q.type === 'COMPUESTO' && typeof q.description === 'string') {
      q.description = descripcion(q.description, q.isForSale !== false);
    }
    return q;
  };

  return { producto };
}

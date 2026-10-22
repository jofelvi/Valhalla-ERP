import type { Boton, ExpenseDraft, Reply, Step } from './draft';
import { perfilDe, sePreguntoElPago } from './perfil-gasto';

/**
 * VOLVER ATRAS.
 *
 * Sin esto, equivocarse de paso obligaba a cancelar y volver a mandar la foto:
 * el socio quedaba "pillado" —sus palabras, 17/09/2026— sobre todo cuando
 * tocaba un boton de un mensaje viejo y el bot solo sabia contestar "no
 * reconocí eso".
 */
export const ATRAS: Boton = { label: '⬅️ Atrás', data: 'back' };

/**
 * De donde viene cada paso. Depende del borrador porque el camino no es unico:
 * un gasto general no pasa por el tipo de compra ni por los renglones.
 */
export function pasoAnterior(step: Step, draft: ExpenseDraft): Step | null {
  const esInsumos = draft.kind === 'INSUMOS';
  switch (step) {
    case 'KIND':
      return null; // el primero: atras es cancelar, y para eso esta Cancelar
    case 'SUPPLIER':
      // En insumos es la segunda pregunta; en un gasto general va al final,
      // despues de la descripcion, y es opcional.
      return esInsumos ? 'KIND' : 'DESCRIPTION';
    case 'TYPE':
      return 'SUPPLIER';
    case 'AMOUNT':
      return esInsumos ? 'TYPE' : 'CATEGORY';
    case 'LINES':
      return 'AMOUNT';
    case 'CATEGORY':
      return esInsumos ? 'LINES' : 'KIND';
    case 'DESCRIPTION':
      return esInsumos ? 'CATEGORY' : 'AMOUNT';
    case 'PAYMENT':
      return esInsumos ? 'DESCRIPTION' : antesDelPago(draft);
    case 'FUNDS':
      // Sin nadie a quien deberle no se pregunto "¿Contado o credito?".
      return sePreguntoElPago(draft) ? 'PAYMENT' : antesDelPago(draft);
    case 'SUMMARY':
      // A credito no se preguntan los fondos: se vuelve al pago.
      return draft.paymentStatus === 'CREDIT' ? 'PAYMENT' : 'FUNDS';
  }
}

/** En un gasto general: el proveedor si la categoria lo pregunta, si no la descripcion. */
const antesDelPago = (draft: ExpenseDraft): Step => (perfilDe(draft.category).aQuien ? 'SUPPLIER' : 'DESCRIPTION');

/**
 * Al retroceder se apaga lo que estaba a medias dentro del paso (una busqueda
 * de producto, una edicion de renglon). Si no, el paso anterior heredaria un
 * "estoy esperando que escribas el nombre" que ya no corresponde.
 */
export function limpiarEnCurso(draft: ExpenseDraft): ExpenseDraft {
  return { ...draft, editingLine: null, searchingLine: null, lastSearch: null };
}

/** Agrega ⬅️ Atrás a una respuesta, salvo que ya lo traiga o sea el primer paso. */
export function conAtras(reply: Reply, step: Step, draft: ExpenseDraft): Reply {
  if (pasoAnterior(step, draft) === null) return reply;
  const filas = reply.buttons ?? [];
  if (filas.flat().some((b) => b.data === ATRAS.data)) return reply;
  // Va al final, junto a Cancelar si esta: son las dos salidas del paso.
  const ultima = filas[filas.length - 1];
  if (ultima?.length === 1 && ultima[0].data === 'cancel') {
    return { ...reply, buttons: [...filas.slice(0, -1), [ATRAS, ultima[0]]] };
  }
  return { ...reply, buttons: [...filas, [ATRAS]] };
}

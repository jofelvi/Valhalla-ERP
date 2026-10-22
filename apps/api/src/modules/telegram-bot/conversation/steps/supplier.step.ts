import { CANCELAR, DraftLine, ExpenseDraft, Step, StepHandler, StepDeps } from '../draft';
import { sugerirProveedores, ProveedorRef } from '../../../expenses/supplier-suggest';
import type { MatchedLine } from '../../../inventory/invoice-parser';
import { trasElDestinatario } from '../perfil-gasto';

function aDraftLine(m: MatchedLine): DraftLine {
  return {
    invoiceText: m.text,
    productId: m.matchedProductId,
    productName: m.matchedProductName,
    quantity: m.qty,
    // Si la factura dice CAJA/BULTO se compra por unidad de compra; KG, por
    // kilo (30,48 kg de mozzarella no son 30 quesos); si no, suelto.
    unit:
      m.invoiceUnit === 'CAJA' || m.invoiceUnit === 'BULTO'
        ? 'unidad-compra'
        : m.measureUnit === 'kg'
          ? 'kg'
          : 'und',
    unitCost: m.unitCost,
    unitsPerPack: m.unitsPerPack,
    confirmed: false,
  };
}

async function conProveedor(
  draft: ExpenseDraft,
  p: ProveedorRef,
  deps: StepDeps,
): Promise<ExpenseDraft> {
  const lines =
    draft.kind === 'INSUMOS' && draft.ocrText
      ? (await deps.matchLines(p.id, draft.ocrText)).map(aDraftLine)
      : [];
  return { ...draft, supplierId: p.id, supplierName: p.name, lines };
}

/**
 * Los insumos pasan antes por "¿que tipo de compra es?": de ahi sale la lista
 * de frecuentes. En un gasto general este es el ultimo dato: sigue el pago.
 */
function siguiente(d: ExpenseDraft): { draft: ExpenseDraft; next: Step } {
  return d.kind === 'INSUMOS' ? { draft: d, next: 'TYPE' } : trasElDestinatario(d);
}

/**
 * En un gasto general se pregunta A QUIEN se le pago, no donde se compro, y
 * sin la lista de proveedores de insumos: el tecnico de la nevera no es
 * Viveluso. Solo se ofrecen los que el OCR reconocio en la foto.
 */
async function promptGeneral(draft: ExpenseDraft, deps: StepDeps) {
  const todos = await deps.listSuppliers();
  const sugeridos = draft.ocrHeader ? sugerirProveedores(draft.ocrHeader, todos).slice(0, 3) : [];
  draft.supplierOptions = sugeridos;
  return {
    text: '¿A quién se le pagó? (opcional)\nEscribe el nombre —el técnico, la empresa— o toca Saltar.',
    buttons: [
      [{ label: '⏭️ Saltar', data: 'sup:ninguno' }],
      ...sugeridos.map((p) => [{ label: p.name, data: `sup:${p.id}` }]),
      [CANCELAR],
    ],
  };
}

export const supplierStep: StepHandler = {
  async prompt(draft, deps) {
    if (draft.kind === 'GENERAL') return promptGeneral(draft, deps);
    const todos = await deps.listSuppliers();
    const sugeridos = draft.ocrHeader ? sugerirProveedores(draft.ocrHeader, todos) : [];
    // Sugeridos primero; luego rellena con los mas usados hasta 6 botones.
    const opciones = [...sugeridos, ...todos.filter((t) => !sugeridos.some((s) => s.id === t.id))].slice(0, 6);
    draft.supplierOptions = opciones;
    const filas = opciones.map((p) => [{ label: p.name, data: `sup:${p.id}` }]);
    filas.push([{ label: '✏️ Otro (escribir)', data: 'sup:otro' }]);
    filas.push([CANCELAR]);
    return {
      text: draft.ocrHeader?.vendor
        ? `¿Dónde se compró? (leí: ${draft.ocrHeader.vendor})`
        : '¿Dónde se compró?',
      buttons: filas,
    };
  },

  async handle(input, draft, deps) {
    if (input.kind === 'callback') {
      if (input.data === 'sup:otro') {
        return { draft: { ...draft, editingLine: -1 }, next: 'STAY', reply: { text: 'Escribe el nombre del proveedor:' } };
      }
      if (input.data === 'sup:ninguno' && draft.kind === 'GENERAL') {
        return siguiente({ ...draft, supplierId: null, supplierName: null });
      }
      // Confirmo crear el proveedor de insumos que escribio.
      if (input.data === 'sup:crear' && draft.pendingSupplierName) {
        const p = await deps.createSupplier(draft.pendingSupplierName);
        return siguiente(await conProveedor({ ...draft, pendingSupplierName: null, editingLine: null }, p, deps));
      }
      const id = input.data.startsWith('sup:') ? input.data.slice(4) : null;
      // Los botones de un mensaje VIEJO siguen vivos en Telegram, y la lista
      // que se muestra cambia con cada factura (el OCR sugiere primero). Por
      // eso, si el id no esta en lo ultimo mostrado, se busca en el catalogo
      // en vez de contestar "no reconocí" y dejar al socio sin salida.
      const elegido = id
        ? (draft.supplierOptions.find((o) => o.id === id) ??
          (await deps.listSuppliers()).find((o) => o.id === id))
        : null;
      if (!elegido) {
        return {
          draft,
          next: 'STAY',
          reply: { text: 'Ese proveedor ya no está en la lista. Toca uno de los botones de abajo o "Otro".' },
        };
      }
      return siguiente(await conProveedor(draft, elegido, deps));
    }

    // Un gasto general acepta el nombre escrito directamente: es a quien se le
    // pago, y NO se da de alta como proveedor de insumos.
    if (draft.kind === 'GENERAL') {
      const nombre = input.text.trim();
      if (nombre.length < 2) return { draft, next: 'STAY', reply: { text: 'Nombre muy corto. Escríbelo de nuevo o toca Saltar.' } };
      const existente = (await deps.listSuppliers()).find((t) => t.name.toLowerCase() === nombre.toLowerCase());
      return siguiente(
        existente
          ? { ...draft, supplierId: existente.id, supplierName: existente.name }
          : { ...draft, supplierId: null, supplierName: nombre.slice(0, 80) },
      );
    }

    // Texto: solo vale si pidio "otro" (editingLine = -1 se usa como bandera aqui).
    if (draft.editingLine === -1) {
      const nombre = input.text.trim();
      if (nombre.length < 2) return { draft, next: 'STAY', reply: { text: 'Nombre muy corto. Escríbelo de nuevo:' } };
      const todos = await deps.listSuppliers();
      const existente = todos.find((t) => t.name.toLowerCase() === nombre.toLowerCase());
      if (existente) return siguiente(await conProveedor({ ...draft, editingLine: null }, existente, deps));
      // No existe: se confirma antes de darlo de alta. Un proveedor de insumos
      // queda para siempre en el catalogo; un error de tipeo no deberia.
      return {
        draft: { ...draft, pendingSupplierName: nombre.slice(0, 80) },
        next: 'STAY',
        reply: {
          text: `No tengo a «${nombre.slice(0, 80)}» como proveedor. ¿Lo creo?`,
          buttons: [
            [{ label: '✅ Sí, crearlo', data: 'sup:crear' }],
            [{ label: '✏️ Escribir otro nombre', data: 'sup:otro' }],
            [CANCELAR],
          ],
        },
      };
    }
    return { draft, next: 'STAY', reply: { text: 'Toca un botón, o "Otro" para escribir el nombre.' } };
  },
};

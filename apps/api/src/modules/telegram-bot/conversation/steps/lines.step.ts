import { CANCELAR, parseMonto } from '../draft';
import type { Boton, DraftLine, ExpenseDraft, StepDeps, StepHandler, UltimaCompra } from '../draft';
import type { PurchaseUnit } from '../../../inventory/dto/create-purchase.dto';
import { fmtMoney } from '../../../expenses/money';
import { escapeHtml } from '../../../expenses/expenses-report.helper';
import { entradaAlInventario, type UnidadDeInventario } from '../unidades-inventario';

// Fuente unica de unidades reconocidas por texto: las claves canonicas (und, kg, gr, l,
// ml, unidad-compra) se listan a si mismas, mas los alias que escribe la gente.
const ALIAS_UNIDAD: Record<string, PurchaseUnit> = {
  'unidad-compra': 'unidad-compra',
  caja: 'unidad-compra',
  cajas: 'unidad-compra',
  bulto: 'unidad-compra',
  bultos: 'unidad-compra',
  paquete: 'unidad-compra',
  paquetes: 'unidad-compra',
  paq: 'unidad-compra',
  // La cesta de tomate (20 kg) y la bandeja de champinones son unidad de
  // compra: el costo que escribe el socio es el de la cesta ENTERA.
  cesta: 'unidad-compra',
  cestas: 'unidad-compra',
  bandeja: 'unidad-compra',
  bandejas: 'unidad-compra',
  saco: 'unidad-compra',
  sacos: 'unidad-compra',
  uc: 'unidad-compra',
  und: 'und',
  un: 'und',
  unidad: 'und',
  unidades: 'und',
  u: 'und',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  gr: 'gr',
  g: 'gr',
  gramos: 'gr',
  l: 'l',
  lt: 'l',
  litro: 'l',
  ml: 'ml',
};

const VOLVER = { label: '↩️ Volver a los renglones', data: 'ln:volver' };

export function parseLineInput(
  text: string,
): { quantity: number; unit: PurchaseUnit; unitCost: number } | null {
  const partes = text.trim().toLowerCase().split(/\s+/);
  if (partes.length < 2 || partes.length > 3) return null;
  const quantity = parseMonto(partes[0]);
  const unitCost = parseMonto(partes[partes.length - 1]);
  if (!quantity || !unitCost) return null;
  let unit: PurchaseUnit = 'und';
  if (partes.length === 3) {
    const u = ALIAS_UNIDAD[partes[1]];
    if (!u) return null;
    unit = u;
  }
  return { quantity, unit, unitCost };
}

/**
 * "3" | "3 kg" | "2 cestas" -> solo cantidad (y unidad, si la escribio).
 * Sirve cuando el costo ya esta puesto (boton "mismo costo" o renglon del OCR).
 */
export function parseQtyInput(text: string): { quantity: number; unit?: PurchaseUnit } | null {
  const partes = text.trim().toLowerCase().split(/\s+/);
  if (partes.length < 1 || partes.length > 2) return null;
  const quantity = parseMonto(partes[0]);
  if (!quantity) return null;
  if (partes.length === 1) return { quantity };
  const unit = ALIAS_UNIDAD[partes[1]];
  return unit ? { quantity, unit } : null;
}

const completa = (l: DraftLine): boolean =>
  Boolean(l.productId && l.quantity && l.unit && l.unitCost);

export const lineasListas = (d: ExpenseDraft): boolean =>
  d.lines.length > 0 && d.lines.every((l) => l.confirmed && completa(l));

const unidadLegible = (u: PurchaseUnit | null): string => (u === 'unidad-compra' ? 'caja/bulto' : (u ?? '?'));

/** 0.201 -> "0,201"; 30.48 -> "30,48"; 15 -> "15". Sin ceros de relleno. */
const num = (n: number): string => String(Math.round(n * 1000) / 1000).replace('.', ',');

/** "caja" / "cajas", "kg", "und": en singular o plural segun la cantidad. */
function unidadConCantidad(u: PurchaseUnit | null, q: number): string {
  if (u === 'unidad-compra') return q === 1 ? 'caja' : 'cajas';
  if (u === 'und') return q === 1 ? 'unidad' : 'unidades';
  return u ?? '';
}

/**
 * Un renglon, en tres lineas: el producto de nuestro catalogo, lo que dice la
 * factura (para ver que el emparejado es el correcto) y la cuenta. "0,201
 * caja/bulto · $146,61 c/u" no se entendia: ¿0,201 que? ¿cuanto es? (dueño,
 * 18/09/2026). Ahora: "0,201 cajas (3 und) × $146,61 = $29,47".
 */
function lineaTexto(l: DraftLine, i: number, d: ExpenseDraft, u?: UnidadDeInventario): string {
  const inv = entradaAlInventario(l, u);
  const alStock = inv ? `\n   ${inv.texto}` : '';
  const marca = l.confirmed ? '✅' : completa(l) ? '▫️' : '❓';
  const nombre = l.productName ? `<b>${escapeHtml(l.productName)}</b>` : '<i>(sin producto: toca 🔎)</i>';
  const factura = l.invoiceText ? `\n   📄 ${escapeHtml(l.invoiceText.slice(0, 48))}` : '';
  if (l.quantity === null) return `${i + 1}) ${marca} ${nombre}${factura}\n   ❓ falta la cantidad: toca ✏️`;
  // Lo que la factura dice que trae cada caja, a la vista: 5 cajas de 36 son
  // 180 botellas al stock, y nadie deberia enterarse despues.
  const expande =
    l.unit === 'unidad-compra' && l.unitsPerPack && l.unitsPerPack > 1
      ? ` (${num(l.quantity * l.unitsPerPack)} und)`
      : '';
  const cant = `${num(l.quantity)} ${unidadConCantidad(l.unit, l.quantity)}${expande}`;
  if (l.unitCost === null || !d.currency) return `${i + 1}) ${marca} ${nombre}${factura}\n   ${cant} × ❓ falta el precio: toca ✏️${alStock}`;
  const porUnidad = l.unit === 'kg' ? 'el kg' : l.unit === 'unidad-compra' ? 'la caja' : 'c/u';
  return `${i + 1}) ${marca} ${nombre}${factura}\n   ${cant} × ${fmtMoney(l.unitCost, d.currency)} ${porUnidad} = <b>${fmtMoney(l.quantity * l.unitCost, d.currency)}</b>${alStock}`;
}

/** Cuanto suman los renglones contra el total de la factura. */
function lineaDeSuma(d: ExpenseDraft): string | null {
  if (!d.currency || !d.lines.length) return null;
  const suma = d.lines.reduce((s, l) => s + (l.quantity ?? 0) * (l.unitCost ?? 0), 0);
  if (!d.amount) return `Suma: <b>${fmtMoney(suma, d.currency)}</b>`;
  const dif = d.amount - suma;
  const cuadra = Math.abs(dif) <= d.amount * 0.01;
  return `Suma: <b>${fmtMoney(suma, d.currency)}</b> de ${fmtMoney(d.amount, d.currency)}${cuadra ? ' ✅' : ` (faltan ${fmtMoney(dif, d.currency)})`}`;
}

/** El costo de la ultima compra, expresado en la moneda de ESTA factura. */
function costoEnMonedaDelBorrador(u: UltimaCompra, d: ExpenseDraft): number | null {
  if (d.currency === 'BS') return d.exchangeRate ? Math.round(u.unitCostUsd * d.exchangeRate * 100) / 100 : null;
  return u.unitCostUsd;
}

/**
 * "La ultima vez": lo que se pago, en las DOS monedas y con la tasa de ESE dia.
 * Sin esto se compra a ciegas — en Venezuela el mismo bulto cambia de precio
 * entre una semana y la otra, y en Bs parece otro numero por la tasa.
 */
function pistaUltimaCompra(u: UltimaCompra | null): string {
  if (!u) return '';
  const dd = String(u.date.getDate()).padStart(2, '0');
  const mm = String(u.date.getMonth() + 1).padStart(2, '0');
  const donde = u.placeName ? ` en ${u.placeName}` : '';
  const cant = `${String(u.quantity).replace('.', ',')} ${unidadLegible(u.unit)}`;
  const enBs =
    u.unitCostBs !== null && u.exchangeRate
      ? ` (${fmtMoney(u.unitCostBs, 'BS')} a la tasa de ese día, ${fmtMoney(u.exchangeRate, 'BS')} por dólar)`
      : '';
  return `

📌 Última compra el ${dd}/${mm}${donde}: ${cant} a ${fmtMoney(u.unitCostUsd, 'USD')} c/u${enBs}.`;
}

/**
 * El costo por unidad que cierra la factura: el total menos lo que ya suman los
 * demas renglones, entre la cantidad de este. Solo cuando este es el unico sin
 * costo y los demas estan completos: la nota de Coca-Cola trae un solo total
 * para tres productos, y hacer esa cuenta a mano en el telefono es donde se
 * equivoca el socio.
 */
export function costoQueCierraElTotal(d: ExpenseDraft, i: number): number | null {
  const linea = d.lines[i];
  if (!d.amount || !linea?.quantity) return null;
  const otros = d.lines.filter((_, k) => k !== i);
  if (otros.some((l) => !l.quantity || !l.unitCost)) return null;
  const resto = d.amount - otros.reduce((s, l) => s + (l.quantity ?? 0) * (l.unitCost ?? 0), 0);
  if (resto <= 0) return null;
  return Math.round((resto / linea.quantity) * 100) / 100;
}

/** Pide cantidad/unidad/costo mostrando lo que se pago la vez pasada. */
async function pedirCantidadYCosto(
  d: ExpenseDraft,
  i: number,
  deps: StepDeps,
): Promise<{ text: string; buttons: Boton[][] }> {
  const linea = d.lines[i];
  const ultima = linea?.productId
    ? await deps.lastPurchase(linea.productId).catch(() => null)
    : null;
  const botones: Boton[][] = [];
  const mismo = ultima ? costoEnMonedaDelBorrador(ultima, d) : null;
  if (ultima && mismo !== null && d.currency) {
    botones.push([{ label: `💲 Mismo costo: ${fmtMoney(mismo, d.currency)}`, data: `ln:mismo:${i}` }]);
  }
  const cierra = costoQueCierraElTotal(d, i);
  if (cierra !== null && d.currency) {
    botones.push([{ label: `🧮 Lo que falta para el total: ${fmtMoney(cierra, d.currency)} c/u`, data: `ln:resto:${i}` }]);
  }
  botones.push([VOLVER], [CANCELAR]);
  // La nota ya dijo cuanto vino y solo falta el precio: basta escribirlo.
  const soloFaltaCosto = linea?.quantity !== null && linea?.quantity !== undefined && linea.unitCost === null;
  return {
    text:
      (soloFaltaCosto
        ? `La factura dice ${String(linea.quantity).replace('.', ',')} ${unidadLegible(linea.unit)} pero no el precio. Escribe el costo de cada una (ej: 7,50), o cantidad, unidad y costo si la cantidad está mal.`
        : `Escribe cantidad, unidad y costo del renglón ${i + 1}. Ej: 20 und 850 · 2,5 kg 1200 · 1 cesta 21400`) +
      pistaUltimaCompra(ultima),
    buttons: botones,
  };
}

function botonesDe(d: ExpenseDraft): Boton[][] {
  const filas: Boton[][] = d.lines.map((l, i) => [
    { label: `${i + 1} ✅`, data: `ln:ok:${i}` },
    { label: `${i + 1} 🔎`, data: `ln:buscar:${i}` },
    { label: `${i + 1} ✏️`, data: `ln:edit:${i}` },
    { label: `${i + 1} 🗑`, data: `ln:del:${i}` },
  ]);
  if (d.purchaseType) filas.push([{ label: '⭐ Lo de siempre', data: 'ln:frec' }]);
  filas.push([{ label: '➕ Agregar renglón', data: 'ln:add' }, { label: '✔️ Listo', data: 'ln:listo' }]);
  filas.push([CANCELAR]);
  return filas;
}

function setLine(d: ExpenseDraft, i: number, cambio: Partial<DraftLine>): ExpenseDraft {
  const lines = d.lines.map((l, k) => (k === i ? { ...l, ...cambio } : l));
  return { ...d, lines };
}

const lineaVacia = (): DraftLine => ({
  invoiceText: '',
  productId: null,
  productName: null,
  quantity: null,
  unit: 'und',
  unitCost: null,
  unitsPerPack: null,
  confirmed: false,
});

export const linesStep: StepHandler = {
  async prompt(draft, deps) {
    if (!draft.lines.length) {
      const filas: Boton[][] = [];
      if (draft.purchaseType) filas.push([{ label: '⭐ Lo de siempre', data: 'ln:frec' }]);
      filas.push([CANCELAR]);
      return {
        text: draft.purchaseType
          ? 'No reconocí renglones en la factura. Toca "Lo de siempre" para elegir de la lista, o escribe el nombre del primer producto:'
          : 'No reconocí renglones en la factura. Escribe el nombre del primer producto para buscarlo:',
        buttons: filas,
      };
    }
    const ids = [...new Set(draft.lines.map((l) => l.productId).filter((x): x is string => Boolean(x)))];
    const unidades = await deps.productUnits(ids).catch(() => ({}) as Record<string, UnidadDeInventario>);
    const texto = [
      'Renglones de la factura. Confirma cada uno (✅), busca otro producto (🔎), corrige cantidad/costo (✏️) o quítalo (🗑).',
      ...draft.lines.map((l, i) => lineaTexto(l, i, draft, l.productId ? unidades[l.productId] : undefined)),
      lineaDeSuma(draft),
    ]
      .filter((l): l is string => Boolean(l))
      .join('\n\n');
    return { text: texto, buttons: botonesDe(draft) };
  },

  async handle(input, draft, deps) {
    const reprompt = async (d: ExpenseDraft, aviso?: string) => {
      const p = await linesStep.prompt(d, deps);
      return { draft: d, next: 'STAY' as const, reply: { ...p, text: aviso ? `${aviso}\n\n${p.text}` : p.text } };
    };

    if (input.kind === 'text') {
      // Sin renglones: el primer texto arranca una busqueda para el renglon 0.
      if (!draft.lines.length) {
        const d = { ...draft, lines: [lineaVacia()], searchingLine: 0 };
        return linesStep.handle(input, d, deps);
      }
      if (draft.searchingLine !== null) {
        const i = draft.searchingLine;
        const texto = input.text.trim();
        const res = await deps.searchProducts(texto);
        // Lo escrito queda en el borrador: al elegir se aprende "texto -> producto".
        const d = { ...draft, lastSearch: texto };
        if (!res.length) {
          // El bot no crea productos (decision del dueño, 11/09): un "Luchuga"
          // creado desde el telefono parte el stock de "Lechuga Romana" en dos.
          return {
            draft: d,
            next: 'STAY',
            reply: {
              text:
                `No encontré "${texto}" ni nada parecido en el catálogo. Escribe otro nombre, ` +
                'o vuelve a los renglones y pídele a un admin que lo cree en la web.',
              buttons: [[VOLVER], [CANCELAR]],
            },
          };
        }
        return {
          draft: d,
          next: 'STAY',
          reply: {
            text: `Elige el producto para el renglón ${i + 1}:`,
            buttons: [
              ...res.slice(0, 6).map((p) => [{ label: p.name, data: `ln:pick:${i}:${p.id}` }]),
              [VOLVER],
              [CANCELAR],
            ],
          },
        };
      }
      if (draft.editingLine !== null) {
        const i = draft.editingLine;
        const linea = draft.lines[i];
        const v = parseLineInput(input.text);
        // Con el costo ya puesto (boton "mismo costo", o renglon del OCR) basta
        // la cantidad: pedir de nuevo el costo que el bot acaba de mostrar es
        // hacerle escribir al socio un numero que ya esta en pantalla.
        const soloCant = v ? null : linea?.unitCost !== null ? parseQtyInput(input.text) : null;
        // Cantidad leida de la nota y sin precio: un numero suelto es el costo.
        const soloCosto =
          !v && linea?.quantity !== null && linea?.unitCost === null && input.text.trim().split(/\s+/).length === 1
            ? parseMonto(input.text)
            : null;
        if (soloCosto) {
          const d = setLine({ ...draft, editingLine: null }, i, { unitCost: soloCosto, confirmed: Boolean(linea.productId) });
          return reprompt(d);
        }
        if (!v && !soloCant) {
          return {
            draft,
            next: 'STAY',
            reply: { text: 'Escribe cantidad, unidad y costo. Ej: 20 und 850 · 2,5 kg 1200 · 1 cesta 21400' },
          };
        }
        const cambio = v ?? { quantity: soloCant!.quantity, unit: soloCant!.unit ?? linea.unit ?? 'und' };
        const d = setLine({ ...draft, editingLine: null }, i, { ...cambio, confirmed: Boolean(linea.productId) });
        return reprompt(d);
      }
      return reprompt(draft, 'Usa los botones de cada renglón.');
    }

    const [, accion, a, b] = input.data.split(':');
    const i = a !== undefined ? Number(a) : NaN;
    const linea = Number.isInteger(i) ? draft.lines[i] : undefined;

    switch (accion) {
      case 'ok': {
        if (!linea) return reprompt(draft);
        if (!linea.productId) return reprompt(draft, `El renglón ${i + 1} no tiene producto: usa 🔎 para buscarlo.`);
        if (!completa(linea)) return reprompt(draft, `Al renglón ${i + 1} le falta cantidad o costo: usa ✏️.`);
        // Que no llegue al final una unidad que el inventario rechaza: se
        // perdia la compra entera en el ultimo paso (Viveluso, 18/09/2026).
        const u = (await deps.productUnits([linea.productId]).catch(() => ({}) as Record<string, UnidadDeInventario>))[linea.productId];
        const inv = entradaAlInventario(linea, u);
        if (inv && !inv.ok) return reprompt(draft, `Renglón ${i + 1}: ${inv.texto}`);
        return reprompt(setLine(draft, i, { confirmed: true }));
      }
      case 'buscar':
        if (!linea) return reprompt(draft);
        return { draft: { ...draft, searchingLine: i, editingLine: null }, next: 'STAY', reply: { text: `Escribe el nombre del producto para el renglón ${i + 1}:` } };
      case 'volver':
        // Salida de una busqueda sin resultado util: desde los renglones se puede
        // quitar este (🗑) y seguir con el resto de la compra.
        return reprompt({ ...draft, searchingLine: null, lastSearch: null });
      case 'pick': {
        if (!linea || !b) return reprompt(draft);
        if (draft.lastSearch) {
          // Aprender es una comodidad: si falla, el renglon igual queda elegido.
          await deps.learnSearchAlias(draft.lastSearch, b).catch(() => undefined);
        }
        const d = setLine({ ...draft, searchingLine: null, lastSearch: null }, i, { productId: b, productName: await nombreDe(b, deps), confirmed: completa({ ...linea, productId: b }) });
        if (!completa(d.lines[i])) {
          return { draft: { ...d, editingLine: i }, next: 'STAY', reply: await pedirCantidadYCosto(d, i, deps) };
        }
        return reprompt(d);
      }
      case 'edit': {
        if (!linea) return reprompt(draft);
        const d = { ...draft, editingLine: i, searchingLine: null };
        return { draft: d, next: 'STAY', reply: await pedirCantidadYCosto(d, i, deps) };
      }
      case 'mismo': {
        // El costo de la vez pasada, pasado a la moneda de esta factura con la
        // tasa de HOY: reusar los Bs viejos seria comprar a una tasa muerta.
        if (!linea?.productId) return reprompt(draft);
        const ultima = await deps.lastPurchase(linea.productId).catch(() => null);
        const costo = ultima ? costoEnMonedaDelBorrador(ultima, draft) : null;
        if (costo === null) return reprompt(draft, 'No tengo el costo de la compra anterior de ese producto.');
        const d = setLine({ ...draft, editingLine: i }, i, { unitCost: costo });
        return {
          draft: d,
          next: 'STAY',
          reply: {
            text: `Costo puesto en ${fmtMoney(costo, draft.currency ?? 'USD')} c/u. Ahora escribe cuánto se compró. Ej: 3 · 2 kg · 1 cesta`,
            buttons: [[VOLVER], [CANCELAR]],
          },
        };
      }
      case 'resto': {
        if (!linea) return reprompt(draft);
        const costo = costoQueCierraElTotal(draft, i);
        if (costo === null) return reprompt(draft, 'Ya no cuadra: completa primero los demás renglones.');
        const d = setLine({ ...draft, editingLine: null }, i, { unitCost: costo });
        return reprompt(setLine(d, i, { confirmed: completa(d.lines[i]) }));
      }
      case 'frec': {
        const productos = await deps.listFrequentProducts(draft.purchaseType ?? '', draft.supplierId);
        if (!productos.length) {
          return reprompt(draft, 'Todavía no hay lista de "lo de siempre" para este tipo de compra.');
        }
        // Se filtran los que ya estan en la factura: tocarlos dos veces crearia
        // dos renglones del mismo producto.
        const yaEstan = new Set(draft.lines.map((l) => l.productId).filter(Boolean));
        const faltan = productos.filter((p) => !yaEstan.has(p.id));
        if (!faltan.length) return reprompt(draft, 'Ya están todos los de la lista en la factura.');
        return {
          draft,
          next: 'STAY',
          reply: {
            text: 'Toca lo que se compró (uno por uno; cada vez pido cantidad y costo):',
            buttons: [...faltan.map((p) => [{ label: p.name, data: `ln:fpick:${p.id}` }]), [VOLVER], [CANCELAR]],
          },
        };
      }
      case 'fpick': {
        // `a` es el productId, no un indice: este boton sale de la lista de frecuentes.
        const productos = await deps.listFrequentProducts(draft.purchaseType ?? '', draft.supplierId);
        const elegido = productos.find((p) => p.id === a);
        if (!elegido) return reprompt(draft);
        const k = draft.lines.length;
        const d: ExpenseDraft = {
          ...draft,
          lines: [...draft.lines, { ...lineaVacia(), productId: elegido.id, productName: elegido.name }],
          editingLine: k,
          searchingLine: null,
        };
        return { draft: d, next: 'STAY', reply: await pedirCantidadYCosto(d, k, deps) };
      }
      case 'del':
        if (!linea) return reprompt(draft);
        return reprompt({ ...draft, lines: draft.lines.filter((_, k) => k !== i), editingLine: null, searchingLine: null });
      case 'add': {
        const d = { ...draft, lines: [...draft.lines, lineaVacia()], searchingLine: draft.lines.length, editingLine: null };
        return { draft: d, next: 'STAY', reply: { text: `Escribe el nombre del producto del renglón ${d.lines.length}:` } };
      }
      case 'listo': {
        if (!lineasListas(draft)) return reprompt(draft, 'Confirma todos los renglones (✅) o quita los que sobren antes de seguir.');
        const suma = draft.lines.reduce((s, l) => s + (l.quantity ?? 0) * (l.unitCost ?? 0), 0);
        const aviso =
          draft.amount && draft.currency && Math.abs(suma - draft.amount) / draft.amount > 0.01
            ? `⚠️ La suma de renglones (${fmtMoney(suma, draft.currency)}) difiere del total (${fmtMoney(draft.amount, draft.currency)}). Se registra el total de la factura.`
            : undefined;
        return { draft, next: 'CATEGORY', reply: aviso ? { text: aviso } : undefined };
      }
      default:
        return reprompt(draft);
    }
  },
};

/** El boton solo lleva el id (64 bytes): el nombre se resuelve con una busqueda por id. */
async function nombreDe(
  productId: string,
  deps: { searchProducts: (q: string) => Promise<Array<{ id: string; name: string }>> },
): Promise<string> {
  const r = await deps.searchProducts(`id:${productId}`);
  return r.find((p) => p.id === productId)?.name ?? '(producto sin nombre)';
}

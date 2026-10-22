import {
  getPackConfig,
  packsParaProducto,
  RegistroPacks,
} from './pack-registry';

/**
 * Convertir cervezas sueltas YA ENTREGADAS en un tobo, media caja o caja.
 *
 * Dos reglas del dueño gobiernan este archivo, y las dos estan escritas como
 * pruebas en el spec hermano:
 *
 * 1. CONVERTIR ES UNA OPCION, NO UNA OBLIGACION (20/09/2026). `opciones()`
 *    calcula y no toca nada. Aplicar es una llamada aparte con el pack elegido
 *    y cuantos. Nada se convierte porque el sistema lo haya decidido.
 *
 * 2. EL PRECIO SALE DEL CATALOGO. Llega por parametro; aca no hay ni una cifra
 *    de dinero cableada. El mapa que usaba la web tenia el tobo de lata en $11
 *    mientras la ficha decia $14.
 *
 * Y una regla que sale de leer el codigo que habia: SE DEDUCE DE LO ENTREGADO.
 * La version del APK calculaba la opcion sobre `deliveredQty` pero descontaba
 * recorriendo `quantity`. Con una linea de 12 pedidas / 6 entregadas mas otra
 * de 6 y 6, convertir se llevaba la primera linea ENTERA — incluidas 6
 * unidades que el cliente pidio y todavia no habia recibido. Dejaban de estar
 * en la cuenta y el tobo decia que se entregaron 12 cuando solo 6 salieron.
 * Aca lo no entregado no se toca nunca.
 */

/** Item de orden tal como viaja en el documento. Puro, sin tipos de Mongoose. */
export type ItemOrden = Record<string, unknown>;

export interface OpcionConversion {
  sourceProductId: string;
  sourceProductName: string;
  targetPackId: string;
  packName: string;
  /** Unidades que trae el pack. */
  size: number;
  /** Precio del catalogo, no del cliente. */
  packPrice: number;
  numPacksPossible: number;
  currentDeliveredQty: number;
  savingsUsd: number;
}

export interface EleccionConversion {
  sourceProductId: string;
  targetPackId: string;
  packsToConvert: number;
}

export interface ResultadoConversion {
  items: ItemOrden[];
  /** Texto de la nota de sistema que deja rastro de la conversion. */
  nota: string;
  savingsUsd: number;
  unidadesConvertidas: number;
}

/**
 * Misma aritmetica que `normalizePackLines` (`+n.toFixed(2)`), a proposito: esa
 * funcion corre en CADA patch con items y volveria a calcular el total de la
 * linea del pack. Si aca se redondeara distinto, el siguiente patch cambiaria
 * el numero de la cuenta sin que nadie hubiera tocado nada.
 */
const round2 = (n: number): number => +n.toFixed(2);

const num = (item: ItemOrden, campo: string): number =>
  Number(item[campo]) || 0;

const nombreDe = (item: ItemOrden): string =>
  String(item.productName ?? item.name ?? 'Cerveza');

const estaCancelado = (item: ItemOrden): boolean =>
  item.cancelledAt !== undefined && item.cancelledAt !== null;

/**
 * Que conversiones tiene disponibles esta orden. NO modifica nada.
 *
 * @param precioPorPack precio de catalogo por id de pack. Un pack sin precio
 *        (o en 0) no se ofrece: mejor no ofrecer que ofrecer a $0.
 */
export function opcionesDeConversion(
  items: ItemOrden[],
  precioPorPack: Record<string, number>,
  registro: RegistroPacks,
): OpcionConversion[] {
  if (!items?.length) return [];

  // Lo entregado se suma por producto, no por linea: las notas por item parten
  // una misma cerveza en varias lineas (6 normales + 6 "bien frias") y siguen
  // siendo 12 unidades del mismo producto.
  const entregadoPorProducto = new Map<
    string,
    { entregado: number; muestra: ItemOrden }
  >();

  for (const item of items) {
    if (estaCancelado(item)) continue;
    const entregado = num(item, 'deliveredQty');
    if (entregado <= 0) continue;

    const pid = String(item.productId ?? '');
    if (!pid) continue;

    const previo = entregadoPorProducto.get(pid);
    entregadoPorProducto.set(pid, {
      entregado: (previo?.entregado ?? 0) + entregado,
      muestra: previo?.muestra ?? item,
    });
  }

  const opciones: OpcionConversion[] = [];

  for (const [productId, info] of entregadoPorProducto) {
    for (const packId of packsParaProducto(registro, productId)) {
      const cfg = getPackConfig(registro, packId);
      if (!cfg) continue;

      const packPrice = Number(precioPorPack[packId]) || 0;
      if (packPrice <= 0) continue;

      if (info.entregado < cfg.totalUnits) continue;

      const numPacksPossible = Math.floor(info.entregado / cfg.totalUnits);
      const unidades = numPacksPossible * cfg.totalUnits;
      const costoActual = round2(num(info.muestra, 'unitPrice') * unidades);
      const costoPack = round2(packPrice * numPacksPossible);

      opciones.push({
        sourceProductId: productId,
        sourceProductName: nombreDe(info.muestra),
        targetPackId: packId,
        packName: cfg.label,
        size: cfg.totalUnits,
        packPrice,
        numPacksPossible,
        currentDeliveredQty: info.entregado,
        savingsUsd: round2(Math.max(0, costoActual - costoPack)),
      });
    }
  }

  return opciones;
}

/**
 * Aplica UNA conversion elegida. Devuelve items nuevos; no muta los de entrada.
 *
 * Lanza si la eleccion no es valida — y lanza ANTES de tocar nada, para que no
 * quede una orden a medio convertir.
 */
export function aplicarConversion(
  items: ItemOrden[],
  eleccion: EleccionConversion,
  packPrice: number,
  registro: RegistroPacks,
): ResultadoConversion {
  const { sourceProductId, targetPackId } = eleccion;
  const packs = Math.floor(Number(eleccion.packsToConvert) || 0);

  if (packs <= 0) {
    throw new Error('Hay que convertir al menos un pack');
  }

  const cfg = getPackConfig(registro, targetPackId);
  if (!cfg) {
    throw new Error(`El pack ${targetPackId} no existe en el registro`);
  }

  if (!packsParaProducto(registro, sourceProductId).includes(targetPackId)) {
    throw new Error(`${sourceProductId} no se puede convertir en ${cfg.label}`);
  }

  if (!(packPrice > 0)) {
    throw new Error(`${cfg.label} no tiene precio en el catalogo`);
  }

  const unidades = cfg.totalUnits * packs;

  const lineasDelProducto = items.filter(
    (it) =>
      String(it.productId ?? '') === sourceProductId && !estaCancelado(it),
  );
  const entregadoTotal = lineasDelProducto.reduce(
    (suma, it) => suma + num(it, 'deliveredQty'),
    0,
  );

  if (entregadoTotal < unidades) {
    throw new Error(
      `Solo hay ${entregadoTotal} unidades entregadas y el pack necesita ${unidades}`,
    );
  }

  let restante = unidades;
  let consumidoMovido = 0;
  let precioUnitarioSuelto = 0;
  let nombreOrigen = 'Cerveza';

  const resultado: ItemOrden[] = [];

  for (const item of items) {
    const esDelProducto =
      String(item.productId ?? '') === sourceProductId && !estaCancelado(item);

    if (!esDelProducto || restante <= 0) {
      resultado.push({ ...item });
      continue;
    }

    if (precioUnitarioSuelto === 0) {
      precioUnitarioSuelto = num(item, 'unitPrice');
      nombreOrigen = nombreDe(item);
    }

    // Solo se saca de lo ENTREGADO. Lo pedido y no entregado se queda.
    const saca = Math.min(num(item, 'deliveredQty'), restante);
    if (saca <= 0) {
      resultado.push({ ...item });
      continue;
    }

    restante -= saca;

    // Lo ya consumido se CONSERVA, no se inventa: se mueve a la linea del pack
    // en la misma medida en que sale de esta. Poner `inventoryConsumedQty =
    // unidades` a ciegas (como hacia el APK) le dice al servidor que 12
    // unidades ya se descontaron aunque no fuera cierto, y entonces el respaldo
    // del cobro deja de descontarlas para siempre.
    const enviadoAca = Math.min(num(item, 'sentQty'), saca);
    const consumidoAca = Math.min(num(item, 'inventoryConsumedQty'), saca);
    consumidoMovido += consumidoAca;

    const nuevaQty = num(item, 'quantity') - saca;
    if (nuevaQty <= 0) continue; // la linea se va entera

    const nuevoTotal = round2(num(item, 'unitPrice') * nuevaQty);
    resultado.push({
      ...item,
      quantity: nuevaQty,
      total: nuevoTotal,
      totalPrice: nuevoTotal,
      deliveredQty: num(item, 'deliveredQty') - saca,
      sentQty: Math.max(0, num(item, 'sentQty') - enviadoAca),
      inventoryConsumedQty: Math.max(
        0,
        num(item, 'inventoryConsumedQty') - consumidoAca,
      ),
    });
  }

  if (restante > 0) {
    // No deberia pasar: se valido el total entregado antes de empezar.
    throw new Error(
      `Faltaron ${restante} unidades entregadas al aplicar la conversion`,
    );
  }

  const totalPack = round2(packPrice * packs);
  const costoAnterior = round2(precioUnitarioSuelto * unidades);
  const savingsUsd = round2(Math.max(0, costoAnterior - totalPack));

  resultado.push({
    productId: targetPackId,
    name: cfg.label,
    productName: cfg.label,
    quantity: unidades,
    presentationQty: cfg.totalUnits,
    unitPrice: round2(packPrice / cfg.totalUnits),
    total: totalPack,
    totalPrice: totalPack,
    deliveredQty: unidades,
    // Entregado implica comandado: la linea nace enviada para que la comanda
    // no la vuelva a imprimir. No se deriva de lo que traian las lineas
    // sueltas, porque un sentQty por debajo de lo entregado es un estado
    // imposible que dejaria al pack figurando como pendiente de despachar.
    sentQty: unidades,
    inventoryConsumedQty: consumidoMovido,
  });

  const nota =
    `${unidades} ${nombreOrigen} → ${packs} ${cfg.label} ` +
    `(conversion, ahorro $${savingsUsd.toFixed(2)})`;

  return { items: resultado, nota, savingsUsd, unidadesConvertidas: unidades };
}

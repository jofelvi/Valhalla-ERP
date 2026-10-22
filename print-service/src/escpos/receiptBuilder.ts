import {
  PrintRequest,
  ComandaRequest,
  PrecuentaRequest,
  RondaRequest,
  FichaRequest,
} from '../types/printRequest';
import {
  ESC_INIT,
  ESC_BOLD_ON,
  ESC_BOLD_OFF,
  ESC_ALIGN_CENTER,
  ESC_ALIGN_LEFT,
  ESC_DOUBLE_SIZE,
  ESC_NORMAL_SIZE,
  LF,
  ESC_FEED_LINES,
  ESC_PARTIAL_CUT,
  LINE_WIDTH,
  encodeText,
  dashedLine,
  solidLine,
  twoColumnLine,
  normalizeText,
  centerText,
  wrapText,
  padCenter,
  padRight,
  ESC_INVERSE_ON,
  ESC_INVERSE_OFF,
  ESC_DOUBLE_HEIGHT,
} from './commands';
import { generateQrCode } from './qrGenerator';

/**
 * Marcas de INICIO y FIN de ticket.
 *
 * Cuando salen varios tickets seguidos por la misma impresora, el papel es una
 * tira continua y hay que adivinar donde termina uno y empieza el otro para
 * picarlo. Estas dos bandas —en video inverso, imposibles de confundir con el
 * contenido— dicen donde cortar.
 */
function bandaInicio(etiqueta: string): Buffer {
  const texto = padCenter(`>> INICIO ${etiqueta} <<`.slice(0, LINE_WIDTH));
  return Buffer.concat([
    ESC_ALIGN_LEFT,
    ESC_INVERSE_ON,
    encodeText(normalizeText(texto)),
    ESC_INVERSE_OFF,
    LF,
  ]);
}

function bandaFin(etiqueta: string): Buffer {
  const texto = padCenter(
    `-- FIN ${etiqueta} - CORTAR --`.slice(0, LINE_WIDTH),
  );
  return Buffer.concat([
    ESC_ALIGN_LEFT,
    ESC_INVERSE_ON,
    encodeText(normalizeText(texto)),
    ESC_INVERSE_OFF,
    LF,
  ]);
}

/**
 * Línea de un cargo con etiqueta dinámica (servicio). Sin etiqueta no hay
 * línea: el ticket no inventa "Servicio (10%)" cuando el pedido no lo trae.
 * Con etiqueta y monto imprime "etiqueta: monto"; con etiqueta sin monto
 * (p. ej. "Servicio incluido") imprime solo la etiqueta.
 */
function lineaCargo(
  line: (s: string) => Buffer,
  etiqueta: string | undefined,
  monto: number | undefined,
): Buffer | null {
  const label = etiqueta ? normalizeText(etiqueta).trim() : '';
  if (!label) return null;
  if (monto && monto > 0) {
    return line(twoColumnLine(`${label}:`, `$${monto.toFixed(2)}`));
  }
  return line(label);
}

/** Parte un texto en líneas del ancho dado, también las palabras sin espacios. */
function envolver(texto: string, ancho: number = LINE_WIDTH): string[] {
  return wrapText(texto, ancho).flatMap(
    (l) => l.match(new RegExp(`.{1,${ancho}}`, 'g')) ?? [],
  );
}

/**
 * Comanda de una estación (cocina, pizza, barra): lo mínimo para preparar el pedido.
 *
 *   COCINA / #A1B2          ← estación y número, grandes
 *   Mesa 5 - Carlos   14:30 ← dónde, mesonero y hora, en una línea
 *   2x Pizza Charcuteria    ← productos a doble alto, lo que se lee de reojo
 *      SIN cebolla
 *      > bien cocida
 *   NOTA: sin sal           ← solo si el pedido la trae
 *
 * Sin bandas de inicio/fin, sin rayas sólidas, sin pie con fecha, sin la hora de cada producto.
 * Nunca falla por el contenido del pedido (ver `buildReceipt`).
 */
export function buildComanda(data: ComandaRequest, station?: string): Buffer {
  const parts: Buffer[] = [];
  const line = (s: string) => Buffer.concat([encodeText(normalizeText(s)), LF]);
  const raya = () => Buffer.concat([dashedLine(), LF]);
  const lineas = (s: string, ancho = LINE_WIDTH): Buffer[] =>
    envolver(s, ancho).map(line);

  const items = Array.isArray(data.items) ? data.items : [];
  const estacion = aTexto(station) || 'COMANDA';

  parts.push(ESC_INIT);

  // ── Cabecera: estación (video inverso) y número de orden, en grande ──
  parts.push(ESC_ALIGN_CENTER);
  if (data.isCopy) parts.push(ESC_BOLD_ON, line('** COPIA **'), ESC_BOLD_OFF);
  parts.push(ESC_DOUBLE_SIZE, ESC_BOLD_ON);
  parts.push(
    ESC_INVERSE_ON,
    line(padCenter(` ${estacion} `.slice(0, LINE_WIDTH / 2), LINE_WIDTH / 2)),
    ESC_INVERSE_OFF,
  );
  parts.push(
    line(
      padCenter(
        `#${aTexto(data.orderNumber)}`.slice(0, LINE_WIDTH / 2),
        LINE_WIDTH / 2,
      ),
    ),
  );
  parts.push(ESC_NORMAL_SIZE, ESC_BOLD_OFF, ESC_ALIGN_LEFT);

  // ── Una línea: dónde - mesonero ........ hora ──
  const quien = [
    aTexto(data.table) || aTexto(data.orderType),
    aTexto(data.waiter),
  ]
    .filter((x) => x !== '')
    .join(' - ');
  const hora = aTexto(data.time);
  if (quien.length + 1 + hora.length <= LINE_WIDTH) {
    parts.push(line(twoColumnLine(quien, hora)));
  } else {
    parts.push(...lineas(quien));
    if (hora) parts.push(line(twoColumnLine('', hora)));
  }
  parts.push(raya());

  // ── Productos ──
  for (const item of items) {
    const prefijo = `${cantidad(item?.quantity)}x `;
    const nombre = aTexto(item?.name) || 'Producto';
    parts.push(ESC_DOUBLE_HEIGHT, ESC_BOLD_ON);
    envolver(nombre, LINE_WIDTH - prefijo.length).forEach((l, i) => {
      parts.push(line((i === 0 ? prefijo : ' '.repeat(prefijo.length)) + l));
    });
    parts.push(ESC_BOLD_OFF, ESC_NORMAL_SIZE);

    // Mismo producto pedido en varias tandas: cuántos en cada una (la estación sabe cuáles son nuevos).
    const tandas = Array.isArray(item?.tandas) ? item.tandas : [];
    if (tandas.length > 1) {
      for (const t of tandas) {
        parts.push(line(`    ${aTexto(t?.time)} -> ${cantidad(t?.quantity)}`));
      }
    }

    const quitados = item?.customizations?.removedIngredients;
    if (Array.isArray(quitados) && quitados.length > 0) {
      parts.push(ESC_BOLD_ON);
      for (const ing of quitados) {
        if (aTexto(ing))
          parts.push(line(`    SIN ${aTexto(ing).toUpperCase()}`));
      }
      parts.push(ESC_BOLD_OFF);
    }

    if (aTexto(item?.notes)) {
      parts.push(ESC_BOLD_ON);
      for (const l of envolver(aTexto(item.notes), LINE_WIDTH - 6)) {
        parts.push(line(`    > ${l}`));
      }
      parts.push(ESC_BOLD_OFF);
    }
  }

  // ── Nota del pedido ──
  if (aTexto(data.comment)) {
    parts.push(raya(), ESC_BOLD_ON, ESC_DOUBLE_HEIGHT);
    parts.push(...lineas(`NOTA: ${aTexto(data.comment)}`));
    parts.push(ESC_NORMAL_SIZE, ESC_BOLD_OFF);
  }

  // ── QR de entrega: solo si el pedido lo trae (módulo de fichas activo) ──
  if (aTexto(data.qrData)) {
    parts.push(raya(), generateQrCode(aTexto(data.qrData)));
    parts.push(ESC_ALIGN_CENTER, ESC_BOLD_ON);
    parts.push(line('ESCANEAR PARA ENTREGAR'), ESC_BOLD_OFF, ESC_ALIGN_LEFT);
  }

  parts.push(ESC_FEED_LINES(3), ESC_PARTIAL_CUT);
  return Buffer.concat(parts);
}

/**
 * Resumen para caja: qué salió a las estaciones, sin precios. Apagado por defecto
 * (`RESUMEN_CAJA=1` lo enciende): es un papel más por cada pedido en la impresora de caja.
 */
export function buildCajaSummary(data: ComandaRequest): Buffer {
  const parts: Buffer[] = [];
  const line = (s: string) => Buffer.concat([encodeText(normalizeText(s)), LF]);
  const raya = () => Buffer.concat([dashedLine(), LF]);

  const items = Array.isArray(data.items) ? data.items : [];

  parts.push(ESC_INIT, ESC_ALIGN_CENTER, ESC_BOLD_ON);
  parts.push(line(data.isCopy ? 'RESUMEN CAJA (COPIA)' : 'RESUMEN CAJA'));
  parts.push(ESC_BOLD_OFF, ESC_ALIGN_LEFT);

  const quien = [
    aTexto(data.table) || aTexto(data.orderType),
    aTexto(data.waiter),
  ]
    .filter((x) => x !== '')
    .join(' - ');
  parts.push(
    line(twoColumnLine(`#${aTexto(data.orderNumber)}`, aTexto(data.time))),
  );
  for (const l of envolver(quien)) parts.push(line(l));
  parts.push(raya());

  for (const item of items) {
    const prefijo = `${cantidad(item?.quantity)}x `;
    envolver(
      aTexto(item?.name) || 'Producto',
      LINE_WIDTH - prefijo.length,
    ).forEach((l, i) => {
      parts.push(line((i === 0 ? prefijo : ' '.repeat(prefijo.length)) + l));
    });
  }

  if (aTexto(data.comment)) {
    parts.push(raya());
    for (const l of envolver(`NOTA: ${aTexto(data.comment)}`))
      parts.push(line(l));
  }

  parts.push(ESC_FEED_LINES(3), ESC_PARTIAL_CUT);
  return Buffer.concat(parts);
}

/**
 * Recibo del cliente: corto y a prueba de datos raros.
 *
 *   - Una sola línea de orden + fecha, una línea por producto, los totales y los pagos. Sin bandas,
 *     sin títulos de sección, sin líneas en blanco de relleno, sin precio unitario aparte.
 *   - Nunca falla por el contenido del pedido: números ausentes o inválidos valen 0, textos ausentes
 *     son vacíos, una lista que no es lista es una lista vacía. Lo peor que pasa es un ticket pobre,
 *     jamás una excepción que deje al cliente sin recibo.
 */
const aNumero = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;
const aTexto = (v: unknown): string =>
  typeof v === 'string'
    ? normalizeText(v).trim()
    : typeof v === 'number' && Number.isFinite(v)
      ? String(v)
      : '';
const dinero = (v: unknown): string => `$${aNumero(v).toFixed(2)}`;
const cantidad = (v: unknown): string => {
  const q = aNumero(v);
  if (q <= 0) return '1';
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '');
};

export function buildReceipt(data: PrintRequest): Buffer {
  const parts: Buffer[] = [];
  const line = (s: string) => Buffer.concat([encodeText(normalizeText(s)), LF]);
  const dos = (izq: string, der: string) => line(twoColumnLine(izq, der));
  const raya = () => Buffer.concat([dashedLine(), LF]);
  // Un texto largo se parte en varias líneas del ancho del papel (también las palabras sin espacios).
  const lineas = (texto: string, ancho = LINE_WIDTH): Buffer[] =>
    wrapText(texto, ancho)
      .flatMap((l) => l.match(new RegExp(`.{1,${ancho}}`, 'g')) ?? [])
      .map((l) => line(l));

  const items = Array.isArray(data.items) ? data.items : [];
  const pagos = Array.isArray(data.payments) ? data.payments : [];

  parts.push(ESC_INIT);

  // ── Encabezado: solo lo que el negocio tiene cargado ──
  parts.push(ESC_ALIGN_CENTER);
  const negocio = aTexto(data.businessName);
  if (negocio) {
    parts.push(
      ESC_DOUBLE_SIZE,
      ESC_BOLD_ON,
      ...lineas(negocio, LINE_WIDTH / 2),
    );
    parts.push(ESC_NORMAL_SIZE, ESC_BOLD_OFF);
  }
  for (const texto of [data.businessSubtitle, data.address]) {
    if (aTexto(texto)) parts.push(...lineas(aTexto(texto)));
  }
  if (aTexto(data.phone)) parts.push(line(`Tel: ${aTexto(data.phone)}`));
  if (aTexto(data.rif)) parts.push(line(`RIF: ${aTexto(data.rif)}`));
  parts.push(ESC_ALIGN_LEFT, raya());

  // ── Orden: número y fecha en una línea; mesa/zona y cliente solo si vienen ──
  parts.push(
    dos(
      `Orden #${aTexto(data.orderNumber)}`,
      `${aTexto(data.date)} ${aTexto(data.time)}`.trim(),
    ),
  );
  const donde = aTexto(data.table) || aTexto(data.orderType);
  if (donde) parts.push(...lineas(donde));
  if (aTexto(data.customerName)) {
    parts.push(...lineas(`Cliente: ${aTexto(data.customerName)}`));
  }
  if (aTexto(data.customerRif)) {
    parts.push(line(`RIF: ${aTexto(data.customerRif)}`));
  }
  parts.push(raya());

  // ── Productos: "2x Nombre ........ $14.00" ──
  for (const item of items) {
    const precio = dinero(item?.total);
    const prefijo = `${cantidad(item?.quantity)}x `;
    // El nombre completo manda: si no cabe junto al precio, sigue en otra línea.
    const nombre = aTexto(item?.name) || 'Producto';
    const trozos = wrapText(prefijo + nombre, LINE_WIDTH).flatMap(
      (l) => l.match(new RegExp(`.{1,${LINE_WIDTH}}`, 'g')) ?? [],
    );
    const ultima = trozos.pop() ?? prefijo;
    for (const t of trozos) parts.push(line(t));
    if (ultima.length + 1 + precio.length <= LINE_WIDTH) {
      parts.push(dos(ultima, precio));
    } else {
      parts.push(line(ultima), dos('', precio));
    }
  }
  parts.push(raya());

  // ── Totales ──
  parts.push(dos('Subtotal:', dinero(data.subtotal)));
  if (aNumero(data.discount) > 0) {
    parts.push(dos('Descuento:', `-${dinero(data.discount)}`));
  }
  const servicio = lineaCargo(line, data.serviceLabel, data.serviceCharge);
  if (servicio) parts.push(servicio);
  if (aNumero(data.tip) > 0) parts.push(dos('Propina:', dinero(data.tip)));

  // Impuesto sumado: antes del TOTAL. Incluido: como desglose después.
  const incluido = data.taxMode === 'included';
  const etiquetaImpuesto = aTexto(data.taxLabel);
  const lineaImpuesto =
    aNumero(data.tax) > 0 && etiquetaImpuesto
      ? dos(`${etiquetaImpuesto}:`, dinero(data.tax))
      : null;
  if (!incluido && lineaImpuesto) parts.push(lineaImpuesto);

  const moneda = aTexto(data.currency) || 'USD';
  parts.push(ESC_BOLD_ON);
  parts.push(dos('TOTAL:', `${dinero(data.total)} ${moneda}`));
  if (aNumero(data.totalBs) > 0) {
    parts.push(dos('TOTAL Bs:', `Bs ${aNumero(data.totalBs).toFixed(2)}`));
  }
  parts.push(ESC_BOLD_OFF);
  if (incluido && lineaImpuesto) parts.push(lineaImpuesto);

  // ── Pagos (una línea por método) ──
  if (pagos.length > 0) {
    parts.push(raya());
    for (const pago of pagos) {
      parts.push(
        dos(aTexto(pago?.methodLabel) || 'Pago', dinero(pago?.amount)),
      );
    }
  }

  // ── Pago Móvil (solo datos, SIN QR; solo si el pedido los trae) ──
  const pm = data.pagoMovil;
  const datosPm = [
    aTexto(pm?.banco),
    aTexto(pm?.telefono) ? `Tel: ${aTexto(pm?.telefono)}` : '',
    aTexto(pm?.documento) ? `CI: ${aTexto(pm?.documento)}` : '',
  ].filter((l) => l !== '');
  if (datosPm.length > 0) {
    parts.push(raya(), ESC_ALIGN_CENTER, ESC_BOLD_ON);
    parts.push(line('PAGO MOVIL:'), ESC_BOLD_OFF);
    for (const l of datosPm) parts.push(line(l));
    parts.push(ESC_ALIGN_LEFT);
  }

  // ── Pie: mensaje y marca solo si vienen ──
  const pie = [aTexto(data.footerMessage), aTexto(data.footerBrand)].filter(
    (l) => l !== '',
  );
  if (pie.length > 0) {
    parts.push(raya(), ESC_ALIGN_CENTER);
    pie.forEach((l, i) => {
      if (i === 0) parts.push(ESC_BOLD_ON, ...lineas(l), ESC_BOLD_OFF);
      else parts.push(...lineas(l));
    });
    parts.push(ESC_ALIGN_LEFT);
  }

  parts.push(ESC_FEED_LINES(3), ESC_PARTIAL_CUT);
  return Buffer.concat(parts);
}

export function buildPrecuenta(data: PrecuentaRequest): Buffer {
  const parts: Buffer[] = [];

  const text = (s: string) => encodeText(normalizeText(s));
  const line = (s: string) => Buffer.concat([text(s), LF]);

  parts.push(ESC_INIT);
  parts.push(bandaInicio('PRECUENTA'));

  // ── Header ──
  parts.push(ESC_ALIGN_CENTER);
  parts.push(ESC_DOUBLE_SIZE);
  parts.push(ESC_BOLD_ON);
  parts.push(line('PRECUENTA'));
  parts.push(ESC_NORMAL_SIZE);
  parts.push(ESC_BOLD_OFF);
  if (data.businessName) parts.push(line(normalizeText(data.businessName)));
  parts.push(ESC_ALIGN_LEFT);

  parts.push(dashedLine());
  parts.push(LF);

  // ── Info orden ──
  parts.push(line(twoColumnLine('Orden:', `#${data.orderNumber}`)));
  parts.push(line(twoColumnLine('Fecha:', data.date)));
  parts.push(line(twoColumnLine('Hora:', data.time)));
  if (data.table) {
    parts.push(line(twoColumnLine('Mesa:', normalizeText(data.table))));
  }
  if (data.waiter) {
    parts.push(line(twoColumnLine('Mesonero:', normalizeText(data.waiter))));
  }

  parts.push(dashedLine());
  parts.push(LF);

  // ── Items con precios ──
  for (const item of data.items) {
    const itemName = normalizeText(item.name);
    const qtyPrefix = `${item.quantity}x `;
    const priceStr = `$${item.total.toFixed(2)}`;
    const nameMaxLen = LINE_WIDTH - qtyPrefix.length - priceStr.length - 1;
    const truncName =
      itemName.length > nameMaxLen
        ? itemName.substring(0, nameMaxLen)
        : itemName;
    const fullLeft = qtyPrefix + truncName;
    parts.push(line(twoColumnLine(fullLeft, priceStr)));

    if (item.quantity > 1) {
      parts.push(line(`   @ $${item.unitPrice.toFixed(2)} c/u`));
    }
  }

  parts.push(dashedLine());
  parts.push(LF);

  // ── Totales ──
  parts.push(line(twoColumnLine('Subtotal:', `$${data.subtotal.toFixed(2)}`)));

  if (data.discount && data.discount > 0) {
    parts.push(
      line(twoColumnLine('Descuento:', `-$${data.discount.toFixed(2)}`)),
    );
  }
  const servicio = lineaCargo(line, data.serviceLabel, data.serviceCharge);
  if (servicio) parts.push(servicio);

  parts.push(dashedLine());
  parts.push(LF);

  const currency = data.currency || 'USD';
  parts.push(ESC_BOLD_ON);
  parts.push(
    line(twoColumnLine('TOTAL:', `$${data.total.toFixed(2)} ${currency}`)),
  );

  if (data.totalBs && data.totalBs > 0) {
    parts.push(
      line(twoColumnLine('TOTAL Bs:', `Bs ${data.totalBs.toFixed(2)}`)),
    );
  }
  parts.push(ESC_BOLD_OFF);

  if (data.bcvRate && data.bcvRate > 0) {
    parts.push(
      line(twoColumnLine('Tasa BCV:', `Bs ${data.bcvRate.toFixed(2)}`)),
    );
  }

  parts.push(dashedLine());
  parts.push(LF);

  // ── Footer ──
  parts.push(ESC_ALIGN_CENTER);
  parts.push(ESC_BOLD_ON);
  parts.push(line('*** NO ES FACTURA ***'));
  parts.push(ESC_BOLD_OFF);
  parts.push(line(centerText(`${data.date}  ${data.time}`)));
  parts.push(ESC_ALIGN_LEFT);

  parts.push(ESC_FEED_LINES(3));
  parts.push(bandaFin('PRECUENTA'));
  parts.push(ESC_PARTIAL_CUT);

  return Buffer.concat(parts);
}

// ── Ticket de ronda para pack products (tobos, cajas) ──
export function buildRondaTicket(data: RondaRequest): Buffer {
  const parts: Buffer[] = [];
  const text = (s: string) => encodeText(normalizeText(s));
  const line = (s: string) => Buffer.concat([text(s), LF]);

  parts.push(ESC_INIT);
  parts.push(bandaInicio('RONDA'));
  parts.push(ESC_ALIGN_CENTER);

  if (data.businessName) {
    parts.push(ESC_BOLD_ON);
    parts.push(line(normalizeText(data.businessName)));
    parts.push(ESC_BOLD_OFF);
  }

  parts.push(ESC_DOUBLE_SIZE);
  parts.push(ESC_BOLD_ON);
  parts.push(line(`RONDA #${data.rondaNum}`));
  parts.push(ESC_NORMAL_SIZE);
  parts.push(ESC_BOLD_OFF);

  parts.push(dashedLine());
  parts.push(ESC_ALIGN_LEFT);

  const mesa = data.tableName ?? 'Sin mesa';
  parts.push(line(twoColumnLine('Mesa:', mesa)));
  parts.push(line(twoColumnLine('Producto:', data.productName)));

  if (data.bartenderName) {
    parts.push(line(twoColumnLine('Bartender:', data.bartenderName)));
  }

  parts.push(dashedLine());

  parts.push(ESC_BOLD_ON);
  parts.push(
    line(twoColumnLine('Esta ronda:', `${data.unitsThisRound} cerv.`)),
  );
  parts.push(ESC_BOLD_OFF);

  parts.push(
    line(
      twoColumnLine(
        'Entregadas:',
        `${data.totalDelivered} / ${data.totalUnits}`,
      ),
    ),
  );

  const pending = data.totalUnits - data.totalDelivered;
  parts.push(
    line(twoColumnLine('Pendientes:', `${pending} / ${data.totalUnits}`)),
  );

  parts.push(dashedLine());
  parts.push(ESC_ALIGN_CENTER);
  parts.push(line(centerText(`Orden #${data.orderNumber}  ${data.time}`)));

  parts.push(ESC_FEED_LINES(3));
  parts.push(bandaFin('RONDA'));
  parts.push(ESC_PARTIAL_CUT);

  return Buffer.concat(parts);
}

// Cada estacion con control estricto recibe SU ficha, con su propio QR y solo
// sus items. El titulo y el pie tienen que nombrar la estacion correcta: una
// ficha de cocina que diga "presente este QR en la barra" manda al cliente al
// lugar equivocado. Los textos son genericos: el nombre del negocio viene en
// el pedido (businessName), no aqui.
const ETIQUETA_ESTACION: Record<string, { titulo: string; donde: string }> = {
  BAR: { titulo: 'FICHA DE BARRA', donde: 'Presente este QR en la barra' },
  KITCHEN: { titulo: 'FICHA DE COCINA', donde: 'Presente este QR en cocina' },
  PIZZA: { titulo: 'FICHA DE PIZZA', donde: 'Presente este QR en pizza' },
};

export function buildFicha(data: FichaRequest): Buffer {
  const parts: Buffer[] = [];
  const text = (s: string) => encodeText(normalizeText(s));
  const line = (s: string) => Buffer.concat([text(s), LF]);

  // Sin station explicita se asume barra, que es como funcionaba antes.
  const etiqueta =
    ETIQUETA_ESTACION[String(data.station ?? 'BAR').toUpperCase()] ??
    ETIQUETA_ESTACION.BAR;

  parts.push(ESC_INIT);
  parts.push(bandaInicio('FICHA'));
  parts.push(ESC_ALIGN_CENTER);

  if (data.businessName) {
    parts.push(ESC_BOLD_ON);
    parts.push(line(normalizeText(data.businessName)));
    parts.push(ESC_BOLD_OFF);
  }
  parts.push(line(etiqueta.titulo));
  parts.push(dashedLine());

  parts.push(ESC_ALIGN_LEFT);
  parts.push(line(twoColumnLine('Orden:', `#${data.orderNumber}`)));
  if (data.table) parts.push(line(twoColumnLine('Mesa:', data.table)));
  if (data.waiter) parts.push(line(twoColumnLine('Mesonero:', data.waiter)));
  parts.push(line(twoColumnLine('Hora:', data.time)));

  parts.push(dashedLine());
  parts.push(ESC_BOLD_ON);
  parts.push(line('TE QUEDA PENDIENTE:'));
  parts.push(ESC_BOLD_OFF);
  for (const it of data.items) {
    parts.push(line(twoColumnLine(it.productName, String(it.pendingQty))));
    // Tobos mixtos: desglose por variante debajo del nombre del tobo.
    if (it.variants && it.variants.length) {
      for (const v of it.variants) {
        parts.push(line(twoColumnLine(`  ${v.name}`, String(v.pendingQty))));
      }
    }
  }
  parts.push(dashedLine());
  parts.push(ESC_BOLD_ON);
  parts.push(
    line(twoColumnLine('Total pendiente:', String(data.totalPending))),
  );
  parts.push(ESC_BOLD_OFF);

  // QR grande con el token de la ficha (llena el ancho del papel)
  parts.push(generateQrCode(data.qrData));

  parts.push(ESC_ALIGN_CENTER);
  parts.push(line(etiqueta.donde));
  parts.push(line('Entrega total o parcial'));

  parts.push(ESC_FEED_LINES(3));
  parts.push(bandaFin('FICHA'));
  parts.push(ESC_PARTIAL_CUT);

  return Buffer.concat(parts);
}

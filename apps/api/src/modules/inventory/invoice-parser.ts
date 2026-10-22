/**
 * Parser de facturas para extracción de líneas de compra.
 * Funciones puras: sin dependencias de tesseract ni NestJS.
 */

export interface InvoiceLine {
  text: string;
  qty: number | null;
  unitCost: number | null;
  /**
   * Unidades que trae el bulto, leidas de la propia descripcion
   * ("222Mlx36UN" -> 36). Permite expandir 15 cajas a 540 botellas sin
   * configurar nada por producto. null si la linea no lo declara.
   */
  unitsPerPack: number | null;
  /**
   * En que se facturo: CAJA, BULTO o UNIDAD, leido de la columna que sigue a
   * la cantidad. Es lo que autoriza a expandir por el contenido.
   */
  invoiceUnit: UnidadFactura | null;
  /** "KG" escrito en la columna de unidad: la cantidad son kilos. */
  measureUnit?: 'kg' | null;
}

/** De donde salio el match: de un alias aprendido o del parecido con el catalogo. */
export type MatchSource = 'alias' | 'catalogo';

export interface MatchedLine extends InvoiceLine {
  matchedProductId: string | null;
  matchedProductName: string | null;
  score: number;
  source: MatchSource | null;
}

/**
 * Como escribe ESTE proveedor un producto nuestro. Se aprende cuando alguien
 * mapea el renglon a mano en la app: la proxima factura ya lo reconoce.
 */
export interface SupplierAlias {
  aliasKey: string;
  productId: string;
  productName: string;
  unitsPerPack?: number | null;
}

interface ProductRef {
  id: string;
  name: string;
}

/**
 * Convierte "42,44" (coma decimal) o "1.234,56" (formato latino)
 * a number. Retorna null si falla.
 */
export function parseNumber(s: string): number | null {
  if (!s) return null;
  let clean = s.trim();

  // Aqui la coma es DECIMAL salvo que haya prueba de lo contrario, que es como
  // se escribe en Venezuela. Las dos pruebas posibles:
  //   - un punto despues de la coma -> formato anglo ("1,234.56")
  //   - mas de una coma -> separador de miles ("1,234,567")
  // Antes se exigian 1 o 2 decimales, y "0,250 Kg" de semillas de hinojo se
  // leia como 250 kilos: 30.000 veces la compra real.
  const comas = (clean.match(/,/g) ?? []).length;
  const puntoTrasComa = /,[^.]*\./.test(clean);
  if (comas === 1 && !puntoTrasComa) {
    // Formato latino: quitar puntos (miles), cambiar coma por punto
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato anglo o solo dígitos: quitar comas
    clean = clean.replace(/,/g, '');
  }

  const n = parseFloat(clean);
  return isFinite(n) ? n : null;
}

/**
 * Lee cuantas unidades trae el bulto a partir de la descripcion del renglon.
 *
 * Los proveedores lo declaran pegado a la presentacion, y siempre con el mismo
 * patron: un numero (el tamaño), la unidad, una "x" y el contenido.
 *   "222Mlx36UN" -> 36      "1KGX20UND" -> 20      "LAT355X24" -> 24
 *   "1.5LX6UN"   -> 6       "3.6KGx4UN" -> 4       "500Mlx12UN" -> 12
 *
 * Se exige que haya un digito ANTES de la x dentro del mismo bloque: asi
 * "15 C 23,01" (cantidad y precio) nunca se confunde con un contenido, porque
 * ahi la x no existe. Se toma la primera coincidencia porque la presentacion
 * va en la descripcion, que precede a las columnas de cantidad y precio.
 */
export function extractUnitsPerPack(text: string): number | null {
  if (!text) return null;
  // Al reves, con la cantidad primero: "12X900ML", "15X1LT", "24X170gr". Si
  // despues de la x viene una medida, lo que cuenta es el numero de antes.
  const alReves = text.match(
    /(?:^|[^\d.,])(\d{1,3})\s*[xX]\s*\d+(?:[.,]\d+)?\s*(?:ML|GR?|KGS?|LTS?|L|CC|OZ)\b/i,
  );
  if (alReves) {
    const n = parseInt(alReves[1], 10);
    if (n > 1) return n;
  }
  const m = text.match(/\d[^\sxX]*\s*[xX]\s*(\d{1,4})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * En que unidad se facturo el renglon, segun la columna que sigue a la
 * cantidad: "15 C" son 15 CAJAS, "1 B" un BULTO, "2 U" dos unidades sueltas.
 *
 * Es la evidencia que decide si hay que expandir por el contenido. Sin ella
 * habria que adivinar: en la misma factura conviven "15 C" de cerveza (que si
 * son 15x36 botellas) y "2 U" de mayonesa (que son 2 envases, no 2x4).
 */
export type UnidadFactura = 'CAJA' | 'BULTO' | 'UNIDAD';

const LETRA_A_UNIDAD: Record<string, UnidadFactura> = {
  C: 'CAJA',
  B: 'BULTO',
  U: 'UNIDAD',
};

/**
 * La columna "Cant" del renglon: el numero con su letra de unidad ("2 C").
 *
 * Se busca la PRIMERA pareja numero+letra de todo el renglon, no solo detras
 * de la primera cifra: el nombre del producto suele traer medidas sueltas
 * ("OFERTA 7UP ... 1.5 LTRS X 06UND 2 C 4.25") y quedarse en la primera cifra
 * hacia cobrar 1,5 cajas de refresco en vez de 2. Exigir UNA sola letra evita
 * confundirla con palabras de la descripcion ("CFH", "C/G").
 */
function columnaCantidad(
  text: string,
): { qty: number; unidad: UnidadFactura } | null {
  const tokens = text.trim().split(/\s+/);
  const esNumero = (t: string) => /^\d+([.,]\d+)?$/.test(t);
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!esNumero(tokens[i])) continue;
    const siguiente = tokens[i + 1].toUpperCase();
    const unidad =
      siguiente.length === 1 ? LETRA_A_UNIDAD[siguiente] : undefined;
    if (unidad) return { qty: parseFloat(tokens[i].replace(',', '.')), unidad };
  }
  return null;
}

export function extractInvoiceUnit(text: string): UnidadFactura | null {
  if (!text) return null;
  return columnaCantidad(text)?.unidad ?? null;
}

/**
 * Extrae números de una línea. Devuelve números parseados en orden.
 * Soporta coma decimal venezolana (42,44) y puntos de miles (1.234,56).
 * Solo extrae números que NO estén pegados a letras (para evitar "45" de "45KG").
 */
function extractNumbers(line: string): number[] {
  // Dividir por espacios y filtrar tokens que sean numéricos.
  // Esto evita capturar números pegados a letras como "45KG".
  const tokens = line.split(/\s+/);
  const numbers: number[] = [];

  for (const token of tokens) {
    // 8 o mas cifras seguidas, sin separadores, es un RIF, un telefono o una
    // cedula: nunca una cantidad ni un precio. En la nota de Coca-Cola el RIF
    // con el telefono ("508222202 1650") salia como 508.222.202 unidades.
    if (/^\d{8,}$/.test(token)) continue;
    // Procesar tokens que contienen números
    // Buscar patrones de números con decimales/separadores
    const pattern =
      /^\d{1,3}(?:[\.,]\d{3})*(?:[.,]\d{1,2})?$|^\d+\.?\d*$|^\d+,\d+$/;
    if (pattern.test(token)) {
      const n = parseNumber(token);
      if (n !== null) {
        numbers.push(n);
      }
    }
  }

  return numbers;
}

/**
 * Comprueba si una línea debe ser descartada.
 * Descarta headers, totales y líneas sin alfabético.
 */
function shouldDiscardLine(normalizedLine: string): boolean {
  const headerPatterns = [
    /^FACTURA/i,
    /^TOTAL/i,
    /^SUBTOTAL/i,
    /^IVA/i,
    /^FECHA/i,
    /^RIF/i,
    /^FACTURA/i,
    /^NRO FACTURA/i,
    /^COMPROBANTE/i,
    // Pie de la nota de entrega de Polar: "Peso Neto: 5 Kg Cant. 27" tiene dos
    // numeros y pasaba por renglon fantasma.
    /^PESO NETO/i,
    /^SUB-TOTAL/i,
    /^BASE IMPONIBLE/i,
    /^EXC?ENTO/i,
    /^DEUDA/i,
  ];

  for (const pattern of headerPatterns) {
    if (pattern.test(normalizedLine)) {
      return true;
    }
  }

  // Los totales no siempre abren la linea: el OCR les pega basura delante
  // ("7 Total ARTICULOS", "LU Be 39.804,26 IVA: ... TOTAL: BS").
  if (/\bTOTAL\b|\bIVA\b|\bSUBTTL\b|BASE IMPONIBLE/.test(normalizedLine))
    return true;

  // La direccion trae numeros ("LOCAL NRO 29 Y 30") y pasaba por un renglon
  // de 29 unidades a 30.
  if (
    /\b(LOCAL|NRO|SECTOR|CALLE|AV|AVENIDA|EDIF|PISO|ZONA POSTAL|URB|TELF?|DIRECCI[OÓ]N)\b/.test(
      normalizedLine,
    )
  )
    return true;

  return false;
}

/**
 * Comprueba si una línea es candidata a ser un item de factura.
 * Criterios:
 *   - Tiene >= 1 palabra alfabética con 3+ letras
 *   - Tiene >= 2 números
 */
function isCandidate(line: string): boolean {
  const numbers = extractNumbers(line);
  if (numbers.length < 2) return false;

  // Al menos 1 palabra con 3+ letras
  const hasAlpha = /\b[a-záéíóúñü]{3,}/i.test(line);
  return hasAlpha;
}

/**
 * Parsea una línea para extraer qty, unitCost y el subtotal.
 * Heurística:
 *   - Si hay 3+ números: primero=qty, penúltimo=unitCost, último=subtotal
 *   - Si hay 2 números: primero=qty, segundo=unitCost
 */
function parseLineNumbers(line: string): {
  qty: number | null;
  unitCost: number | null;
} {
  const numbers = extractNumbers(line);

  if (numbers.length === 0) {
    return { qty: null, unitCost: null };
  }

  if (numbers.length === 1) {
    return { qty: null, unitCost: null };
  }

  // Un "A x B" explicito no deja lugar a dudas: A es lo que se llevo y B lo
  // que cuesta cada uno. Asi lo imprimen algunos proveedores.
  const porSigno = line.match(
    /(\d+(?:[.,]\d+)?)\s*[xX]\s*(?:Bs\.?|\$)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/,
  );
  if (porSigno) {
    const a = parseNumber(porSigno[1]);
    const b = parseNumber(porSigno[2]);
    if (a !== null && b !== null && a > 0 && b > 0)
      return { qty: a, unitCost: b };
  }

  // Si el renglon trae la columna "Cant" con su letra ("2 C"), esa ES la
  // cantidad: le gana a cualquier medida del nombre del producto.
  const columna = columnaCantidad(line);
  if (columna) {
    const precio = precioQueCuadra(numbers, columna.qty);
    return {
      qty: columna.qty,
      unitCost: precio ?? numbers[numbers.length - 2],
    };
  }

  // Sin columna ni "x", la aritmetica desempata: el par cuyo producto da otro
  // numero del renglon es la cantidad y el precio. Asi el "101" con que
  // Coca-Cola abre el renglon se queda en lo que es —un codigo— en vez de
  // cargar 101 refrescos a 8,62 ($870) en una factura de $54.
  const cuadrado = parPorAritmetica(numbers);
  if (cuadrado) return cuadrado;

  if (numbers.length === 2) {
    return { qty: numbers[0], unitCost: numbers[1] };
  }

  // 3+ números
  return { qty: numbers[0], unitCost: numbers[numbers.length - 2] };
}

/** Dos importes son "el mismo" si difieren menos de lo que redondea un proveedor. */
const cuadra = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(0.02, Math.abs(b) * 0.015);

/** El precio unitario que, por la cantidad, da alguno de los importes del renglon. */
function precioQueCuadra(numbers: number[], qty: number): number | null {
  if (qty <= 0) return null;
  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      if (numbers[i] > 0 && cuadra(numbers[i] * qty, numbers[j]))
        return numbers[i];
    }
  }
  return null;
}

/**
 * Busca la pareja cantidad x precio = total dentro de los numeros del renglon.
 *
 * Cuando ninguno de los dos es entero no hay como saber cual es cual, asi que
 * no se adivina. Entre varias parejas gana la del total mas a la derecha: el
 * importe del renglon siempre se imprime al final.
 */
function parPorAritmetica(
  numbers: number[],
): { qty: number; unitCost: number } | null {
  let mejor: { qty: number; unitCost: number; k: number } | null = null;
  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      const a = numbers[i];
      const b = numbers[j];
      if (a <= 0 || b <= 0) continue;
      for (let k = j + 1; k < numbers.length; k++) {
        if (!cuadra(a * b, numbers[k])) continue;
        const aEntero = Number.isInteger(a);
        const bEntero = Number.isInteger(b);
        // El entero es la cantidad; el que trae decimales, el precio.
        let qty: number, unitCost: number;
        if (aEntero && !bEntero) {
          qty = a;
          unitCost = b;
        } else if (bEntero && !aEntero) {
          qty = b;
          unitCost = a;
        } else {
          continue; // ambos enteros o ambos decimales: no hay evidencia
        }
        if (!mejor || k > mejor.k) mejor = { qty, unitCost, k };
      }
    }
  }
  return mejor ? { qty: mejor.qty, unitCost: mejor.unitCost } : null;
}

/**
 * Señales de que la foto NO es una factura sino el comprobante de haber
 * pagado: una captura de Pago Movil o el voucher del punto de venta.
 *
 * Importa distinguirlo porque esos papeles no tienen renglones y el parser,
 * suelto, inventaba compras: "Terminal 22 Lote 239 Ticket 7271" tiene tres
 * numeros y palabras largas, o sea cumplia de sobra el criterio de renglon y
 * cargaba 22 "terminales" al inventario.
 */
const SENALES_DE_PAGO = [
  /PAGO\s*M[OÓ]VIL|PAGOM[OÓ]VIL/i,
  /VENTA\s+(DEBITO|D[EÉ]BITO|CREDITO|CR[EÉ]DITO)/i,
  /NO\s+REQUIERE\s+FIRMA/i,
  /N[Oo]\.?\s*AUTOR/i,
  /\bLOTE\b\s*\d/i,
  /\bTERMINAL\b\s*\d/i,
  /MONTO\s+BS/i,
  /^\s*OPERACI[OÓ]N\s*:/im,
  /^\s*DESTINO\s*:/im,
  /^\s*CONCEPTO\s*:/im,
  /MASTERCARD|VISA\b|MAESTRO\b/i,
];

/**
 * Un comprobante de pago se reconoce por acumulacion, no por una sola palabra:
 * "BANESCO" puede salir en el pie de una factura normal. Con dos señales
 * distintas ya no hay duda.
 */
export function esComprobantePago(rawText: string): boolean {
  if (!rawText) return false;
  const encontradas = SENALES_DE_PAGO.filter((r) => r.test(rawText)).length;
  return encontradas >= 2;
}

/**
 * Deja la linea comparable: quita la moneda y separa la "x" que el ticket
 * imprime pegada ("0,5xBs 6.763,64" -> "0,5 x 6.763,64").
 */
function normalizarCantidad(line: string): string {
  return line
    .replace(/(\d)\s*[xX]\s*/g, '$1 x ')
    .replace(/\bBs\.?/gi, ' ')
    .replace(/\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Una linea que trae SOLO la cantidad y el precio, sin nombre de producto.
 *
 * Algunos tickets de proveedores imprimen el renglon
 * en dos lineas: "4 x Bs. 1.100,00" y debajo "BOLSA CELOFAN #10X18 Bs
 * 4.400,00". Por separado ninguna de las dos es un renglon: la de arriba no
 * tiene nombre y la de abajo no tiene cantidad.
 */
function esLineaDeCantidad(line: string): boolean {
  const limpia = normalizarCantidad(line);
  if (!limpia) return false;
  const tokens = limpia.split(' ');
  let numeros = 0;
  for (const t of tokens) {
    if (t === 'x' || t === 'X') continue;
    if (/^\d+([.,]\d+)*$/.test(t)) {
      numeros++;
      continue;
    }
    return false; // cualquier palabra descarta: entonces si tiene nombre
  }
  return numeros >= 2;
}

/**
 * Un renglon tal como quedo despues de juntar sus pedazos: el nombre por un
 * lado y, cuando venia en otra linea, los numeros por otro.
 */
interface RenglonCrudo {
  /** La linea con el nombre del producto. */
  texto: string;
  /** La linea suelta de cantidad/precio, si el ticket la imprimio aparte. */
  cantidad: string | null;
}

/**
 * Junta cada linea de cantidad con la linea que trae el nombre.
 *
 * Se mira primero la de ABAJO (Karin y el ticket de desechables ponen
 * "4 x Bs. 1.100,00" y debajo el producto) y, si esa no sirve, la de ARRIBA
 * (Tony pone "SEMILLAS DE HINOJO POR KG" y debajo "0,250 x 7.618,59").
 */
function unirRenglonesPartidos(lines: string[]): RenglonCrudo[] {
  const util = (l: string | undefined) =>
    !!l &&
    !shouldDiscardLine(l.trim().toUpperCase()) &&
    !esLineaDeCantidad(l) &&
    /\b[a-záéíóúñü]{3,}/i.test(l);

  const renglones: RenglonCrudo[] = [];
  const usadas = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (usadas.has(i)) continue;
    if (!esLineaDeCantidad(lines[i])) {
      renglones.push({ texto: lines[i], cantidad: null });
      continue;
    }
    if (util(lines[i + 1])) {
      renglones.push({ texto: lines[i + 1], cantidad: lines[i] });
      usadas.add(i + 1);
      continue;
    }
    // Hacia atras: el nombre ya se guardo como renglon suelto, se le agrega.
    const previo = renglones[renglones.length - 1];
    if (previo && !previo.cantidad && util(previo.texto)) {
      previo.cantidad = lines[i];
      continue;
    }
    // Una linea de numeros sin nombre a ningun lado no es una compra.
  }
  return renglones;
}

/**
 * Parsea el texto crudo de OCR y extrae líneas de compra.
 * Devuelve array de InvoiceLine (qty, unitCost, text).
 */
/**
 * Renglon de una nota de entrega SIN precios: "223 COCA-COLA ORIG PET 1LTX6 5".
 *
 * La nota de Coca-Cola (17/09/2026) solo trae codigo, descripcion y cantidad;
 * el dinero va en una sola linea al pie ("TOTAL A PAGAR DOLARES 54,49"). Antes
 * esos renglones se descartaban y el bot decia "no reconoci renglones", aunque
 * los productos y las cantidades estaban ahi. Se devuelven sin costo: el socio
 * lo pone en el bot (con la ultima compra o lo que falta para el total).
 *
 * Solo aplica si el renglon abre con un codigo de 3 a 5 cifras (seis ya es un
 * codigo de cliente, "320103 NOMBRE DEL CLIENTE") y no trae ningun monto con
 * centimos: con precio, manda el camino normal.
 */
function renglonSinPrecio(line: string): InvoiceLine | null {
  const m = line.trim().match(/^(\d{3,5})\.?\s+(.+)$/);
  if (!m) return null;
  const resto = m[2].trim();
  if (/\d[.,]\d{2}\b/.test(resto)) return null;
  if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(resto)) return null;
  if (/\d{7,}/.test(resto)) return null;
  // Una razon social no es un producto: el codigo de cliente de la nota de
  // Coca-Cola ("320103 NOMBRE DEL CLIENTE, C.A.") a veces pierde una cifra en el
  // OCR y entra en el rango de un codigo de producto.
  if (/RESTOBAR|,?\s+C\.\s?A\.?(\s|$)|\bS\.\s?A\.?(\s|$)/i.test(resto))
    return null;
  const cant = resto.match(/\s(\d{1,3})$/);
  const nombre = cant ? resto.slice(0, cant.index).trim() : resto;
  if (!/[a-záéíóúñü]{3,}/i.test(nombre)) return null;
  const qty = cant ? Number(cant[1]) : null;
  // "1LTX6" o "6UN" en la descripcion: lo que se cuenta es el paquete. Sin
  // columna de unidad, esa es la unica evidencia, y cargar 5 botellas cuando
  // llegaron 5 paquetes de 6 descuadra el inventario desde el primer dia.
  const porPaquete =
    extractUnitsPerPack(nombre) ??
    Number(nombre.match(/\b(\d{1,3})\s*UN\b/i)?.[1] ?? 0);
  const unitsPerPack = porPaquete > 1 ? porPaquete : null;
  return {
    text: line.trim(),
    // El OCR a veces separa la cantidad a otra linea: el renglon sale igual,
    // con la cantidad en blanco para que el socio la ponga.
    qty: qty && qty > 0 ? qty : null,
    unitCost: null,
    unitsPerPack,
    invoiceUnit: unitsPerPack ? 'CAJA' : null,
  };
}

const UNIDAD_DE_COLUMNA: Record<
  string,
  { invoiceUnit: UnidadFactura | null; measureUnit: 'kg' | null }
> = {
  CAJ: { invoiceUnit: 'CAJA', measureUnit: null },
  CAJA: { invoiceUnit: 'CAJA', measureUnit: null },
  CA: { invoiceUnit: 'CAJA', measureUnit: null },
  CJ: { invoiceUnit: 'CAJA', measureUnit: null },
  BUL: { invoiceUnit: 'BULTO', measureUnit: null },
  BTO: { invoiceUnit: 'BULTO', measureUnit: null },
  PAQ: { invoiceUnit: 'BULTO', measureUnit: null },
  UND: { invoiceUnit: 'UNIDAD', measureUnit: null },
  UNID: { invoiceUnit: 'UNIDAD', measureUnit: null },
  KG: { invoiceUnit: null, measureUnit: 'kg' },
  KGS: { invoiceUnit: null, measureUnit: 'kg' },
};

/**
 * Renglon con la unidad ESCRITA entre la cantidad y el precio, como el
 * presupuesto de Viveluso:
 *
 *   "A0148 ACEIT SOL Y OLIVA CARBONEL 15X1LT CAJA 0.201 CAJ 146.61 0.00 29.46"
 *   "Q0243 QUESO MOZZARELLA PALMIRA KILO 30.480 KG 10.24 0.00"
 *
 * La cantidad lleva tres decimales (0.201 cajas, 30.480 kilos) y el precio
 * dos. Leido con la regla general, "12X900ML" salia como 12 unidades a 900 y
 * "28.160 KG 12,54 0.00 35214" como 28 kilos a 0 (18/09/2026). La palabra de
 * unidad es la ancla: lo que va antes es la cantidad y lo que sigue, el precio.
 */
/**
 * La cantidad de esa columna, que siempre lleva tres decimales. Cuando el OCR
 * se come el punto queda un entero que no puede ser: "083" (era 0.834 cajas)
 * o "3000" kilos de mortadela (eran 3.000). Se le devuelve el punto.
 */
function cantidadDeColumna(token: string): number {
  if (/^\d+$/.test(token)) {
    if (token.length >= 2 && token.startsWith('0'))
      return parseFloat(`0.${token.slice(1)}`);
    if (token.length >= 4)
      return parseFloat(`${token.slice(0, -3)}.${token.slice(-3)}`);
  }
  return parseFloat(token.replace(',', '.'));
}

function renglonConUnidad(line: string): InvoiceLine | null {
  // La unidad puede traer basura pegada del OCR ("CA)", "UND."). El precio
  // va con dos decimales; si el OCR se comio el punto ("7294" por 72.94,
  // "590" por 5.90) se le devuelve. Sin precio legible el renglon sale igual,
  // con la cantidad y el precio en blanco para que el socio lo escriba.
  const m = line.match(
    /(?:^|\s)(?<![xX]\s)(\d{1,4}(?:[.,]\d{1,3})?)\s+(CAJA|CAJ|CA|CJ|BUL|BTO|PAQ|UNID|UND|KGS|KG)[.)\]]?(?=\s|$)(?:\s+(\d{1,3}(?:,\d{3})+\.\d{2}|\d+[.,]\d{2}(?!\d)|\d{3,5}(?![\d.,])))?/i,
  );
  if (!m || m.index === undefined) return null;
  // Con la columna de una letra ("1 C 23.07", Polar) manda esa: aqui "X 24
  // UND" es lo que trae la caja, no lo que se compro.
  if (columnaCantidad(line)) return null;
  const nombre = line.slice(0, m.index);
  if (!/[a-záéíóúñü]{3,}/i.test(nombre)) return null;
  // "15.000" y "0.201" son cantidades con tres decimales, no miles.
  const qty = cantidadDeColumna(m[1]);
  if (!qty) return null;
  const precio = m[3];
  const unitCost = !precio
    ? null
    : /^\d+$/.test(precio)
      ? Number(precio) / 100
      : parseNumber(precio);
  const unidad = UNIDAD_DE_COLUMNA[m[2].toUpperCase()];
  return {
    text: line.trim(),
    qty,
    unitCost,
    unitsPerPack: extractUnitsPerPack(nombre),
    invoiceUnit: unidad.invoiceUnit,
    measureUnit: unidad.measureUnit,
  };
}

export function parseInvoiceLines(rawText: string): InvoiceLine[] {
  if (!rawText || typeof rawText !== 'string') return [];
  // Un comprobante de pago no tiene renglones; forzarlos es inventar compras.
  if (esComprobantePago(rawText)) return [];

  const lines = rawText.split('\n').filter((l) => l.trim().length > 0);
  const result: InvoiceLine[] = [];

  for (const renglon of unirRenglonesPartidos(lines)) {
    const line = renglon.texto;
    const normalized = line.trim().toUpperCase();

    // Descartar líneas de header/footer/totales
    if (shouldDiscardLine(normalized)) {
      continue;
    }

    if (!renglon.cantidad) {
      const conUnidad = renglonConUnidad(line);
      if (conUnidad) {
        result.push(conUnidad);
        continue;
      }
      const sinPrecio = renglonSinPrecio(line);
      if (sinPrecio) {
        result.push(sinPrecio);
        continue;
      }
    }

    // Con la cantidad en su propia linea, el nombre por si solo no llega a
    // los dos numeros que pide isCandidate: se juzga el renglon completo.
    if (!renglon.cantidad && !isCandidate(line)) {
      continue;
    }
    if (renglon.cantidad && !/\b[a-záéíóúñü]{3,}/i.test(line)) {
      continue;
    }

    // Un codigo de producto abre el renglon ("223 COCA-COLA ... 5"). Si quitandolo
    // no quedan al menos cantidad y precio, el OCR perdio columnas y el
    // renglon no se puede leer: se descarta en vez de cargar 223 refrescos.
    if (!renglon.cantidad) {
      const codigo = line.trim().match(/^(\d{3,})\.?\s+[A-Za-zÁÉÍÓÚÑ]/);
      if (codigo && extractNumbers(line).length - 1 < 2) continue;
    }

    // Parsear números: mandan los de la linea de cantidad cuando existe.
    const { qty, unitCost } = renglon.cantidad
      ? parseLineNumbers(normalizarCantidad(renglon.cantidad))
      : parseLineNumbers(line);

    // Ambos deben ser números válidos
    if (qty === null || unitCost === null) {
      continue;
    }

    result.push({
      text: line.trim(),
      qty,
      unitCost,
      unitsPerPack: extractUnitsPerPack(line),
      invoiceUnit: extractInvoiceUnit(line),
    });
  }

  return result;
}

/**
 * Normaliza un string para matching:
 * - Mayúsculas
 * - Sin acentos
 * - Solo alfanuméricos + espacios
 */
function normalizeForMatching(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Remover diacríticos
    .replace(/[^A-Z0-9\s]/g, '') // Solo alfanuméricos y espacios
    .trim();
}

/**
 * Umbral mínimo de similitud para aceptar un match entre línea y producto.
 * Ejemplo: "QUESO MOZZARELLA KG" vs "Queso Mozzarella Mi Vaquita"
 *   - productTokens: ["QUESO", "MOZZARELLA", "MI", "VAQUITA"] (4 tokens)
 *   - matchedTokens: ["QUESO", "MOZZARELLA"] (2 coinciden)
 *   - score: 2/4 = 0.5 → aceptado (match.score >= MATCH_THRESHOLD)
 */
const MATCH_THRESHOLD = 0.5;

/**
 * Calcula similitud entre línea y nombre del producto.
 * Usa matching por tokens: score = tokens coincidentes / tokens del producto.
 * Retorna score 0-1 y el productId (o null si score < MATCH_THRESHOLD).
 */
/** Letras a cambiar, quitar o agregar para pasar de `a` a `b` (Levenshtein). */
function editDistance(a: string, b: string): number {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      actual[j] = Math.min(
        previa[j] + 1,
        actual[j - 1] + 1,
        previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previa = actual;
  }
  return previa[b.length];
}

/**
 * Cuantas letras le separan una palabra de la otra, o null si no son la misma.
 *
 * - Igual, o una EMPIEZA con la otra (plural "TOMATES", abreviatura "TOM", OCR
 *   que corta "MOZZARELL"): distancia 0. Antes bastaba con que estuviera
 *   CONTENIDA en cualquier parte, y "PAN" daba por encontrado "EMPANIZADOAPANADO":
 *   "HARINA PAN" de Viveluso caia en Empanizado con puntaje perfecto.
 * - Error de tipeo: 1 letra en palabras de 4 a 6, 2 desde 7 ("CEBOYA" -> "CEBOLLA").
 * - Palabras de menos de 3 letras solo iguales: la "C" de la columna "15 C" no
 *   puede dar por encontrada "CERVEZA".
 */
function tokenDistance(a: string, b: string): number | null {
  if (a === b) return 0;
  const corta = Math.min(a.length, b.length);
  if (corta < 3) return null;
  if (a.startsWith(b) || b.startsWith(a)) return 0;
  if (corta < 4) return null;
  const tolerancia = Math.max(a.length, b.length) >= 7 ? 2 : 1;
  const d = editDistance(a, b);
  return d <= tolerancia ? d : null;
}

/**
 * Las MEDIDAS que declara un texto, llevadas todas a mililitros o gramos.
 *
 * En bebidas la medida ES el producto: "PEPSI PET 1.5L" y "Pepsi 2L" son dos
 * renglones distintos del inventario, con distinto costo. Se lee del texto
 * crudo porque al normalizar se pierde el punto decimal (1.5 -> 15).
 */
function medidasDe(text: string): Set<number> {
  const salida = new Set<number>();
  // El contenido va pegado a la presentacion ("1.5LX6UN", "222Mlx36UN"), asi
  // que despues de la unidad se acepta el final, algo que no sea letra, o la
  // "x" del contenido. Con  se perdian justamente esos casos.
  const re =
    /(\d+(?:[.,]\d+)?)\s*(LTRS|LTS|LT|ML|CC|KGS|KG|GRS|GR|L|G)(?:(?![A-Za-z0-9])|(?=[xX]\d))/g;
  let m: RegExpExecArray | null;
  const enMayusculas = text.toUpperCase();
  while ((m = re.exec(enMayusculas)) !== null) {
    const valor = parseFloat(m[1].replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) continue;
    const u = m[2].toUpperCase();
    const factor = u.startsWith('L') ? 1000 : u.startsWith('K') ? 1000 : 1;
    salida.add(Math.round(valor * factor));
  }
  return salida;
}

/**
 * Una palabra: cualquier token con al menos una letra. Los numeros SUELTOS no
 * cuentan.
 *
 * Sin esto, "Pasapalos #2" (dos tokens, uno de ellos "2") empataba el "2" de
 * "PEPSI PET 2LX6UN 2 C" y sacaba 0,50, justo el umbral: una caja de refresco
 * entraba al stock de los pasapalos. Se dejan pasar tokens cortos con letra
 * ("2L", "DE") para no aflojar el umbral de los nombres que ya funcionaban.
 */
const esPalabra = (token: string): boolean => /[A-Z]/.test(token);

function calculateMatchScore(
  lineText: string,
  product: ProductRef,
): {
  score: number;
  /** Letras corregidas entre las palabras que coincidieron: desempata a favor de la exacta. */
  distance: number;
  /** El renglon y el producto declaran la MISMA medida: desempata primero. */
  sameSize: boolean;
  /** Cuantas palabras del producto aparecen en el renglon (evidencia, no proporcion). */
  matchedWords: number;
  productId: string | null;
  productName: string | null;
} {
  const normalizedLine = normalizeForMatching(lineText);
  const normalizedProduct = normalizeForMatching(product.name);
  const vacio = {
    score: 0,
    distance: 0,
    sameSize: false,
    matchedWords: 0,
    productId: null,
    productName: null,
  };

  if (!normalizedLine || !normalizedProduct) return vacio;

  const productTokens = normalizedProduct.split(/\s+/).filter(esPalabra);
  const lineTokens = normalizedLine.split(/\s+/);

  // Un producto sin ninguna palabra real (un nombre que es solo numeros) no se
  // puede emparejar con confianza: mejor dejarlo sin producto.
  if (!productTokens.length) return vacio;

  const medidasLinea = medidasDe(lineText);
  const medidasProducto = medidasDe(product.name);
  const comparables = medidasLinea.size > 0 && medidasProducto.size > 0;
  const sameSize =
    comparables && [...medidasProducto].some((m) => medidasLinea.has(m));
  // Los dos dicen su medida y no coinciden: son productos distintos. Antes,
  // "PEPSI PET 1.5LX6UN" se cargaba como "Pepsi 2L".
  if (comparables && !sameSize) return vacio;

  // Por cada palabra del producto, la palabra de la linea que mas se le parece.
  let matched = 0;
  let distance = 0;
  for (const token of productTokens) {
    const distancias = lineTokens
      .map((lt) => tokenDistance(token, lt))
      .filter((d): d is number => d !== null);
    if (distancias.length) {
      matched++;
      distance += Math.min(...distancias);
    }
  }

  const score = matched / productTokens.length;

  if (score >= MATCH_THRESHOLD) {
    return {
      score,
      distance,
      sameSize,
      matchedWords: matched,
      productId: product.id,
      productName: product.name,
    };
  }

  return {
    score,
    distance,
    sameSize,
    matchedWords: matched,
    productId: null,
    productName: null,
  };
}

/**
 * Hace matching de líneas de factura contra productos disponibles.
 * Para cada línea, busca el mejor match (score >= MATCH_THRESHOLD).
 * En caso de empate, prefiere el nombre más largo.
 */
/**
 * Umbral para aceptar un alias. Mas exigente que el del catalogo (0.5) porque
 * un alias es la redaccion EXACTA del proveedor: si no coincide casi entera,
 * es otro renglon y hay que mapearlo a mano en vez de adivinar mal.
 */
const ALIAS_THRESHOLD = 0.8;

/**
 * Reduce un renglon de factura a su parte estable: las palabras del producto.
 *
 * Fuera quedan las columnas (cantidad, precio, subtotal) y la presentacion
 * ("222Mlx36UN"), porque son justo lo que cambia entre una foto y otra — y de
 * una factura a la siguiente. Asi el mismo producto produce SIEMPRE la misma
 * clave, la lea el OCR completo o a medias:
 *
 *   "SOLERA LIGHT RET 222Mlx36UN 15 C 23,01 345,22" -> "SOLERA LIGHT RET"
 *   "SOLERA LIGHT RET 15 C 23,01 345,22"            -> "SOLERA LIGHT RET"
 */
export function buildAliasKey(text: string): string {
  return normalizeForMatching(text)
    .split(/\s+/)
    .filter(
      (t) =>
        t.length > 1 && // descarta la "C"/"U" de la columna de unidad
        !/^\d+$/.test(t) && // descarta cantidad, precio y subtotal
        !/\d[^\sxX]*[xX]\d/.test(t), // descarta la presentacion "222MLX36UN"
    )
    .join(' ')
    .trim();
}

/**
 * El codigo del producto con que el proveedor abre el renglon: "223" en
 * "223 COCA-COLA ORIG PET 1LTX6 5". De 3 a 5 cifras pegadas a la descripcion.
 */
export function codigoDeRenglon(text: string): string | null {
  const limpio = (text ?? '').trim().replace(/^[(\[]/, '');
  const m = limpio.match(/^(\d{3,5})\.?\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]/);
  if (m) return m[1];
  // Letra + 4 cifras (Viveluso: "A0148", "Q0243"). El OCR confunde el 0 con
  // la O ("HO124"): en la parte numerica se corrige para que la clave no cambie.
  const alfa = limpio.match(/^([A-Z])([0-9O]{4})(?:-[A-Z])?['_.]?\s/i);
  return alfa
    ? `${alfa[1].toUpperCase()}${alfa[2].toUpperCase().replace(/O/g, '0')}`
    : null;
}

/**
 * La clave con que se recuerda un renglon. Si el proveedor lo identifica con un
 * codigo, manda el codigo: la descripcion la lee distinta el OCR en cada foto
 * ("350CC" salio "3500C", "6UN" salio "SUN" en la nota de Coca-Cola), el codigo
 * no. Sin codigo, las palabras estables del producto.
 */
export function claveDeAlias(text: string): string {
  const codigo = codigoDeRenglon(text);
  return codigo ? `#${codigo}` : buildAliasKey(text);
}

/**
 * Busca el alias del proveedor que mejor describe esta linea.
 * Primero exacto sobre la clave estable; si el OCR comio alguna letra, cae al
 * mismo scoring por tokens que usa el catalogo.
 */
function findAliasMatch(
  lineText: string,
  aliases: SupplierAlias[],
): SupplierAlias | null {
  const codigo = codigoDeRenglon(lineText);
  if (codigo) {
    const porCodigo = aliases.find((a) => a.aliasKey === `#${codigo}`);
    if (porCodigo) return porCodigo;
  }

  const key = buildAliasKey(lineText);
  if (!key) return null;

  const exacto = aliases.find((a) => a.aliasKey === key);
  if (exacto) return exacto;

  let best: SupplierAlias | null = null;
  let bestScore = 0;

  for (const alias of aliases) {
    // Un codigo solo vale por igualdad: "#223" no se parece a nada.
    if (alias.aliasKey.startsWith('#')) continue;
    const { score } = calculateMatchScore(key, {
      id: alias.productId,
      name: alias.aliasKey,
    });
    if (score >= ALIAS_THRESHOLD && score > bestScore) {
      best = alias;
      bestScore = score;
    }
  }

  return best;
}

export function matchLinesToProducts(
  lines: InvoiceLine[],
  products: ProductRef[],
  aliases: SupplierAlias[] = [],
): MatchedLine[] {
  const result: MatchedLine[] = [];

  for (const line of lines) {
    // El alias manda: es lo que un humano ya confirmo para este proveedor,
    // y le gana a cualquier parecido casual con el catalogo.
    const alias = findAliasMatch(line.text, aliases);
    if (alias) {
      result.push({
        ...line,
        unitsPerPack: line.unitsPerPack ?? alias.unitsPerPack ?? null,
        matchedProductId: alias.productId,
        matchedProductName: alias.productName,
        score: 1,
        source: 'alias',
      });
      continue;
    }

    let bestMatch: {
      score: number;
      distance: number;
      sameSize: boolean;
      matchedWords: number;
      productId: string | null;
      productName: string | null;
    } = {
      score: 0,
      distance: 0,
      sameSize: false,
      matchedWords: 0,
      productId: null,
      productName: null,
    };
    let bestNameLength = 0;

    for (const product of products) {
      const match = calculateMatchScore(line.text, product);
      if (match.productId === null) continue;

      // 1) La MEDIDA manda: para un renglon de 1,5 L gana "7UP 1.5 LTS" y no
      //    "goldons", que solo se parece por una palabra suelta.
      // 2) Luego CUANTAS palabras del producto aparecen: "Lipton Limon 500ml"
      //    aporta dos ("LIPTON" y "LIMON") y le gana a "Limon", que aporta una
      //    sola pero con proporcion perfecta — el limon de la cocina no es un te.
      // 3) Luego la proporcion, las letras corregidas ("CEBOLLA" elige Cebolla
      //    antes que Cebollin) y por ultimo el nombre mas largo.
      const mejorPor = (
        campo: 'sameSize' | 'matchedWords' | 'score',
      ): number => {
        const a = campo === 'sameSize' ? Number(match.sameSize) : match[campo];
        const b =
          campo === 'sameSize' ? Number(bestMatch.sameSize) : bestMatch[campo];
        return a === b ? 0 : a > b ? 1 : -1;
      };
      const empata =
        mejorPor('sameSize') === 0 &&
        mejorPor('matchedWords') === 0 &&
        mejorPor('score') === 0;
      if (
        mejorPor('sameSize') > 0 ||
        (mejorPor('sameSize') === 0 && mejorPor('matchedWords') > 0) ||
        (mejorPor('sameSize') === 0 &&
          mejorPor('matchedWords') === 0 &&
          mejorPor('score') > 0) ||
        (empata && match.distance < bestMatch.distance) ||
        (empata &&
          match.distance === bestMatch.distance &&
          product.name.length > bestNameLength)
      ) {
        bestMatch = match;
        bestNameLength = product.name.length;
      }
    }

    result.push({
      ...line,
      matchedProductId: bestMatch.productId,
      matchedProductName: bestMatch.productName,
      score: bestMatch.score,
      source: bestMatch.productId ? 'catalogo' : null,
    });
  }

  return result;
}

/**
 * Productos del catalogo mas parecidos a un nombre escrito a mano, del mejor al
 * peor. Usa el MISMO scoring por tokens que los renglones de la factura, asi
 * "Tomates cesta" llega a "Tomate" (10/09/2026: el bot buscaba por substring y
 * dejaba al socio trabado con un producto que SI existia).
 *
 * En empate gana el nombre mas largo, igual que en `matchLinesToProducts`: para
 * "salsa de tomate", "Salsa de Tomate" describe mejor que "Tomate".
 */
export function rankProductsByName(
  query: string,
  products: ProductRef[],
  limit = 6,
): Array<{ id: string; name: string; score: number }> {
  return products
    .map((product) => ({ product, match: calculateMatchScore(query, product) }))
    .filter((x) => x.match.productId !== null)
    .sort(
      (a, b) =>
        b.match.score - a.match.score ||
        a.match.distance - b.match.distance ||
        b.product.name.length - a.product.name.length,
    )
    .slice(0, limit)
    .map((x) => ({
      id: x.product.id,
      name: x.product.name,
      score: x.match.score,
    }));
}

// ESC/POS command constants for POS-58 thermal printer (58mm, 32 chars/line)
export const LINE_WIDTH = 32;

// Printer initialization
// ESC @ (reset) + ESC t 0: fija la tabla de caracteres en la pagina 0 (CP437).
// Nunca se mandaba, asi que un byte alto se dibujaba con la tabla que cada
// POS-58 traiga de fabrica - y las tres de la casa no tienen por que coincidir.
// Con `normalizeText` ya no deberian salir bytes altos; esto es el respaldo.
export const ESC_INIT = Buffer.concat([
  Buffer.from([0x1b, 0x40]),
  Buffer.from([0x1b, 0x74, 0x00]),
]);

// Text formatting
export const ESC_BOLD_ON = Buffer.from([0x1b, 0x45, 0x01]);
export const ESC_BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00]);

// Text alignment
export const ESC_ALIGN_LEFT = Buffer.from([0x1b, 0x61, 0x00]);
export const ESC_ALIGN_CENTER = Buffer.from([0x1b, 0x61, 0x01]);
export const ESC_ALIGN_RIGHT = Buffer.from([0x1b, 0x61, 0x02]);

// Text size
export const ESC_DOUBLE_WIDTH = Buffer.from([0x1d, 0x21, 0x10]); // Double width
export const ESC_DOUBLE_HEIGHT = Buffer.from([0x1d, 0x21, 0x01]); // Double height
export const ESC_DOUBLE_SIZE = Buffer.from([0x1d, 0x21, 0x11]); // Double width + height
export const ESC_NORMAL_SIZE = Buffer.from([0x1d, 0x21, 0x00]); // Normal size

// Line feed and cut
// Blanco sobre negro (GS B n). Es lo unico que hace que una cabecera no se
// confunda con la de al lado cuando dos estaciones comparten el rollo.
export const ESC_INVERSE_ON = Buffer.from([0x1d, 0x42, 0x01]);
export const ESC_INVERSE_OFF = Buffer.from([0x1d, 0x42, 0x00]);

export const LF = Buffer.from([0x0a]); // Line feed
export const ESC_FEED_LINES = (n: number) => Buffer.from([0x1b, 0x64, n]); // Feed n lines
export const ESC_CUT = Buffer.from([0x1d, 0x56, 0x00]); // Full cut
export const ESC_PARTIAL_CUT = Buffer.from([0x1d, 0x56, 0x01]); // Partial cut

// QR Code commands (GS ( k)
export const qrCodeCommands = {
  // Set QR model (Model 2)
  setModel: Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),

  // Set QR size (module size 4)
  setSize: (size: number) =>
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]),

  // Set error correction level (L=48, M=49, Q=50, H=51)
  setErrorCorrection: (level: number) =>
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, level]),

  // Store QR data - requires calculating data length
  storeData: (data: string): Buffer => {
    const dataBytes = Buffer.from(data, 'utf-8');
    const storeLen = dataBytes.length + 3;
    const pL = storeLen & 0xff;
    const pH = (storeLen >> 8) & 0xff;
    return Buffer.concat([
      Buffer.from([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
      dataBytes,
    ]);
  },

  // Print stored QR
  print: Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
};

/**
 * Codifica texto para la POS-58.
 *
 * TODO lo que se imprime pasa por `normalizeText` aqui, y no donde cada quien
 * se acuerde de llamarlo: la hora que manda la web (`toLocaleTimeString('es-VE')`)
 * trae U+202F y U+00A0, y en latin1 el primero se volvia el byte 0x2F ("/") y
 * el segundo el 0xA0, que la impresora dibuja como "a" con acento. En el papel
 * se leia `7:15/p.a m.` - dos veces por comanda y dos por precuenta, el 41 % de
 * los tickets desde abril.
 */
export function encodeText(text: string): Buffer {
  return Buffer.from(normalizeText(text), 'latin1');
}

// Helper to create a dashed separator line
export function dashedLine(): Buffer {
  return encodeText('-'.repeat(LINE_WIDTH));
}

// Separador grueso: marca donde EMPIEZA y donde TERMINA un ticket. Con cocina y
// pizza saliendo por el mismo rollo, la linea de guiones no alcanzaba para ver
// donde cortaba una comanda y empezaba la otra.
export function solidLine(): Buffer {
  return encodeText('='.repeat(LINE_WIDTH));
}

/**
 * Ajusta un texto a varias lineas de LINE_WIDTH sin partir palabras. Las notas
 * se truncaban a 32 caracteres: "sin cebolla, termino medio" se cortaba a la
 * mitad y la cocina cocinaba otra cosa.
 */
export function wrapText(text: string, width: number = LINE_WIDTH): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    // Una palabra sola mas larga que el ancho: se parte, no hay alternativa.
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.substring(i, i + width));
      }
      continue;
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= width) current += ' ' + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Helper to pad/format a two-column line (left-aligned label, right-aligned value)
export function twoColumnLine(left: string, right: string): string {
  const maxLeft = LINE_WIDTH - right.length - 1;
  const truncLeft = left.length > maxLeft ? left.substring(0, maxLeft) : left;
  const padding = LINE_WIDTH - truncLeft.length - right.length;
  return truncLeft + ' '.repeat(Math.max(1, padding)) + right;
}

/** Centra rellenando con espacios a AMBOS lados: en modo inverso el relleno
 *  tambien sale negro, asi la banda ocupa la linea completa. */
export function padCenter(text: string, width: number = LINE_WIDTH): string {
  if (text.length >= width) return text.substring(0, width);
  const total = width - text.length;
  const left = Math.floor(total / 2);
  return ' '.repeat(left) + text + ' '.repeat(total - left);
}

/** Rellena a la derecha hasta el ancho dado (banda inversa de ancho completo). */
export function padRight(text: string, width: number = LINE_WIDTH): string {
  if (text.length >= width) return text.substring(0, width);
  return text + ' '.repeat(width - text.length);
}

// Helper to center text within LINE_WIDTH
export function centerText(text: string): string {
  if (text.length >= LINE_WIDTH) return text.substring(0, LINE_WIDTH);
  const pad = Math.floor((LINE_WIDTH - text.length) / 2);
  return ' '.repeat(pad) + text;
}

/**
 * Deja el texto en ASCII imprimible, que es lo unico que la POS-58 dibuja
 * igual a como se ve en pantalla.
 *
 * La lista de reemplazos uno por uno cubria 14 caracteres y se quedaba corta
 * con todo lo que mete un `toLocaleString` o un copiar-pegar. Ahora el acento
 * se quita por descomposicion Unicode (sirve para cualquier letra, no solo las
 * del castellano), hay una tabla para lo que la descomposicion no resuelve, y
 * al final una RED: lo que siga fuera del ASCII imprimible se cambia por "?"
 * en vez de viajar como byte alto para que la impresora lo dibuje con otra
 * tabla.
 *
 * En este archivo no se escribe ni un caracter fuera del ASCII a proposito:
 * U+2028 y U+2029 son fin de linea para JavaScript y rompen el fuente.
 */

/** Espacios que no son el espacio ASCII: se ven igual y no se imprimen igual. */
const ESPACIOS_RAROS = new Set([
  0x00a0, // NBSP - lo mete toLocaleTimeString('es-VE') entre "p." y "m."
  0x202f, // espacio fino sin corte - entre la hora y "p. m."
  0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
  0x2008, 0x2009, 0x200a, 0x200b, 0x205f, 0x3000, 0xfeff,
  0x2028, 0x2029, // separadores de linea de Unicode
]);

/** Lo que la descomposicion Unicode no resuelve, por punto de codigo. */
const ESPECIALES: Record<number, string> = {
  0x00a1: '!', // signo de admiracion invertido
  0x00bf: '?', // signo de interrogacion invertido
  0x00b0: ' grados',
  0x00ba: 'o', // ordinal masculino
  0x00aa: 'a', // ordinal femenino
  0x00b7: '.', // punto medio
  0x00b1: '+/-',
  0x00bd: '1/2',
  0x00bc: '1/4',
  0x00be: '3/4',
  0x00df: 'ss', // beta alemana
  0x20ac: 'EUR',
  0x2018: "'",
  0x2019: "'",
  0x201a: "'",
  0x201b: "'",
  0x201c: '"',
  0x201d: '"',
  0x201e: '"',
  0x2013: '-',
  0x2014: '-',
  0x2015: '-',
  0x2212: '-',
  0x2026: '...',
  0x2022: '*',
};

const ASCII_MIN = 0x20;
const ASCII_MAX = 0x7e;
const LF_CP = 0x0a;
const CR_CP = 0x0d;
const TAB_CP = 0x09;
/** Rango de los diacriticos que deja la descomposicion NFD. */
const DIACRITICO_MIN = 0x0300;
const DIACRITICO_MAX = 0x036f;

function soloAscii(texto: string): string {
  let out = '';
  for (const ch of texto) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp >= ASCII_MIN && cp <= ASCII_MAX) out += ch;
  }
  return out;
}

export function normalizeText(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;

    if (cp >= ASCII_MIN && cp <= ASCII_MAX) {
      out += ch;
      continue;
    }
    if (cp === LF_CP || cp === CR_CP || cp === TAB_CP) {
      out += ch;
      continue;
    }
    if (ESPACIOS_RAROS.has(cp)) {
      out += ' ';
      continue;
    }
    const especial = ESPECIALES[cp];
    if (especial !== undefined) {
      out += especial;
      continue;
    }
    // Letra con tilde, dieresis o cedilla: se descompone y se queda la base.
    const base = soloAscii(
      Array.from(ch.normalize('NFD'))
        .filter((c) => {
          const x = c.codePointAt(0) ?? 0;
          return x < DIACRITICO_MIN || x > DIACRITICO_MAX;
        })
        .join(''),
    );
    out += base.length > 0 ? base : '?';
  }
  return out;
}

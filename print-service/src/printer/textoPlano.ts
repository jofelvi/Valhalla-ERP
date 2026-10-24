/**
 * Modo texto para impresoras que NO son termicas (laser, tinta): no entienden ESC/POS y, si se
 * les manda en crudo, el trabajo "sale OK" del spooler pero no imprime nada util. Aqui se
 * quitan los comandos ESC/POS del ticket ya armado y queda el texto, que se imprime con el
 * driver normal de Windows (Out-Printer). Una hoja por ticket.
 *
 * Se pierde el formato (negrita, tamaño, corte) y el QR, que no es texto: en su lugar va una
 * linea que avisa que el QR se ve en la app.
 */

const ESC = 0x1b;
const GS = 0x1d;
const FS = 0x1c;
const LF = 0x0a;
const ANCHO_PAPEL = 32; // caracteres por linea del papel de 58 mm (LINE_WIDTH)

/** Bytes de parametros de cada comando ESC que usa el armador (y los comunes). */
const PARAMS_ESC: Record<number, number> = {
  0x40: 0, // @ init
  0x32: 0, // 2 interlineado por defecto
  0x33: 1, // 3 n interlineado
  0x21: 1, // ! modo
  0x2d: 1, // - subrayado
  0x45: 1, // E negrita
  0x47: 1, // G doble golpe
  0x4a: 1, // J avance
  0x4d: 1, // M fuente
  0x52: 1, // R juego internacional
  0x61: 1, // a alineacion
  0x64: 1, // d avance de lineas
  0x74: 1, // t tabla de caracteres
  0x70: 3, // p cajon
};

const PARAMS_GS: Record<number, number> = {
  0x21: 1, // ! tamaño
  0x42: 1, // B inverso
  0x48: 1, // H posicion HRI
  0x68: 1, // h alto de barras
  0x77: 1, // w ancho de barras
  0x4c: 2, // L margen izquierdo
  0x57: 2, // W ancho de area
};

export function escposATexto(datos: Buffer): string {
  const salida: number[] = [];
  let huboQr = false;
  let columna = 0;
  let i = 0;
  while (i < datos.length) {
    const b = datos[i];
    if (b === ESC) {
      i += 2 + (PARAMS_ESC[datos[i + 1]] ?? 0);
      continue;
    }
    if (b === GS) {
      const cmd = datos[i + 1];
      if (cmd === 0x28) {
        // GS ( fn pL pH datos... (QR y otras funciones)
        const largo = (datos[i + 3] ?? 0) + (datos[i + 4] ?? 0) * 256;
        if (datos[i + 2] === 0x6b) huboQr = true;
        i += 5 + largo;
        continue;
      }
      if (cmd === 0x76 && datos[i + 2] === 0x30) {
        // GS v 0 m xL xH yL yH datos: imagen de trama (asi va el QR de la ficha)
        const anchoBytes = (datos[i + 4] ?? 0) + (datos[i + 5] ?? 0) * 256;
        const alto = (datos[i + 6] ?? 0) + (datos[i + 7] ?? 0) * 256;
        huboQr = true;
        i += 8 + anchoBytes * alto;
        continue;
      }
      if (cmd === 0x56) {
        // GS V m [n]: corte
        const m = datos[i + 2];
        i += m === 0x41 || m === 0x42 || m === 65 || m === 66 ? 4 : 3;
        continue;
      }
      if (cmd === 0x6b) {
        // GS k m d1..dk NUL | GS k m n d1..dn (codigo de barras)
        const m = datos[i + 2];
        if (m <= 6) {
          let j = i + 3;
          while (j < datos.length && datos[j] !== 0) j++;
          i = j + 1;
        } else {
          i += 4 + (datos[i + 3] ?? 0);
        }
        continue;
      }
      i += 2 + (PARAMS_GS[cmd] ?? 0);
      continue;
    }
    if (b === FS) {
      i += 2;
      continue;
    }
    if (b === LF) {
      salida.push(LF);
      columna = 0;
    } else if (b >= 0x20) {
      // La termica salta de linea sola al llegar al ancho del papel.
      if (columna === ANCHO_PAPEL) {
        salida.push(LF);
        columna = 0;
      }
      salida.push(b);
      columna++;
    }
    i++;
  }
  let texto = Buffer.from(salida).toString('latin1');
  if (huboQr) {
    texto += '\n[QR de entrega: se ve en la app, en el detalle del pedido]\n';
  }
  // Sin lineas en blanco de mas al final (eran avances de papel de la termica).
  return texto.replace(/\n{3,}$/g, '\n');
}

/** Impresoras que van en modo texto (`TEXT_PRINTERS`, separadas por coma). */
export function esImpresoraDeTexto(nombre: string): boolean {
  return (process.env.TEXT_PRINTERS ?? '')
    .split(',')
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
    .includes(nombre.trim().toLowerCase());
}

/**
 * Convierte los bytes de un ticket ESC/POS en el texto que se leería en el papel, para la vista
 * previa. Quita los comandos de formato (ESC/GS) y el raster del QR; los saltos de línea se conservan.
 */

// Bytes de parámetros que lleva cada comando ESC (0x1b) y GS (0x1d) que usa el servicio.
const PARAMS_ESC: Record<number, number> = {
  0x40: 0, // ESC @  init
  0x74: 1, // ESC t  tabla de caracteres
  0x45: 1, // ESC E  negrita
  0x61: 1, // ESC a  alineación
  0x21: 1, // ESC !  modo de texto
  0x64: 1, // ESC d  avanzar líneas
  0x2d: 1, // ESC -  subrayado
  0x69: 0, // ESC i  corte total
  0x6d: 0, // ESC m  corte parcial
};
const PARAMS_GS: Record<number, number> = {
  0x21: 1, // GS !  tamaño
  0x42: 1, // GS B  video inverso
  0x56: 1, // GS V  corte
};

export function textoDeTicket(buf: Buffer): string {
  let out = '';
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b === 0x1b) {
      i += 2 + (PARAMS_ESC[buf[i + 1]] ?? 0);
      continue;
    }
    if (b === 0x1d) {
      const cmd = buf[i + 1];
      // GS v 0 m xL xH yL yH + datos: imagen raster del QR.
      if (cmd === 0x76 && buf[i + 2] === 0x30) {
        const ancho = buf[i + 4] + buf[i + 5] * 256;
        const alto = buf[i + 6] + buf[i + 7] * 256;
        out += '[QR]\n';
        i += 8 + ancho * alto;
        continue;
      }
      // GS ( k ... : QR nativo.
      if (cmd === 0x28 && buf[i + 2] === 0x6b) {
        const largo = buf[i + 3] + buf[i + 4] * 256;
        i += 5 + largo;
        if (!out.endsWith('[QR]\n')) out += '[QR]\n';
        continue;
      }
      i += 2 + (PARAMS_GS[cmd] ?? 0);
      continue;
    }
    out += b === 0x0a ? '\n' : String.fromCharCode(b);
    i++;
  }
  return out;
}

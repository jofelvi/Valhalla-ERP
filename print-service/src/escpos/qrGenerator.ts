import QRCode from 'qrcode';
import { ESC_ALIGN_CENTER, ESC_ALIGN_LEFT, LF } from './commands';

// Ancho objetivo del QR en puntos. El area imprimible de una 58mm (203 dpi) es
// ~384 puntos; usamos 360 como tope seguro para que el QR NO se corte ni se
// "envuelva" en impresoras que rinden un poco menos de 384.
const MAX_QR_DOTS = 270;

// Genera el QR como IMAGEN RASTER (GS v 0) en lugar del comando nativo GS ( k.
//
// Por que raster: muchas impresoras con driver "Generic / Text Only" (POS-58,
// POS-COCINA, POS-BARRA, POS-PIZZA) IGNORAN el comando nativo de QR (GS ( k) —
// el QR no sale. El raster son solo puntos negros, lo entiende cualquier
// impresora ESC/POS.
//
// Tamano: llenamos el ancho imprimible (MAX_QR_DOTS) para que el QR salga lo
// mas grande posible y sea facil de escanear.
export function generateQrCode(data: string): Buffer {
  const qr = QRCode.create(data, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size; // modulos por lado (sin la zona de silencio)
  const bits = qr.modules.data; // 1 = modulo oscuro, fila por fila
  const quiet = 4; // zona de silencio en modulos (requerida por el estandar QR)
  const totalModules = size + quiet * 2;

  // Escala = puntos por modulo. El maximo que cabe en el ancho objetivo, para
  // que el QR sea lo mas grande posible.
  const scale = Math.max(1, Math.floor(MAX_QR_DOTS / totalModules));

  const dim = totalModules * scale; // ancho = alto en puntos (cuadrado)
  const bytesPerRow = Math.ceil(dim / 8);

  const isDark = (mx: number, my: number): boolean => {
    if (mx < 0 || my < 0 || mx >= size || my >= size) return false; // zona de silencio -> blanco
    return bits[my * size + mx] === 1;
  };

  const raster = Buffer.alloc(bytesPerRow * dim, 0);
  for (let y = 0; y < dim; y++) {
    const moduleY = Math.floor(y / scale) - quiet;
    for (let x = 0; x < dim; x++) {
      const moduleX = Math.floor(x / scale) - quiet;
      if (isDark(moduleX, moduleY)) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  // GS v 0 m xL xH yL yH d1..dk  (m=0 modo normal)
  const header = Buffer.from([
    0x1d,
    0x76,
    0x30,
    0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    dim & 0xff,
    (dim >> 8) & 0xff,
  ]);

  return Buffer.concat([ESC_ALIGN_CENTER, header, raster, LF, ESC_ALIGN_LEFT]);
}

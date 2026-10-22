import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Envía bytes raw a una impresora en Linux.
 *
 * Estrategia:
 *  1) Si `printerName` es un path absoluto (ej: `/dev/usb/lp0`) o empieza con `lp`,
 *     escribe directo al device file. Esto funciona con POS-58 USB sin CUPS.
 *  2) Si existe una impresora CUPS con ese nombre, usa `lp -d <name> -o raw`.
 *  3) Si no, falla con error claro.
 */
export function sendRawToPrinter(
  printerName: string,
  data: Buffer,
): Promise<void> {
  // Estrategia 1: device file directo
  const devicePath = resolveDevicePath(printerName);
  if (devicePath && fs.existsSync(devicePath)) {
    return writeToDevice(devicePath, data);
  }

  // Estrategia 2: CUPS via lp
  return sendViaLp(printerName, data);
}

function resolveDevicePath(name: string): string | null {
  if (name.startsWith('/')) return name; // /dev/usb/lp0, /dev/lp0, etc.
  if (/^lp\d+$/i.test(name)) return `/dev/usb/${name.toLowerCase()}`;
  if (/^usblp\d+$/i.test(name)) return `/dev/${name.toLowerCase()}`;
  return null;
}

function writeToDevice(devicePath: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(devicePath, new Uint8Array(data), (err) => {
      if (err) {
        reject(
          new Error(`No se pudo escribir en ${devicePath}: ${err.message}`),
        );
        return;
      }
      console.log(
        `[Printer] Enviado OK a ${devicePath} (${data.length} bytes)`,
      );
      resolve();
    });
  });
}

function sendViaLp(printerName: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    // Escribimos el buffer a un archivo temporal y lo enviamos con lp -o raw
    const tmpFile = path.join(
      '/tmp',
      `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.bin`,
    );
    try {
      fs.writeFileSync(tmpFile, new Uint8Array(data));
    } catch (err) {
      reject(
        new Error(
          `No se pudo escribir archivo temporal: ${(err as Error).message}`,
        ),
      );
      return;
    }

    execFile(
      'lp',
      ['-d', printerName, '-o', 'raw', tmpFile],
      { timeout: 15000 },
      (error, stdout, stderr) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          // ignore
        }
        if (error) {
          reject(new Error(`lp failed: ${stderr || error.message}`));
          return;
        }
        console.log(`[Printer] lp OK: ${stdout.trim()}`);
        resolve();
      },
    );
  });
}

import { execFile } from 'child_process';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { log } from '../logger';

const PS_SCRIPT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'scripts',
  'send-raw.ps1',
);

export function sendRawToPrinter(
  printerName: string,
  data: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(
      os.tmpdir(),
      `receipt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.bin`,
    );

    // 1. Escribir archivo temporal
    try {
      fs.writeFileSync(tempFile, new Uint8Array(data));
      log.debug(
        'Printer',
        `Temp file creado: ${tempFile} (${data.length} bytes)`,
      );
    } catch (writeErr) {
      const msg =
        writeErr instanceof Error ? writeErr.message : String(writeErr);
      log.error(
        'Printer',
        `No se pudo crear archivo temporal en ${os.tmpdir()}: ${msg}`,
      );
      reject(new Error(`Temp file error: ${msg}`));
      return;
    }

    // 2. Verificar que el script PS existe
    const psScriptResolved = path.resolve(PS_SCRIPT_PATH);
    if (!fs.existsSync(psScriptResolved)) {
      const msg = `Script PowerShell no encontrado: ${psScriptResolved}`;
      log.error('Printer', msg);
      try {
        fs.unlinkSync(tempFile);
      } catch {
        /* ignore */
      }
      reject(new Error(msg));
      return;
    }

    log.info('Printer', `Enviando ${data.length} bytes → "${printerName}"`);

    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        psScriptResolved,
        '-PrinterName',
        printerName,
        '-FilePath',
        tempFile,
      ],
      { timeout: 15000 },
      (error, stdout, stderr) => {
        // Limpiar temp
        try {
          fs.unlinkSync(tempFile);
        } catch {
          /* ignore */
        }

        const stdoutTrim = stdout?.trim() ?? '';
        const stderrTrim = stderr?.trim() ?? '';

        if (error) {
          log.error('Printer', `FALLO impresión en "${printerName}"`);
          log.error('Printer', `  exit code : ${String(error.code ?? 'N/A')}`);
          log.error('Printer', `  stderr    : ${stderrTrim || '(vacío)'}`);
          log.error('Printer', `  stdout    : ${stdoutTrim || '(vacío)'}`);
          log.error('Printer', `  mensaje   : ${error.message}`);
          log.error('Printer', `  bytes     : ${data.length}`);
          log.warn(
            'Printer',
            `  ¿"${printerName}" está instalada? → Panel de Control → Dispositivos e Impresoras`,
          );
          reject(new Error(`Print failed: ${stderrTrim || error.message}`));
          return;
        }

        if (stderrTrim) {
          log.warn('Printer', `stderr (no fatal): ${stderrTrim}`);
        }

        log.info(
          'Printer',
          `OK — ${stdoutTrim || `${data.length} bytes enviados a "${printerName}"`}`,
        );
        resolve();
      },
    );
  });
}

const PS_TEXT_SCRIPT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'scripts',
  'send-text.ps1',
);

/** Modo texto (impresoras laser o de tinta): imprime con el driver de Windows. */
export function sendTextToPrinter(
  printerName: string,
  texto: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(
      os.tmpdir(),
      `ticket_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.txt`,
    );
    try {
      fs.writeFileSync(tempFile, texto, 'utf8');
    } catch (writeErr) {
      const msg =
        writeErr instanceof Error ? writeErr.message : String(writeErr);
      reject(new Error(`Temp file error: ${msg}`));
      return;
    }
    log.info(
      'Printer',
      `Enviando ${texto.length} caracteres (modo texto) → "${printerName}"`,
    );
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.resolve(PS_TEXT_SCRIPT_PATH),
        '-PrinterName',
        printerName,
        '-FilePath',
        tempFile,
      ],
      { timeout: 30000 },
      (error, stdout, stderr) => {
        try {
          fs.unlinkSync(tempFile);
        } catch {
          /* ignore */
        }
        if (error) {
          const detalle = stderr?.trim() || error.message;
          log.error(
            'Printer',
            `FALLO modo texto en "${printerName}": ${detalle}`,
          );
          reject(new Error(`Print failed: ${detalle}`));
          return;
        }
        log.info('Printer', `OK — ${stdout?.trim() || 'texto enviado'}`);
        resolve();
      },
    );
  });
}

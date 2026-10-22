import { exec } from 'child_process';
import * as fs from 'fs';
import { log } from '../logger';

const IS_WINDOWS = process.platform === 'win32';

function isAutoValue(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return v === '' || v === 'auto' || v === 'autodetect';
}

export async function autodetectPrinter(): Promise<string | null> {
  if (IS_WINDOWS) return autodetectWindows();
  return autodetectLinux();
}

function autodetectLinux(): string {
  try {
    if (fs.existsSync('/dev/usb')) {
      const entries = fs
        .readdirSync('/dev/usb')
        .filter((e) => /^lp\d+$/.test(e))
        .sort();
      if (entries.length > 0) return `/dev/usb/${entries[0]}`;
    }
  } catch {
    /* ignore */
  }
  try {
    const entries = fs
      .readdirSync('/dev')
      .filter((e) => /^usblp\d+$/.test(e))
      .sort();
    if (entries.length > 0) return `/dev/${entries[0]}`;
  } catch {
    /* ignore */
  }
  return '';
}

function autodetectWindows(): Promise<string> {
  return new Promise((resolve) => {
    log.info('Autodetect', 'Consultando impresoras instaladas en Windows...');
    exec(
      'powershell -NoProfile -Command "Get-Printer | Select-Object Name,PortName,PrinterStatus | ConvertTo-Json"',
      { timeout: 5000 },
      (error, stdout, stderr) => {
        if (error) {
          log.warn(
            'Autodetect',
            `Error al listar impresoras: ${stderr || error.message}`,
          );
          resolve('');
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as
            | { Name: string; PortName: string; PrinterStatus: number }[]
            | { Name: string; PortName: string; PrinterStatus: number };
          const printers = (Array.isArray(parsed) ? parsed : [parsed]).filter(
            (p) => p.Name,
          );

          if (printers.length === 0) {
            log.warn(
              'Autodetect',
              'No se encontró ninguna impresora instalada en Windows',
            );
            resolve('');
            return;
          }

          log.info(
            'Autodetect',
            `Impresoras encontradas (${printers.length}):`,
          );
          for (const p of printers) {
            log.info(
              'Autodetect',
              `  "${p.Name}" | puerto=${p.PortName} | status=${p.PrinterStatus}`,
            );
          }

          const names = printers.map((p) => p.Name);
          const preferred = names.find((n) =>
            /pos[- ]?58|pos|roccia|rc[- ]?58/i.test(n),
          );

          if (preferred) {
            log.info(
              'Autodetect',
              `Seleccionada por patrón POS: "${preferred}"`,
            );
            resolve(preferred);
          } else {
            log.info(
              'Autodetect',
              `Sin impresora POS-58, usando la primera: "${names[0]}"`,
            );
            resolve(names[0] ?? '');
          }
        } catch (parseErr) {
          const msg =
            parseErr instanceof Error ? parseErr.message : String(parseErr);
          log.warn(
            'Autodetect',
            `Error al parsear lista de impresoras: ${msg}`,
          );
          log.warn('Autodetect', `  stdout raw: ${stdout.slice(0, 300)}`);
          resolve('');
        }
      },
    );
  });
}

export async function resolvePrinter(
  rawValue: string | undefined,
  label: string,
): Promise<{ name: string; detected: boolean }> {
  if (!isAutoValue(rawValue)) {
    log.info(
      'Autodetect',
      `${label}: usando valor fijo del .env → "${rawValue}"`,
    );
    return { name: rawValue!, detected: false };
  }

  log.info(
    'Autodetect',
    `${label}: valor "auto" — detectando automáticamente...`,
  );
  const detected = await autodetectPrinter();

  if (!detected) {
    log.error('Autodetect', `${label}: NO se detectó ninguna impresora`);
    if (IS_WINDOWS) {
      log.error(
        'Autodetect',
        '  → Instala la impresora: Panel de Control → Dispositivos e Impresoras',
      );
      log.error(
        'Autodetect',
        '  → O configura RECEIPT_PRINTER/KITCHEN_PRINTER en el archivo .env',
      );
    } else {
      log.error(
        'Autodetect',
        '  → Verifica que la impresora USB esté conectada: ls /dev/usb/lp*',
      );
    }
    return { name: '', detected: false };
  }

  log.info('Autodetect', `${label}: → "${detected}"`);
  return { name: detected, detected: true };
}

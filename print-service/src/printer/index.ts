import { exec } from 'child_process';
import * as fs from 'fs';
import { sendRawToPrinter as sendWindows } from './windowsPrinter';
import { sendRawToPrinter as sendLinux } from './linuxPrinter';

const IS_WINDOWS = process.platform === 'win32';

/**
 * Envía bytes raw a la impresora. Detecta el OS en runtime.
 */
export async function sendRawToPrinter(
  printerName: string,
  data: Buffer,
): Promise<void> {
  if (IS_WINDOWS) return sendWindows(printerName, data);
  return sendLinux(printerName, data);
}

/**
 * Lista las impresoras disponibles en el sistema (Windows o Linux).
 */
export async function listSystemPrinters(): Promise<string[]> {
  if (IS_WINDOWS) return listWindowsPrinters();
  return listLinuxPrinters();
}

function listWindowsPrinters(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    exec(
      'powershell -NoProfile -Command "Get-Printer | Select-Object Name | ConvertTo-Json"',
      { timeout: 5000 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as
            | { Name: string }[]
            | { Name: string };
          const list = Array.isArray(parsed)
            ? parsed.map((p) => p.Name)
            : [parsed.Name];
          resolve(list);
        } catch {
          resolve([stdout.trim()]);
        }
      },
    );
  });
}

async function listLinuxPrinters(): Promise<string[]> {
  // 1) CUPS printers via lpstat
  const cups = await lpstat();
  // 2) USB lp devices
  const usb = listUsbLpDevices();
  return [...new Set([...cups, ...usb])];
}

function lpstat(): Promise<string[]> {
  return new Promise((resolve) => {
    exec(
      "lpstat -p 2>/dev/null | awk '{print $2}'",
      { timeout: 3000 },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }
        const names = stdout
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        resolve(names);
      },
    );
  });
}

function listUsbLpDevices(): string[] {
  const candidates: string[] = [];
  try {
    const usbDir = '/dev/usb';
    if (fs.existsSync(usbDir)) {
      const entries = fs.readdirSync(usbDir);
      for (const entry of entries) {
        if (/^lp\d+$/.test(entry)) candidates.push(`/dev/usb/${entry}`);
      }
    }
    // /dev/lp0 etc (legacy paralelo, raro)
    const devRoot = fs.readdirSync('/dev');
    for (const entry of devRoot) {
      if (/^usblp\d+$/.test(entry)) candidates.push(`/dev/${entry}`);
    }
  } catch {
    // ignore
  }
  return candidates;
}

import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as crypto from 'crypto';

import { GIROS, PUNTAJE_MINIMO_DERECHA, puntajeDeLectura } from './orientacion';

const execAsync = promisify(exec);

export interface VoucherOcrData {
  raw: string;
  refs: string[]; // numeros >= 6 digitos (refs reales del banco)
  shortRefs: string[]; // ultimos 4 digitos de cada ref (lo que ingresa el mesonero)
  amountsBs: number[];
  codesAprob: string[];
  type: string | null; // CREDIT, DEBIT, MASTERCARD, MAESTRO, VISA
  status: string | null; // APROBADO, RECHAZADO, etc
  durationMs: number;
}

export interface InvoiceOcrResult {
  raw: string;
  durationMs: number;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  /**
   * Pre-procesa la imagen (auto-orient, resize, gris, gamma) y corre tesseract.
   * Devuelve los datos parseados del voucher POS. Si tesseract o el preprocesado
   * fallan, devuelve un objeto vacio con `raw=""` (no lanza).
   */
  async extractVoucherData(imagePath: string): Promise<VoucherOcrData> {
    const t0 = Date.now();
    const empty: VoucherOcrData = {
      raw: '',
      refs: [],
      shortRefs: [],
      amountsBs: [],
      codesAprob: [],
      type: null,
      status: null,
      durationMs: 0,
    };

    if (!imagePath) return empty;
    try {
      await fs.access(imagePath);
    } catch {
      this.logger.warn(`OCR: imagen no existe ${imagePath}`);
      return empty;
    }

    const tmpName = `ocr-${crypto.randomBytes(6).toString('hex')}.jpg`;
    const tmpPath = path.join(os.tmpdir(), tmpName);

    try {
      // 1. Pre-procesar con ImageMagick: auto-orient + resize + gris + nitidez.
      //    El resize a 1200px del lado largo acelera el OCR sin perder texto.
      //    El '>' del resize debe ir entre comillas para que el shell no lo
      //    interprete como redirect (causaba "unable to open image '200'").
      await execAsync(
        `convert "${imagePath}" -auto-orient -resize "1200x1200>" -colorspace Gray -level "0%,100%,0.5" "${tmpPath}"`,
        { timeout: 15_000 },
      );

      // 2. Tesseract en español (psm 6 = uniform block of text, ideal para voucher).
      const { stdout } = await execAsync(
        `tesseract "${tmpPath}" - -l spa --psm 6`,
        { timeout: 20_000, maxBuffer: 1024 * 1024 },
      );

      const raw = stdout || '';
      const result = this.parseVoucherText(raw);
      result.durationMs = Date.now() - t0;
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `OCR fallo para ${path.basename(imagePath)}: ${message}`,
      );
      return { ...empty, durationMs: Date.now() - t0 };
    } finally {
      // Cleanup tmp file (no esperamos)
      fs.unlink(tmpPath).catch(() => undefined);
    }
  }

  /**
   * Extrae texto de factura via OCR.
   * Pre-procesa igual que voucher pero con --psm 4 (columnas de texto).
   * Devuelve { raw, durationMs }, nunca lanza (raw '' en fallo).
   */
  async extractInvoiceText(imagePath: string): Promise<InvoiceOcrResult> {
    const t0 = Date.now();
    const empty: InvoiceOcrResult = {
      raw: '',
      durationMs: 0,
    };

    if (!imagePath) return empty;
    try {
      await fs.access(imagePath);
    } catch {
      this.logger.warn(`OCR: imagen no existe ${imagePath}`);
      return empty;
    }

    const tmpName = `ocr-${crypto.randomBytes(6).toString('hex')}.jpg`;
    const tmpPath = path.join(os.tmpdir(), tmpName);

    try {
      // Pre-procesar con ImageMagick: auto-orient + resize + gris + nitidez.
      // Las fotos que manda Telegram llegan angostas (600-900 px de ancho) y en
      // una factura de papel termico eso deja los decimales en 2-3 pixeles:
      // "13.40" salia "1340". Se amplian hasta 1300 de ancho y despues se topan
      // a 1300 por lado. Medido el 18/09/2026 contra 17 fotos reales: Karin paso
      // de 2 a 4 renglones y de un total de 397.015 a 21.922,23, desechables y
      // Coca-Cola ganaron un renglon, y ningun Pago Movil cambio. Ampliar sin
      // tope (2000 px) leyo un Pago Movil en dolares.
      const leer = async (giro: number): Promise<string> => {
        const rotar = giro ? ` -rotate ${giro}` : '';
        await execAsync(
          `convert "${imagePath}" -auto-orient${rotar} -resize "1300x<" -resize "1300x1300>" -colorspace Gray -level "0%,100%,0.5" "${tmpPath}"`,
          { timeout: 15_000 },
        );
        // Tesseract en español con --psm 4 (sparse text, columnas)
        const { stdout } = await execAsync(
          `tesseract "${tmpPath}" - -l spa --psm 4`,
          {
            timeout: 20_000,
            maxBuffer: 1024 * 1024,
          },
        );
        return stdout || '';
      };

      let raw = await leer(0);
      // Casi sin palabras: la foto puede estar de lado (Telegram borra el
      // EXIF). Se prueban los giros y gana la lectura con mas palabras.
      if (puntajeDeLectura(raw) < PUNTAJE_MINIMO_DERECHA) {
        let mejor = { texto: raw, puntos: puntajeDeLectura(raw), giro: 0 };
        for (const giro of GIROS) {
          const texto = await leer(giro);
          const puntos = puntajeDeLectura(texto);
          if (puntos > mejor.puntos) mejor = { texto, puntos, giro };
        }
        if (mejor.giro)
          this.logger.log(
            `OCR: la foto estaba girada, se leyo a ${mejor.giro}°`,
          );
        raw = mejor.texto;
      }
      return {
        raw: raw.slice(0, 5000), // Limitar a 5K caracteres
        durationMs: Date.now() - t0,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `OCR fallo para ${path.basename(imagePath)}: ${message}`,
      );
      return { raw: '', durationMs: Date.now() - t0 };
    } finally {
      // Cleanup tmp file (no esperamos)
      fs.unlink(tmpPath).catch(() => undefined);
    }
  }

  /**
   * Parsea el texto crudo del OCR del voucher POS y extrae:
   *   - refs largas (>= 8 digitos) y sus ultimos 4 (que es lo que ingresa el mesonero)
   *   - montos en Bs
   *   - codigos de aprobacion (4-8 digitos despues de "Cod Aprob")
   *   - tipo de tarjeta
   *   - estado (aprobado/rechazado)
   */
  parseVoucherText(text: string): VoucherOcrData {
    // ─── Filtros de exclusion (telefonos VE + cedulas) ───
    // Antes capturabamos cualquier numero de 8+ digitos como "ref", lo que
    // generaba falsos positivos masivos: telefonos Pago Movil (0XXXXXXXXXX)
    // y cedulas (8 digitos sin keyword) terminaban como shorts y disparaban
    // "ref no ingresada" en cada voucher. Ahora los excluimos primero.
    const phones = new Set<string>();
    const cis = new Set<string>();

    // 1) Telefonos venezolanos: moviles 0(4{12,14,16,24,26}) + 7 digitos.
    //    El "0" inicial es opcional porque a veces el OCR lo come.
    const phoneAnyPattern = /\b0?4(?:12|14|16|24|26)\d{7}\b/g;
    let pm: RegExpExecArray | null;
    while ((pm = phoneAnyPattern.exec(text)) !== null) {
      phones.add(pm[0].replace(/\D/g, ''));
    }

    // 2) Telefonos con keyword (mas permisivos en formato)
    const phoneKeywordPattern =
      /(?:Tel(?:[eé]fono)?|Cel(?:ular)?|M[oó]vil|Telf|Origen|Destino)\.?:?\s*(0?\d{10,11})/gi;
    while ((pm = phoneKeywordPattern.exec(text)) !== null) {
      phones.add(pm[1].replace(/\D/g, ''));
    }

    // 3) Cedulas con keyword (CI, Cedula, Documento, RIF)
    const ciPattern =
      /(?:CI|C\.?I\.?|C[eé]dula|Documento|Doc|RIF)\.?:?\s*[VEJGP]?-?\s*(\d{6,9})/gi;
    while ((pm = ciPattern.exec(text)) !== null) {
      cis.add(pm[1].replace(/\D/g, ''));
    }

    // ─── Refs reales ───
    // 4) Refs con keyword explicito (alta confianza)
    const refKeywordPattern =
      /(?:Ref(?:erencia)?|N[uú]mero|Operaci[oó]n|Op\b|Confirmaci[oó]n|Comprobante|Movimiento|Aprobaci[oó]n|Autorizaci[oó]n|RFF|REF|Reff?)\.?:?\s*(\d{4,})/gi;
    const refs = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = refKeywordPattern.exec(text)) !== null) {
      const n = m[1];
      if (!phones.has(n) && !cis.has(n)) refs.add(n);
    }

    // 5) Fallback: numeros 9-20 digitos sin keyword. Refs bancarias suelen
    //    ser 10-12; cedulas son 6-9 (las dejamos fuera). Telefonos son 10-11
    //    pero se filtran por pattern arriba.
    const allLong = text.match(/\d{9,20}/g) || [];
    for (const n of allLong) {
      if (phones.has(n)) continue;
      if (/^0?4(?:12|14|16|24|26)\d{7}$/.test(n)) {
        phones.add(n);
        continue;
      }
      if (cis.has(n)) continue;
      refs.add(n);
    }

    // Ultimos 4 digitos de cada ref REAL (lo que ingresa el mesonero al cobrar).
    // Importante: derivamos shorts solo de refs reales, NO de telefonos/cedulas
    // (eso causaba el falso positivo de "8363" en cada voucher cuando 8363 era
    // los ultimos 4 de la cedula del titular).
    const shortRefs = Array.from(refs).map((r) => r.slice(-4));

    // Montos en Bs: "Bs 19.000,00" / "Bs. 12.859,96" / "Vonto Bs 19000"
    // Tesseract a veces lee "Bs" como "Es" o "8s" — aceptamos varios prefijos.
    const amountRegex = /(?:Bs|Es|8s|BS)\.?\s*([\d.,]+)/gi;
    const amountsBs = new Set<number>();
    let am: RegExpExecArray | null;
    while ((am = amountRegex.exec(text)) !== null) {
      const n = this.parseBsAmount(am[1]);
      if (n != null && n > 0) amountsBs.add(n);
    }

    // Cod Aprob: numero corto despues de "Cod Aprob", "Aprob", "Auth", etc.
    const aprobRegex = /(?:Cod\s*Aprob|Aprob|Auth)\.?:?\s*(\d{3,8})/gi;
    const codesAprob = new Set<string>();
    let cm: RegExpExecArray | null;
    while ((cm = aprobRegex.exec(text)) !== null) codesAprob.add(cm[1]);

    // Tipo de tarjeta
    const typeMatch = text.match(
      /(MASTERCARD|MAESTRO|VISA|AMEX|CREDIT|DEBIT)/i,
    );
    const type = typeMatch ? typeMatch[1].toUpperCase() : null;

    // Status
    const statusMatch = text.match(/(APROBADO|RECHAZADO|DENEGADO|ANULADO)/i);
    const status = statusMatch ? statusMatch[1].toUpperCase() : null;

    return {
      raw: text.slice(0, 1500),
      refs: Array.from(refs),
      shortRefs: Array.from(new Set(shortRefs)),
      amountsBs: Array.from(amountsBs),
      codesAprob: Array.from(codesAprob),
      type,
      status,
      durationMs: 0,
    };
  }

  /**
   * Convierte "19.000,00" o "19,000.00" o "19000" a number.
   * Maneja formato latino (coma decimal) y anglo.
   */
  private parseBsAmount(s: string): number | null {
    if (!s) return null;
    let clean = s.trim();
    // Si tiene coma decimal (19.000,00) → quitar puntos miles, cambiar coma por punto
    if (/,\d{1,2}$/.test(clean)) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // formato anglo: 19,000.00 → quitar comas
      clean = clean.replace(/,/g, '');
    }
    const n = parseFloat(clean);
    return isFinite(n) ? n : null;
  }

  /**
   * Resuelve la URL publica de un comprobante a su path local en disco.
   * URL: <PUBLIC_BASE_URL>/uploads/payment-proofs/{orderId}/{name}
   * Path: <UPLOADS_DIR>/payment-proofs/{orderId}/{name}
   */
  resolveLocalPath(url: string): string | null {
    if (!url) return null;
    const match = url.match(/\/uploads\/payment-proofs\/([^/]+)\/([^/?#]+)/);
    if (!match) return null;
    const baseDir =
      process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
    return path.join(baseDir, 'payment-proofs', match[1], match[2]);
  }
}

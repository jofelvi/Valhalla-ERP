import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { Api } from 'grammy';
import { OcrService } from '../ocr/ocr.service';
import { UploadsService } from '../uploads/uploads.service';
import { parseInvoiceHeader, InvoiceHeader } from '../ocr/invoice-header-parser';

export interface FotoProcesada {
  invoiceUrl: string;
  ocrText: string;
  header: InvoiceHeader;
}

/** `UploadImageDto.extension` solo acepta este set; el bot solo manda fotos (jpg). */
type ExtensionSubida = 'jpg' | 'jpeg' | 'png' | 'webp' | 'pdf';
const EXTENSIONES_VALIDAS: readonly ExtensionSubida[] = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

function extensionValida(ext: string): ExtensionSubida {
  return (EXTENSIONES_VALIDAS as readonly string[]).includes(ext) ? (ext as ExtensionSubida) : 'jpg';
}

@Injectable()
export class PhotoHandler {
  private readonly logger = new Logger(PhotoHandler.name);

  constructor(
    private readonly ocr: OcrService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Descarga la foto que mandó el socio. Si Telegram no devuelve file_path o
   * la respuesta HTTP no es 200, devuelve null en vez de subir/OCRear un
   * error como si fuera la factura.
   */
  async descargar(api: Api, fileId: string, token: string): Promise<Buffer | null> {
    const file = await api.getFile(fileId);
    if (!file.file_path) {
      this.logger.warn(`Telegram no devolvió file_path para ${fileId}`);
      return null;
    }
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    if (!res.ok) {
      this.logger.warn(`Descarga de foto fallo: HTTP ${res.status}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Guarda la foto (queda como comprobante en invoiceUrls) y la lee. El OCR
   * nunca lanza: si no lee nada, el socio escribe todo a mano.
   */
  async procesar(buffer: Buffer, extension = 'jpg'): Promise<FotoProcesada> {
    const ahora = new Date();
    const subPath = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, '0')}`;
    const { url } = this.uploads.uploadImage({
      imageBase64: buffer.toString('base64'),
      // `UploadImageDto.category` no tiene 'expenses'; 'invoices' es la
      // categoria mas cercana (facturas de compras) y ya existe.
      category: 'invoices',
      subPath,
      extension: extensionValida(extension),
    });

    const tmpPath = path.join(os.tmpdir(), `tg-${crypto.randomBytes(6).toString('hex')}.${extension}`);
    let ocrText = '';
    try {
      await fs.writeFile(tmpPath, buffer);
      const r = await this.ocr.extractInvoiceText(tmpPath);
      ocrText = r.raw;
      this.logger.log(`OCR factura: ${ocrText.length} chars en ${r.durationMs} ms`);
    } finally {
      fs.unlink(tmpPath).catch(() => undefined);
    }
    return { invoiceUrl: url, ocrText, header: parseInvoiceHeader(ocrText) };
  }
}

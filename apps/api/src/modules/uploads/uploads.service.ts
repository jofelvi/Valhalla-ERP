import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { UploadImageDto } from './dto/upload-image.dto';

const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
);
/** Base pública de los archivos. Sin variable, la ruta queda relativa al propio API. */
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@Injectable()
export class UploadsService {
  /**
   * FileReader.readAsDataURL entrega `data:<mime>;base64,...`. Hay que quitar
   * el prefijo sea cual sea el mime: acotarlo a `image/*` dejaba los bytes de
   * `data:application/pdf;base64,` dentro del buffer y el PDF salia corrupto.
   */
  private stripDataUri(value: string): string {
    return value.replace(/^data:[^;,]*;base64,/, '');
  }

  /**
   * `baseDeRespaldo` es el origen desde el que llegó la petición: se usa cuando el servidor no
   * tiene `PUBLIC_BASE_URL`, para no devolver una ruta relativa que ni la web (otro dominio) ni
   * el teléfono (sin origen) podrían abrir.
   */
  uploadImage(dto: UploadImageDto, baseDeRespaldo = ''): { url: string } {
    const cleaned = this.stripDataUri(dto.imageBase64);
    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('imageBase64 invalido');
    }
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new BadRequestException('La imagen excede 10MB');
    }

    const ext = dto.extension ?? 'jpg';
    const subPath = (dto.subPath ?? '').replace(/[^a-zA-Z0-9_\-/]/g, '');
    const targetDir = path.join(UPLOADS_DIR, dto.category, subPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const fullPath = path.join(targetDir, filename);
    fs.writeFileSync(fullPath, buffer);

    const urlPath = ['uploads', dto.category, subPath, filename]
      .filter(Boolean)
      .join('/');
    return { url: `${PUBLIC_BASE_URL || baseDeRespaldo}/${urlPath}` };
  }
}

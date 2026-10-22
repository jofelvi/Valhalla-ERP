import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UploadImageDto } from './dto/upload-image.dto';
import { UploadsService } from './uploads.service';

/**
 * El comprobante de nomina (/private/payroll) subia a una categoria que el DTO
 * no conocia: el 400 salia en la cara del cajero justo al pulsar "Pagar".
 * Este spec fija el contrato real que ya usan los clientes.
 */
const validar = (payload: Record<string, unknown>): string[] =>
  validateSync(plainToInstance(UploadImageDto, payload)).map((e) => e.property);

describe('UploadImageDto — categorias que los clientes ya usan', () => {
  const base = { imageBase64: 'aGVsbG8=' };

  it.each([
    'payment-proofs',
    'payroll-proofs', // WeeklyPayrollRow.tsx
    'invoices',
    'waste-photos',
    'avatars',
    'products',
    'generic',
  ])('acepta la categoria %s', (category) => {
    expect(validar({ ...base, category })).toEqual([]);
  });

  it('sigue rechazando una categoria inventada', () => {
    expect(validar({ ...base, category: 'no-existe' })).toContain('category');
  });

  it('acepta pdf: el input del comprobante ofrece accept="image/*,.pdf"', () => {
    expect(
      validar({ ...base, category: 'payroll-proofs', extension: 'pdf' }),
    ).toEqual([]);
  });
});

describe('UploadsService — decodificado del data URI', () => {
  const service = new UploadsService();
  // FileReader.readAsDataURL entrega el prefijo completo; el servicio debe
  // quitarlo sea cual sea el mime, no solo image/*.
  const decodificar = (dataUri: string): string =>
    (service as unknown as { stripDataUri(v: string): string }).stripDataUri(
      dataUri,
    );

  it('quita el prefijo de una imagen', () => {
    expect(decodificar('data:image/png;base64,aGVsbG8=')).toBe('aGVsbG8=');
  });

  it('quita el prefijo de un PDF (application/pdf)', () => {
    expect(decodificar('data:application/pdf;base64,aGVsbG8=')).toBe(
      'aGVsbG8=',
    );
  });

  it('deja intacto un base64 sin prefijo', () => {
    expect(decodificar('aGVsbG8=')).toBe('aGVsbG8=');
  });
});

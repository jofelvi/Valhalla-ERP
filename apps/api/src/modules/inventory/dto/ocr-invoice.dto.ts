import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class OcrInvoiceDto {
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @IsIn(['jpg', 'jpeg', 'png'])
  @IsNotEmpty()
  extension: 'jpg' | 'jpeg' | 'png';

  /**
   * Proveedor de la factura. Si viene, se aplican los alias aprendidos de ESE
   * proveedor, que es lo que permite reconocer "SOLERA LIGHT RET" como
   * Cerveza Light Botella. Opcional: sin el, el OCR funciona como siempre.
   */
  @IsOptional()
  @IsString()
  placeId?: string;
}

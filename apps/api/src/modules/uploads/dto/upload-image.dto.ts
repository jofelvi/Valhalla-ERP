import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const CATEGORIES = [
  'payment-proofs',
  'avatars',
  'products',
  'generic',
  'invoices', // facturas de compras (inventario fase 3)
  'waste-photos', // fotos de merma declarada
  'payroll-proofs', // comprobantes del pago semanal de nomina
  'attendance', // selfies de fichaje de entrada y salida
  'categories', // portadas de categoria del catalogo
  'employees', // fotos del personal
  'purchase-orders', // soportes de ordenes de compra
] as const;
// pdf: el comprobante de nomina se adjunta con accept="image/*,.pdf"
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const;

export class UploadImageDto {
  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES as unknown as string[])
  category: (typeof CATEGORIES)[number];

  @ApiPropertyOptional({
    description: 'Sub-ruta opcional dentro de la categoria (ej: orderId)',
  })
  @IsOptional()
  @IsString()
  subPath?: string;

  @ApiProperty({ description: 'Imagen en base64 (sin prefijo data:image/...)' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiPropertyOptional({ enum: EXTENSIONS, default: 'jpg' })
  @IsOptional()
  @IsIn(EXTENSIONS as unknown as string[])
  extension?: (typeof EXTENSIONS)[number];
}

import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class SendPagoPendienteDto {
  @Matches(/^\d{8,15}$/, {
    message: 'Telefono en formato E.164 sin + (ej: 584140000005)',
  })
  to!: string;

  @IsString()
  @Length(1, 60)
  customerName!: string;

  @IsString()
  @Length(1, 20)
  amount!: string;

  @IsString()
  @Length(1, 30)
  orderCode!: string;

  @IsString()
  @Length(1, 30)
  date!: string;

  // PDF en base64 (sin data: prefix)
  @IsString()
  @MaxLength(30_000_000)
  pdfBase64!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  pdfFilename?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  accountReceivableId?: string;
}

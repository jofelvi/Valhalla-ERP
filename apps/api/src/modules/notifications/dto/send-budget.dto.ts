import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Envio de un presupuesto por WhatsApp con el PDF adjunto.
 *
 * Mismo esquema que SendPagoPendienteDto pero con las variables del
 * presupuesto: la plantilla de Meta espera nombre, numero, evento y total.
 */
export class SendBudgetDto {
  @Matches(/^\d{8,15}$/, {
    message: 'Telefono en formato E.164 sin + (ej: 584140000005)',
  })
  to!: string;

  @IsString()
  @Length(1, 60)
  customerName!: string;

  @IsString()
  @Length(1, 30)
  budgetNumber!: string;

  @IsString()
  @Length(1, 60)
  eventName!: string;

  /** Total ya formateado, ej "$1.250,00". */
  @IsString()
  @Length(1, 20)
  total!: string;

  /** PDF en base64, sin el prefijo `data:`. */
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
  budgetId?: string;
}

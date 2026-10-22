import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateIf,
} from 'class-validator';

// @IsOptional no salta validacion en null explicito — la APK manda null
// cuando el campo no aplica. Este decorator salta si el valor es null/undefined.
const IsNullable = () => ValidateIf((_, v) => v !== null && v !== undefined);

export class CreatePaymentDto {
  @ApiProperty({ example: 'order123', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 100.5, description: 'Payment amount' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 'CASH_USD', description: 'Payment method' })
  @IsString()
  @IsOptional()
  method?: string;

  // Alias para compatibilidad con APK que envia `paymentMethod` en vez de `method`.
  // El service mergea ambos a `method`.
  @ApiProperty({
    example: 'CASH_USD',
    description: 'Payment method (alias)',
    required: false,
  })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiProperty({ example: 'user123', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: 'txn12345',
    description: 'Transaction ID',
    required: false,
  })
  @IsNullable()
  @IsString()
  transactionId?: string;

  @ApiProperty({ example: 'completed', description: 'Status', required: false })
  @IsNullable()
  @IsString()
  status?: string;

  @ApiProperty({
    example: 'Payment notes',
    description: 'Notes',
    required: false,
  })
  @IsNullable()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 36.5, description: 'BCV rate', required: false })
  @IsNullable()
  @IsNumber()
  bcvRate?: number;

  @ApiProperty({
    example: 3650,
    description: 'Expected amount BS',
    required: false,
  })
  @IsNullable()
  @IsNumber()
  expectedAmountBS?: number;

  @ApiProperty({
    example: 'https://api.ejemplo.com/uploads/payment-proofs/...',
    description: 'URL de la imagen del comprobante de pago',
    required: false,
  })
  @IsNullable()
  @IsString()
  proofImageUrl?: string;

  @ApiProperty({
    example: 'REF-12345',
    description: 'Referencia del pago',
    required: false,
  })
  @IsNullable()
  @IsString()
  reference?: string;

  // Llave de idempotencia del cliente (outbox offline). Cuando viene, un
  // reintento con el mismo valor devuelve el pago ya creado en vez de crear
  // otro. Hoy ningun cliente la manda: campo aditivo, cero cambio hasta que
  // exista la cola offline. El indice unico+sparse ya esta en el schema.
  @ApiProperty({
    example: 'pay-9f3a...',
    description: 'Idempotency key',
    required: false,
  })
  @IsNullable()
  @IsString()
  clientRequestId?: string;
}

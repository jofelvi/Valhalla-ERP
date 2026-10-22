import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  IsDate,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

const IsNullable = () => ValidateIf((_, v) => v !== null && v !== undefined);

export class InvoiceItemDto {
  @ApiProperty({
    example: 'prod123',
    description: 'Product ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({
    example: 'Burger',
    description: 'Product name',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'Deluxe burger',
    description: 'Description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 2, description: 'Quantity' })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ example: 10.5, description: 'Unit price' })
  @IsNumber()
  @IsNotEmpty()
  unitPrice: number;

  @ApiProperty({ example: 21, description: 'Total amount' })
  @IsNumber()
  @IsNotEmpty()
  total: number;

  @ApiProperty({
    example: 'Special notes',
    description: 'Notes',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'INV-001', description: 'Invoice number' })
  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @ApiProperty({
    example: 'order123',
    description: 'Order ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  orderId?: string;

  @ApiProperty({
    example: 'cust123',
    description: 'Customer ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Customer name',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiProperty({
    example: 'J-90000004-0',
    description: 'Customer RIF',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerRif?: string;

  // Datos fiscales adicionales
  @ApiProperty({
    example: 'V',
    description: 'Tipo identificacion (V/E/J/G/P)',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerIdType?: string;

  @ApiProperty({
    example: 'Av. Principal, Edificio Centro',
    description: 'Direccion fiscal',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerAddress?: string;

  @ApiProperty({
    example: '+10000000000',
    description: 'Telefono',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty({
    example: 'cliente@ejemplo.com',
    description: 'Email',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({
    example: 'contribuyente_ordinario',
    description: 'Tipo cliente SENIAT',
    required: false,
  })
  @IsString()
  @IsOptional()
  customerType?: string;

  @ApiProperty({
    example: '00-00000001',
    description: 'Numero de control fiscal',
    required: false,
  })
  @IsString()
  @IsOptional()
  controlNumber?: string;

  @ApiProperty({
    example: 'contado',
    description: 'Forma/condicion de pago',
    required: false,
  })
  @IsString()
  @IsOptional()
  paymentCondition?: string;

  @ApiProperty({
    example: '2026-04-29',
    description: 'Fecha de emision',
    required: false,
  })
  @IsOptional()
  issueDate?: Date;

  @ApiProperty({
    example: 'Observaciones',
    description: 'Observaciones',
    required: false,
  })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({
    example: 0,
    description: 'Descuento en monto absoluto',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  discount?: number;

  @ApiProperty({
    example: 'budget123',
    description: 'Budget ID origen',
    required: false,
  })
  @IsString()
  @IsOptional()
  budgetId?: string;

  @ApiProperty({ example: 100, description: 'Subtotal', required: false })
  @IsNumber()
  @IsOptional()
  subtotal?: number;

  @ApiProperty({ example: 10, description: 'Service charge', required: false })
  @IsNumber()
  @IsOptional()
  serviceCharge?: number;

  @ApiProperty({ example: 16, description: 'Tax amount', required: false })
  @IsNumber()
  @IsOptional()
  tax?: number;

  @ApiProperty({ example: 116, description: 'Total amount', required: false })
  @IsNumber()
  @IsOptional()
  total?: number;

  @ApiProperty({ example: 5, description: 'Tip', required: false })
  @IsNumber()
  @IsOptional()
  tip?: number;

  @ApiProperty({
    example: 'cash',
    description: 'Payment type',
    required: false,
  })
  @IsString()
  @IsOptional()
  paymentType?: string;

  @ApiProperty({ example: 'USD', description: 'Currency', required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    example: '2026-05-10',
    description: 'Due date',
    required: false,
    type: String,
  })
  @IsOptional()
  dueDate?: Date;

  @ApiProperty({
    example: 'Invoice notes',
    description: 'Notes',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    type: [InvoiceItemDto],
    description: 'Invoice items',
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  @IsOptional()
  items?: InvoiceItemDto[];

  // ── Datos de cobro (mesonero pago movil, transferencia, tarjeta) ──
  @ApiProperty({ required: false, description: 'Referencia de pago principal' })
  @IsNullable()
  @IsString()
  paymentReference?: string;

  @ApiProperty({ required: false, description: 'Tasa BCV del dia del cobro' })
  @IsNullable()
  @IsNumber()
  bcvRate?: number;

  @ApiProperty({ required: false, description: 'Monto pagado en Bs' })
  @IsNullable()
  @IsNumber()
  paymentAmountBs?: number;

  @ApiProperty({ required: false, description: 'URLs de comprobantes' })
  @IsNullable()
  @IsArray()
  paymentProofUrls?: string[];

  @ApiProperty({ required: false, description: 'Telefono Pago Movil' })
  @IsNullable()
  @IsString()
  pagoMovilPhone?: string;

  @ApiProperty({ required: false, description: 'Cedula Pago Movil' })
  @IsNullable()
  @IsString()
  pagoMovilCedula?: string;

  @ApiProperty({ required: false, description: 'Banco Pago Movil' })
  @IsNullable()
  @IsString()
  pagoMovilBanco?: string;
}

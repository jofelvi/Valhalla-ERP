import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  IsBoolean,
  ValidateIf,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

// La APK envia muchos campos como `null` explicito cuando no aplican
// (ej: tableId:null en ordenes de zona). @IsOptional solo salta si la key
// FALTA — con null explicito la validacion IsString rechaza → 400.
// Este decorator salta la validacion siguiente si el valor es null/undefined.
const IsNullable = () => ValidateIf((_, v) => v !== null && v !== undefined);

// Tobos mixtos: una variante (Light/Pilsen/Azul) dentro de la composicion de
// un tobo/caja. deliveredQty/returnedQty los maneja el backend al despachar.
export class ToboCompositionEntryDto {
  @IsString()
  @IsNotEmpty()
  variantProductId: string;

  @IsString()
  @IsNotEmpty()
  variantName: string;

  @IsNumber()
  @IsNotEmpty()
  qty: number;

  @IsOptional()
  @IsNumber()
  deliveredQty?: number;

  @IsOptional()
  @IsNumber()
  returnedQty?: number;
}

export class AddedExtraDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty()
  @IsNumber()
  quantity: number;
}

export class ProductCustomizationDto {
  /**
   * IDs de `product.ingredients[].productId` que NO van en esta linea.
   *
   * Son IDs, nunca nombres: el motor de consumo compara contra `insumoId`.
   * Cada valor se valida como cadena con al menos un caracter visible, y por
   * una razon medida: el motor comparaba por substring, y `"lo que sea"`
   * incluye `""`, asi que UNA sola cadena vacia en esta lista anulaba el
   * descuento COMPLETO del item — en silencio, sin un solo error. Si el
   * cliente manda basura, se responde 400 y se ve; no se traga.
   */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/\S/, {
    each: true,
    message:
      'removedIngredients no admite cadenas vacias ni de solo espacios: ' +
      'una sola anula el descuento de inventario del item entero',
  })
  removedIngredients?: string[];

  @ApiProperty({ required: false, type: [AddedExtraDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AddedExtraDto)
  addedExtras?: AddedExtraDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  customizationPrice?: number;
}

export class OrderItemDto {
  @ApiProperty({ example: 'prod123', description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  // name puede venir vacio o ausente en APKs antiguas (pre 1-may-2026)
  // que normalizaban items con productName pero no name. El servicio
  // resuelve el nombre via productName ?? name antes de persistir.
  @ApiProperty({ example: 'Burger', description: 'Product name' })
  @IsNullable()
  @IsString()
  name?: string;

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
    example: 'No onions',
    description: 'Item notes',
    required: false,
  })
  @IsNullable()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, type: ProductCustomizationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductCustomizationDto)
  customizations?: ProductCustomizationDto;

  @ApiProperty({ example: 'KITCHEN', description: 'Station', required: false })
  @IsNullable()
  @IsString()
  station?: string;

  @ApiProperty({
    example: 'Special request',
    description: 'Added by',
    required: false,
  })
  @IsNullable()
  @IsString()
  addedBy?: string;

  @ApiProperty({ required: false })
  @IsNullable()
  @IsString()
  productName?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  totalPrice?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  sentQty?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  addedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  quantityLog?: unknown;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  deliveredQty?: number;

  /**
   * Unidades de esta linea que YA se descontaron del inventario.
   *
   * Tiene que estar declarado aqui o el `whitelist: true` del ValidationPipe
   * global lo borra sin decir nada, y ese borrado silencioso es exactamente
   * lo que provocaba el DOBLE DESCUENTO al convertir a tobo: la linea del
   * pack llega diciendo "estas 12 ya salieron al entregarse", el campo se
   * perdia, el servidor la leia como entrega nueva y reservaba 12 otra vez.
   * Medido el 20/09/2026 pasando el payload real por el pipe real.
   */
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  inventoryConsumedQty?: number;

  /**
   * Unidades que trae el pack (12 el tobo, 18 la media caja, 36 la caja).
   * `normalizePackLines` lo repone si falta, pero se declara igual para que
   * el cliente pueda mandarlo sin que el pipe lo descarte.
   */
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  presentationQty?: number;

  // Tobos mixtos: desglose por variante. Se cobra el tobo completo; esto es
  // solo para inventario y entrega por variante.
  @ApiProperty({ required: false, type: [ToboCompositionEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToboCompositionEntryDto)
  composition?: ToboCompositionEntryDto[];
}

export class CreateOrderDto {
  @ApiProperty({
    example: 'A1B2C3',
    description: 'Order number',
    required: false,
  })
  @IsNullable()
  @IsString()
  orderNumber?: string;

  @ApiProperty({
    example: 'req-abc123',
    description:
      'Idempotency key: reintentos con el mismo id no duplican la orden',
    required: false,
  })
  @IsNullable()
  @IsString()
  clientRequestId?: string;

  @ApiProperty({
    example: 'table123',
    description: 'Table ID',
    required: false,
  })
  @IsNullable()
  @IsString()
  tableId?: string;

  @ApiProperty({
    example: 'waiter123',
    description: 'Waiter ID',
    required: false,
  })
  @IsNullable()
  @IsString()
  waiterId?: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Customer alias',
    required: false,
  })
  @IsNullable()
  @IsString()
  customerAlias?: string;

  @ApiProperty({
    example: 'cust123',
    description: 'Customer ID',
    required: false,
  })
  @IsNullable()
  @IsString()
  customerId?: string;

  @ApiProperty({ example: 'user123', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ required: false, description: 'Waiter display name' })
  @IsNullable()
  @IsString()
  waiterName?: string;

  @ApiProperty({ required: false, description: 'Customer display name' })
  @IsNullable()
  @IsString()
  customerName?: string;

  @ApiProperty({ required: false, description: 'Table display name' })
  @IsNullable()
  @IsString()
  tableName?: string;

  @ApiProperty({ required: false, description: 'Zone sector' })
  @IsNullable()
  @IsString()
  sector?: string;

  @ApiProperty({ required: false, description: 'Associate membership number' })
  @IsNullable()
  @IsString()
  associateNumber?: string;

  @ApiProperty({ required: false, description: 'Order status' })
  @IsNullable()
  @IsString()
  status?: string;

  @ApiProperty({ required: false, description: 'Payment status' })
  @IsNullable()
  @IsString()
  paymentStatus?: string;

  @ApiProperty({ required: false, description: 'Payment method' })
  @IsNullable()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({ required: false, description: 'Is takeaway' })
  @IsBoolean()
  @IsOptional()
  isTakeaway?: boolean;

  @ApiProperty({
    type: [OrderItemDto],
    description: 'Order items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ example: 100, description: 'Subtotal' })
  @IsNumber()
  @IsNotEmpty()
  subtotal: number;

  @ApiProperty({ example: 16, description: 'Tax amount', required: false })
  @IsNumber()
  @IsOptional()
  tax?: number;

  @ApiProperty({ example: 116, description: 'Total amount' })
  @IsNumber()
  @IsNotEmpty()
  total: number;

  @ApiProperty({ example: 10, description: 'Service charge', required: false })
  @IsNumber()
  @IsOptional()
  serviceCharge?: number;

  @ApiProperty({
    example: 'dine-in',
    description: 'Order type',
    required: false,
  })
  @IsNullable()
  @IsString()
  orderType?: string;

  @ApiProperty({
    example: 'Special notes',
    description: 'Notes',
    required: false,
  })
  @IsNullable()
  @IsString()
  notes?: string;

  // ── Campos de verificacion de pago (APK los envia al cobrar) ───────────
  // Sin estos, whitelist:true los stripea y el cajero no ve el detalle en web.

  @ApiProperty({ required: false, description: 'Referencia de pago' })
  @IsNullable()
  @IsString()
  paymentReference?: string;

  @ApiProperty({ required: false, description: 'Tasa BCV del dia del cobro' })
  @IsNullable()
  @IsNumber()
  bcvRate?: number;

  @ApiProperty({ required: false, description: 'Monto en Bs pagado' })
  @IsNullable()
  @IsNumber()
  paymentAmountBs?: number;

  @ApiProperty({ required: false, description: 'URLs de imagenes comprobante' })
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

  @ApiProperty({
    required: false,
    description: 'Array de pagos pendientes por verificar',
  })
  @IsNullable()
  @IsArray()
  pendingPayments?: Array<Record<string, unknown>>;

  @ApiProperty({ required: false, description: 'Pago rechazado' })
  @IsOptional()
  @IsBoolean()
  paymentRejected?: boolean;

  @ApiProperty({ required: false, description: 'Razon rechazo' })
  @IsNullable()
  @IsString()
  paymentRejectionReason?: string;

  @ApiProperty({ required: false, description: 'Fecha rechazo' })
  @IsNullable()
  paymentRejectedAt?: Date;

  @ApiProperty({ required: false, description: 'userId del que rechazo' })
  @IsNullable()
  @IsString()
  paymentRejectedBy?: string;

  @ApiProperty({ required: false, description: 'Monto propina' })
  @IsNullable()
  @IsNumber()
  tipAmount?: number;
}

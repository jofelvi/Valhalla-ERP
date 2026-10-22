import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// ───────── DELIVER (cocina/barra marca "Listo") ─────────
// PATCH /api/orders/:id/items/:itemId/deliver
export class DeliverItemDto {
  // Cantidad a marcar como entregada en esta operacion. Default 1 si no se
  // pasa. Puede ser >1 cuando cocina marca varios al mismo tiempo.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  delta?: number;
}

// ───────── DELIVER STATION (bulk, "Listo todo de cocina") ─────────
// PATCH /api/orders/:id/deliver-station/:station
// Sin body — la accion es "marca como entregadas todas las unidades pendientes
// de esta estacion en esta orden". Idempotente: si ya estaba todo entregado,
// no hace nada.

// ───────── CANCEL (item no entregado, borrado logico) ─────────
// PATCH /api/orders/:id/items/:itemId/cancel
// Solo permitido si deliveredQty == 0. Sin PIN. Para items entregados se
// usa /no-charge en su lugar.
export class CancelItemDto {
  @IsNotEmpty({ message: 'reason es obligatorio para cancelar un item' })
  @IsString()
  reason: string;
}

// ───────── NO-CHARGE (cortesia) ─────────
// PATCH /api/orders/:id/items/:itemId/no-charge
// Item permanece en factura para inventario y trackeo, pero precio no suma
// al subtotal cobrado. PIN admin OBLIGATORIO siempre.
export class NoChargeItemDto {
  @IsNotEmpty({ message: 'reason es obligatorio para aplicar cortesia' })
  @IsString()
  reason: string;

  @IsNotEmpty({ message: 'PIN admin es obligatorio para cortesia' })
  @IsString()
  adminPin: string;

  // De quien fue el error que se esta invitando. NO cambia el dinero (el
  // mesonero conserva su comision); se registra para poder medir de donde
  // salen las cortesias. Opcional para no romper clientes viejos.
  @IsOptional()
  @IsIn(['COCINA', 'BARRA', 'MESONERO', 'CASA'])
  responsible?: 'COCINA' | 'BARRA' | 'MESONERO' | 'CASA';
}

// ───────── Tipo helper para responses ─────────
export interface ItemActionResult {
  success: true;
  orderId: string;
  itemId: string;
  // Snapshot del item luego del cambio
  item: {
    productId: string;
    name?: string;
    quantity: number;
    deliveredQty: number;
    cancelledAt?: Date | null;
    noCharge?: boolean;
  };
  // Totales recalculados
  subtotal: number;
  serviceCharge: number;
  total: number;
}

// ───────── DISCOUNT (rebaja parcial de una linea, PIN admin) ─────────
// PATCH  /api/orders/:id/items/:itemId/discount
// DELETE /api/orders/:id/items/:itemId/discount
export class DiscountItemDto {
  // 'PCT' = porcentaje de la linea; 'AMOUNT' = monto fijo en USD.
  @IsIn(['PCT', 'AMOUNT'])
  type: 'PCT' | 'AMOUNT';

  @IsNumber()
  @Min(0.01)
  value: number;

  // Obligatorio: sin motivo una rebaja es plata que se fue sin explicacion.
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  adminPin: string;
}

export class RemoveItemDiscountDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  adminPin: string;
}

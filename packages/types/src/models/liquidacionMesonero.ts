/**
 * Modelo de Liquidacion de Mesonero
 *
 * Representa un periodo de trabajo de un mesonero.
 * NO es date-based (a diferencia de AlmacenDiario) — es session-based
 * para soportar turnos que pueden cruzar 2+ dias calendario.
 *
 * Regla de negocio:
 * - serviceCharge = subtotal * 0.10
 * - comisionMesonero = serviceCharge * 0.50 (= 5% del subtotal)
 * - participacionRestaurante = serviceCharge * 0.50 (= 5% del subtotal)
 */

export type EstadoLiquidacion = 'abierta' | 'cerrada';

export interface OrdenLiquidacionRef {
  orderId: string;
  subtotal: number;
  serviceCharge: number;
  timestamp: Date;
}

export interface ResumenLiquidacion {
  totalOrdenes: number;
  totalSubtotal: number;
  totalServiceCharge: number;
  comisionMesonero: number; // serviceCharge * 0.50
  participacionRestaurante: number; // serviceCharge * 0.50
}

export interface LiquidacionMesonero {
  id: string;
  waiterId: string;
  waiterName: string;
  estado: EstadoLiquidacion;
  horaApertura: Date;
  horaCierre?: Date;
  ordenesRef: OrdenLiquidacionRef[];
  resumen?: ResumenLiquidacion;
  usuarioApertura: string; // userId de quien abrio
  usuarioCierre?: string; // userId de quien cerro
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
  // Pago de comision al mesonero
  comisionPagada?: boolean; // Si ya se le entrego el 5% al mesonero
  pagoComisionId?: string; // ID del PagoComision que cubre esta sesion
  fechaPago?: Date; // Cuando se registro el pago
  usuarioPago?: string; // ID del usuario que registro el pago
}

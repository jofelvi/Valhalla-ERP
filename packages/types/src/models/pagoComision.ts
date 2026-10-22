/**
 * Pago de comision a un mesonero.
 *
 * Junta las ordenes pagadas sin liquidar del mesonero y le abona la comision
 * (`serviceCharge`) mas la propina (`tipAmount`) de cada una. El modulo de
 * "liquidaciones" que existia antes se elimino: nunca se uso (3 documentos de
 * febrero) y ningun pago de comision llego a referenciarlo.
 */

import type { CommissionBasis } from '../config/nomina';

export interface PagoComision {
  id: string;
  waiterId: string;
  waiterName: string;
  orderIds: string[]; // IDs de ordenes cubiertas por este pago
  montoTotal: number; // suma de comisionMesonero
  tipTotal?: number; // suma de propinas de las ordenes cubiertas
  sesionesCubiertas: number; // cantidad de sesiones (historico) u ordenes
  periodoDesde: Date; // fecha de la orden/sesion mas antigua
  periodoHasta: Date; // fecha de la orden/sesion mas reciente
  fechaPago: Date; // cuando se registro el pago
  usuarioPago: string; // userId de quien registro el pago
  notas?: string;
  createdAt: Date;
  comisionPct?: number;
  /** Fracción de la base usada para este pago (0.07 = 7 %) y base sobre la que se calculó. */
  commissionRate?: number;
  commissionBasis?: CommissionBasis;
  descuentos?: number;
  descuentosDetalle?: string;
  montoNeto?: number;
  diasAsistidos?: number;
  bonoAsistencia?: number;
}

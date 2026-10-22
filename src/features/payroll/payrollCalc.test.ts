import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NOMINA_DEFAULT, type NominaConfig } from '@odin6/types';
import {
  weeklySalary,
  staffDailyRate,
  weekCommission,
  weekTips,
  consumoNet,
  staffDebt,
  payrollSettlement,
  rowNet,
  grossPay,
  finalNet,
  isWaiterRole,
} from './payrollCalc.ts';

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.equal(actual, expected);
    },
    toBeCloseTo(expected: number, precision: number = 2) {
      const diff = Math.abs((actual as unknown as number) - expected);
      assert.ok(
        diff <= Math.pow(10, -precision) || diff < 0.005,
        `Expected ${actual} to be close to ${expected} (diff: ${diff})`,
      );
    },
  };
}

/** Nómina de prueba: solo cambia lo que la prueba necesita; el resto es la configuración neutra. */
function nominaCon(
  commissionRate: number,
  extra: Partial<NominaConfig> = {},
): NominaConfig {
  return { ...NOMINA_DEFAULT, commissionRate, ...extra };
}

describe('payrollCalc', () => {
  it('weeklySalary divide el salario mensual entre 4', () => {
    expect(weeklySalary(2000)).toBe(500);
    expect(weeklySalary(0)).toBe(0);
    expect(weeklySalary(undefined)).toBe(0);
  });

  it('staffDailyRate = (salario/4)/7', () => {
    expect(staffDailyRate(2800)).toBe(100);
  });

  it('weekCommission aplica la tasa de nómina sobre comisionBase', () => {
    const orders = [{ comisionBase: 20 }, { comisionBase: 30 }];
    expect(weekCommission(orders, nominaCon(0.07))).toBeCloseTo(3.5, 3);
    expect(weekCommission(orders, nominaCon(0.1))).toBeCloseTo(5, 3);
  });

  it('weekCommission ignora serviceCharge: la base es comisionBase', () => {
    expect(
      weekCommission([{ serviceCharge: 50, comisionBase: 10 }], nominaCon(0.1)),
    ).toBeCloseTo(1, 3);
  });

  it('weekCommission sin comisionBase no genera comisión', () => {
    expect(weekCommission([{ serviceCharge: 2 }], nominaCon(0.1))).toBe(0);
  });

  it('weekCommission respeta la base que trae la orden (cortesía fuera)', () => {
    // Cortesia/socio: comisionBase = 0 → no genera comision.
    expect(weekCommission([{ comisionBase: 0 }], nominaCon(0.1))).toBe(0);
    // Cortesia parcial: la comision va sobre lo que trae comisionBase.
    expect(weekCommission([{ comisionBase: 1.2 }], nominaCon(0.1))).toBeCloseTo(
      0.12,
      3,
    );
  });

  it('weekTips suma tipAmount', () => {
    expect(weekTips([{ tipAmount: 3 }, { tipAmount: 0 }, {}])).toBe(3);
  });

  it('ordenes traspasadas: comision y propina se dividen por el share del mesonero', () => {
    const shared = {
      comisionBase: 10,
      tipAmount: 5,
      waiterShares: [
        { waiterId: 'A', pct: 60 },
        { waiterId: 'B', pct: 40 },
      ],
    };
    const normal = { comisionBase: 20, tipAmount: 1 };
    const nomina = nominaCon(0.1);
    // A: 60% de la base compartida + orden normal completa
    expect(weekCommission([shared, normal], nomina, 'A')).toBeCloseTo(
      (10 * 0.6 + 20) * 0.1,
      3,
    );
    expect(weekTips([shared, normal], 'A')).toBeCloseTo(5 * 0.6 + 1, 3);
    // B: solo su 40% de la compartida
    expect(weekCommission([shared], nomina, 'B')).toBeCloseTo(0.4, 3);
    expect(weekTips([shared], 'B')).toBeCloseTo(2, 3);
    // Mesonero sin share en la orden compartida: no suma nada
    expect(weekCommission([shared], nomina, 'C')).toBe(0);
    expect(weekTips([shared], 'C')).toBe(0);
    // Sin userId: comportamiento previo (100%)
    expect(weekCommission([normal], nomina)).toBeCloseTo(2, 3);
  });

  it('consumoNet = base × (1 − descuento de empleado) − abonado', () => {
    expect(consumoNet({ amount: 12.65, paidAmount: 0 }, 11.5)).toBeCloseTo(
      10.35,
      2,
    );
    expect(consumoNet({ amount: 10, paidAmount: 0 }, undefined)).toBeCloseTo(
      9,
      2,
    );
    expect(consumoNet({ amount: 12.65, paidAmount: 2 }, 11.5)).toBeCloseTo(
      8.35,
      2,
    );
    expect(consumoNet({ amount: 1, paidAmount: 100 }, 1)).toBe(0);
    // El descuento viene de la configuración, no de una constante.
    expect(
      consumoNet(
        { amount: 10, paidAmount: 0 },
        10,
        nominaCon(0.07, { employeeDiscountRate: 0.2 }),
      ),
    ).toBeCloseTo(8, 2);
  });

  it('staffDebt = base × (1 − descuento) (sin servicio); cae al amount si no hay base', () => {
    // Orden real: subtotal 2.5 (+ servicio = amount 2.75) → empleado debe 2.25 con 10 %
    expect(staffDebt({ amount: 2.75 }, 2.5)).toBeCloseTo(2.25, 2);
    expect(staffDebt({ amount: 1.65 }, 1.5)).toBeCloseTo(1.35, 2);
    // Sin base conocida usa el amount como último recurso
    expect(staffDebt({ amount: 10 }, undefined)).toBeCloseTo(9, 2);
    // Con un negocio que no descuenta a su personal
    expect(
      staffDebt(
        { amount: 10 },
        10,
        nominaCon(0.07, { employeeDiscountRate: 0 }),
      ),
    ).toBe(10);
  });

  describe('payrollSettlement', () => {
    it('abono que no cubre el saldo deja la cuenta parcial, no saldada', () => {
      // Caso real: cuenta de $7.32 con descuento sugerido de $5.99
      const r = payrollSettlement({ amount: 7.32, paidAmount: 0 }, 5.99);
      expect(r.paidAmount).toBeCloseTo(5.99, 2);
      expect(r.balance).toBeCloseTo(1.33, 2);
      expect(r.isSettled).toBe(false);
    });

    it('cobrar el monto completo salda la cuenta', () => {
      const r = payrollSettlement({ amount: 7.32, paidAmount: 0 }, 7.32);
      expect(r.paidAmount).toBeCloseTo(7.32, 2);
      expect(r.balance).toBe(0);
      expect(r.isSettled).toBe(true);
    });

    it('el abono se acumula sobre lo ya pagado', () => {
      const r = payrollSettlement({ amount: 20, paidAmount: 12 }, 5);
      expect(r.paidAmount).toBeCloseTo(17, 2);
      expect(r.balance).toBeCloseTo(3, 2);
      expect(r.isSettled).toBe(false);
    });

    it('nunca aplica mas que el saldo pendiente', () => {
      const r = payrollSettlement({ amount: 20, paidAmount: 18 }, 50);
      expect(r.applied).toBeCloseTo(2, 2);
      expect(r.paidAmount).toBe(20);
      expect(r.isSettled).toBe(true);
    });

    it('abono invalido o negativo no mueve la cuenta', () => {
      expect(
        payrollSettlement({ amount: 10, paidAmount: 3 }, -5).paidAmount,
      ).toBe(3);
      expect(
        payrollSettlement({ amount: 10, paidAmount: 3 }, NaN).applied,
      ).toBe(0);
    });

    it('cuenta ya saldada no cambia', () => {
      const r = payrollSettlement({ amount: 10, paidAmount: 10 }, 5);
      expect(r.applied).toBe(0);
      expect(r.isSettled).toBe(true);
    });

    it('consumo de personal: se salda contra la deuda real (target), no contra el amount', () => {
      // AR creada al precio de cliente 2.75 (subtotal 2.5 + 10% servicio). El
      // empleado debe 2.25 (staffDebt). Al pagar 2.25 la cuenta se DA POR
      // SALDADA aunque amount sea 2.75 — el 0.50 fantasma no es su deuda.
      const r = payrollSettlement({ amount: 2.75, paidAmount: 0 }, 2.25, 2.25);
      expect(r.paidAmount).toBeCloseTo(2.25, 2);
      expect(r.applied).toBeCloseTo(2.25, 2);
      expect(r.balance).toBe(0);
      expect(r.isSettled).toBe(true);
    });

    it('consumo de personal: nunca retiene mas que la deuda de personal (target)', () => {
      // Aunque el amount sea 2.75, con target 2.25 no se puede aplicar de mas.
      const r = payrollSettlement({ amount: 2.75, paidAmount: 0 }, 10, 2.25);
      expect(r.applied).toBeCloseTo(2.25, 2);
      expect(r.isSettled).toBe(true);
    });

    it('consumo de personal ya pagado en su parte: target cubierto → saldada, applied 0', () => {
      // Caso CONS consolidada: pagó 80.24 y su deuda real es 80.24; el amount
      // 96.39 (con servicio) no debe reabrir la cuenta.
      const r = payrollSettlement(
        { amount: 96.39, paidAmount: 80.24 },
        0,
        80.24,
      );
      expect(r.applied).toBe(0);
      expect(r.isSettled).toBe(true);
    });
  });

  it('rowNet mesonero = dias×monto + comision + propina − consumos', () => {
    expect(
      rowNet({ earnings: 15, commissions: 4, tips: 2, consumos: 10.35 }),
    ).toBeCloseTo(10.65, 2);
  });

  it('rowNet nunca negativo', () => {
    expect(rowNet({ earnings: 5, commissions: 0, tips: 0, consumos: 99 })).toBe(
      0,
    );
  });

  it('isWaiterRole detecta mesoneros', () => {
    expect(isWaiterRole('WAITER')).toBe(true);
    expect(isWaiterRole('waiter')).toBe(true);
    expect(isWaiterRole('ADMIN')).toBe(false);
  });

  it('grossPay = ingresos + comisiones + propinas + adiciones (redondeado)', () => {
    expect(
      grossPay({
        earnings: 15,
        commissions: 4.205,
        tips: 2,
        adjustmentsAdd: 1.1,
      }),
    ).toBe(22.31);
    expect(
      grossPay({ earnings: 0, commissions: 0, tips: 0, adjustmentsAdd: 0 }),
    ).toBe(0);
  });

  it('finalNet = neto + adiciones − deducciones − externas (redondeado, paridad con el inline)', () => {
    // Réplica exacta del cálculo inline de WeeklyPayrollRow.tsx:149-153
    expect(
      finalNet({
        net: 10.65,
        adjustmentsAdd: 5,
        adjustmentsDed: 3,
        externalTotal: 2.5,
      }),
    ).toBe(10.15);
  });

  it('el abono de préstamo SE RESTA del neto', () => {
    // El caso que reportó el dueño el 21/09/2026, con sus números:
    // Daniel, 7 días × $8,93 = $62,51, bono de pizza +$4,70, y un abono de
    // $20 sobre un préstamo de $100. La pantalla mostraba la línea
    // "Abono préstamo: prestamo moto −$20,00" y abajo "Neto a pagar $67,21",
    // que es exactamente 62,51 + 4,70: el abono se dibujaba y no se restaba.
    //
    // No era solo cosmético: al confirmar, el préstamo SÍ quedaba abonado
    // ($100 → $80) mientras al empleado se le pagaba completo. El negocio
    // perdía los $20 dos veces — no los retenía y los daba por cobrados.
    expect(
      finalNet({
        net: 62.51,
        adjustmentsAdd: 4.7,
        adjustmentsDed: 0,
        externalTotal: 0,
        loansTotal: 20,
      }),
    ).toBe(47.21);
  });

  it('sin préstamos, el neto no cambia (no rompe lo que ya andaba)', () => {
    expect(
      finalNet({
        net: 62.51,
        adjustmentsAdd: 4.7,
        adjustmentsDed: 0,
        externalTotal: 0,
      }),
    ).toBe(67.21);
  });

  it('varios préstamos se restan todos', () => {
    expect(
      finalNet({
        net: 100,
        adjustmentsAdd: 0,
        adjustmentsDed: 0,
        externalTotal: 0,
        loansTotal: 20 + 15.5,
      }),
    ).toBe(64.5);
  });

  it('el abono convive con las otras deducciones sin pisarlas', () => {
    expect(
      finalNet({
        net: 100,
        adjustmentsAdd: 10,
        adjustmentsDed: 5,
        externalTotal: 2.5,
        loansTotal: 20,
      }),
    ).toBe(82.5);
  });
});

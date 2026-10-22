// Test del módulo cobro.ts — Funciones puras de cálculo
// CRITICO: Estos casos fijan el comportamiento exacto del cálculo de dinero.
// Cualquier cambio en estos tests = cambio en la lógica de cobro.
// Runner: node --experimental-strip-types --test (node:test + node:assert/strict)

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  calculateTotalPaid,
  calculateTotalPaidInBs,
  isPaymentComplete,
  calculateSelectedReceivablesTotal,
  getTotalCardAmount,
  calculateChangeBs,
  calculateChangeUsd,
  getPaymentExcess,
  TOLERANCIA_BS,
  hayVuelto,
  faltaPorPagarBs,
  montoRestantePorPagar,
  isReallyFullyPaid,
} from './cobro.ts';
import { PaymentMethodEnum } from '@odin6/types';

// Helper: construye el Record completo de montos con vacíos por defecto
const montos = (
  parciales: Partial<Record<PaymentMethodEnum, string>>,
): Record<PaymentMethodEnum, string> => ({
  [PaymentMethodEnum.CASH_BS]: '',
  [PaymentMethodEnum.CASH_USD]: '',
  [PaymentMethodEnum.CARD]: '',
  [PaymentMethodEnum.TRANSFER]: '',
  [PaymentMethodEnum.PAGO_MOVIL]: '',
  [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: '',
  [PaymentMethodEnum.MIXED]: '',
  [PaymentMethodEnum.PENDING]: '',
  [PaymentMethodEnum.PAYROLL_DEDUCTION]: '',
  ...parciales,
});

describe('cobro.ts - funciones puras de cálculo de dinero', () => {
  describe('calculateTotalPaid', () => {
    test('calcula total en USD sin tasa (solo monedas USD)', () => {
      const amounts = montos({
        [PaymentMethodEnum.CASH_USD]: '10.50',
        [PaymentMethodEnum.TRANSFER]: '5.25',
        [PaymentMethodEnum.PAGO_MOVIL]: '2.75',
      });
      assert.equal(calculateTotalPaid(amounts, 0), 18.5);
    });

    test('convierte Bs a USD cuando bcvRate > 0', () => {
      const amounts = montos({ [PaymentMethodEnum.CASH_BS]: '1000' });
      // 1000 Bs / 50 = 20 USD
      assert.equal(calculateTotalPaid(amounts, 50), 20);
    });

    test('suma el punto de venta (tarjeta) cuando es el unico metodo', () => {
      // Bug 18/09: la tarjeta vive en cardPayments, no en paymentAmounts, y
      // esta funcion no la recibia. Un cobro SOLO con punto contaba $0 y el
      // boton quedaba en 'Ingrese un monto'; en un cobro mixto la orden podia
      // quedar PARCIAL estando cubierta. 2000 Bs / 50 = 40 USD.
      const amounts = montos({});
      assert.equal(calculateTotalPaid(amounts, 50, 2000), 40);
    });

    test('suma tarjeta + efectivo en un cobro mixto', () => {
      const amounts = montos({ [PaymentMethodEnum.CASH_USD]: '5' });
      // 5 USD + 1000 Bs / 50 = 5 + 20 = 25 USD
      assert.equal(calculateTotalPaid(amounts, 50, 1000), 25);
    });
  });

  describe('calculateTotalPaidInBs', () => {
    test('calcula total en Bs sin tarjeta', () => {
      const amounts = montos({
        [PaymentMethodEnum.CASH_BS]: '5000',
        [PaymentMethodEnum.CASH_USD]: '10',
      });
      // 5000 Bs + (10 USD * 50) = 5500
      assert.equal(calculateTotalPaidInBs(amounts, 50, 0), 5500);
    });

    test('incluye montos de tarjeta en Bs', () => {
      const amounts = montos({ [PaymentMethodEnum.CASH_BS]: '1000' });
      // 1000 Bs + 2000 Bs de tarjeta = 3000
      assert.equal(calculateTotalPaidInBs(amounts, 50, 2000), 3000);
    });
  });

  describe('isPaymentComplete', () => {
    test('true cuando el pago cubre exactamente', () => {
      const amounts = montos({ [PaymentMethodEnum.CASH_BS]: '1000' });
      // 1000 Bs / 50 = 20 USD, exactamente lo que falta
      assert.equal(isPaymentComplete(amounts, 50, 20, 0), true);
    });

    test('false cuando el pago es insuficiente', () => {
      const amounts = montos({ [PaymentMethodEnum.CASH_BS]: '500' });
      // 500 Bs / 50 = 10 USD, falta 10 USD
      assert.equal(isPaymentComplete(amounts, 50, 20, 0), false);
    });

    test('aplica tolerancia de 2 Bs en conversiones', () => {
      const amounts = montos({ [PaymentMethodEnum.CASH_BS]: '1001' });
      // 1001 Bs vs 1000 Bs debidos, dentro de tolerancia
      assert.equal(isPaymentComplete(amounts, 50, 20, 0), true);
    });
  });

  describe('getTotalCardAmount', () => {
    test('suma todos los montos de tarjetas', () => {
      const cardPayments = [
        { amount: '500', reference: 'REF001' },
        { amount: '300', reference: 'REF002' },
        { amount: '200', reference: 'REF003' },
      ];
      assert.equal(getTotalCardAmount(cardPayments), 1000);
    });

    test('ignora montos vacíos', () => {
      const cardPayments = [
        { amount: '500', reference: 'REF001' },
        { amount: '', reference: 'REF002' },
        { amount: '250', reference: 'REF003' },
      ];
      assert.equal(getTotalCardAmount(cardPayments), 750);
    });
  });

  describe('calculateChangeBs / calculateChangeUsd', () => {
    test('calcula cambio positivo en Bs', () => {
      // 1000 - (15 * 50) = 250
      assert.equal(calculateChangeBs(1000, 15, 50), 250);
    });

    test('retorna negativo cuando falta dinero', () => {
      // 500 - (20 * 50) = -500
      assert.equal(calculateChangeBs(500, 20, 50), -500);
    });

    test('convierte cambio en Bs a USD', () => {
      // 250 Bs / 50 = 5 USD
      assert.equal(calculateChangeUsd(250, 50), 5);
    });
  });

  describe('getPaymentExcess', () => {
    test('detecta exceso de pago mayor que tolerancia', () => {
      // Exceso 20 USD, tolerancia max(1, 30*0.02)=1, 20 > 1
      assert.equal(getPaymentExcess(50, 30), 20);
    });

    test('permite pequeño exceso (tolerancia 2%)', () => {
      // Exceso 0.50 USD, tolerancia max(1, 30*0.02)=1, 0.50 < 1
      assert.equal(getPaymentExcess(30.5, 30), 0);
    });

    test('tolerancia mínima de 1 USD', () => {
      // Exceso 0.50 USD, tolerancia max(1, 10*0.02)=1, 0.50 < 1
      assert.equal(getPaymentExcess(10.5, 10), 0);
    });
  });

  describe('calculateSelectedReceivablesTotal', () => {
    test('suma cuentas por cobrar seleccionadas', () => {
      const selected = new Set(['1', '3']);
      const receivables = [
        { id: '1', amount: 100, paidAmount: 20 }, // pendiente 80
        { id: '2', amount: 50, paidAmount: 50 }, // no seleccionada
        { id: '3', amount: 200, paidAmount: 0 }, // pendiente 200
      ];
      // 80 + 200 = 280
      assert.equal(
        calculateSelectedReceivablesTotal(selected, receivables),
        280,
      );
    });

    test('retorna 0 si ninguna está seleccionada', () => {
      const selected = new Set<string>();
      const receivables = [{ id: '1', amount: 100, paidAmount: 0 }];
      assert.equal(calculateSelectedReceivablesTotal(selected, receivables), 0);
    });
  });

  describe('hayVuelto / faltaPorPagarBs (tolerancia única)', () => {
    test('no hay vuelto dentro de la tolerancia', () => {
      assert.equal(hayVuelto(TOLERANCIA_BS), false); // exacto en el borde
      assert.equal(hayVuelto(1.5), false);
    });

    test('hay vuelto cuando el sobrepago supera la tolerancia', () => {
      assert.equal(hayVuelto(TOLERANCIA_BS + 0.01), true);
      assert.equal(hayVuelto(250), true);
    });

    test('faltaPorPagarBs devuelve 0 dentro de la tolerancia', () => {
      // Debe 1000 Bs, pagó 999 → falta 1 Bs, dentro de tolerancia
      assert.equal(faltaPorPagarBs(1000, 999), 0);
      assert.equal(faltaPorPagarBs(1000, 998), 0); // borde exacto (diff = 2)
    });

    test('faltaPorPagarBs reporta el faltante por encima de la tolerancia', () => {
      // Debe 1000 Bs, pagó 500 → faltan 500 Bs
      assert.equal(faltaPorPagarBs(1000, 500), 500);
    });
  });

  describe('montoRestantePorPagar (base remainingToPay, no totalWithTip)', () => {
    test('sin pagos previos: autocompleta el total en Bs', () => {
      // remainingToPay 20 USD, tasa 50, nada ingresado en sesión → 1000 Bs
      const bs = montoRestantePorPagar({
        remainingToPay: 20,
        totalSesionUsd: 0,
        totalSesionBs: 0,
        bcvRate: 50,
        enBolivares: true,
      });
      assert.equal(bs, 1000);
    });

    test('con pagos previos NO autocompleta de más (el bug de 07/09)', () => {
      // Total con propina 20 USD, pero ya se pagaron 15 USD antes →
      // remainingToPay = 5 USD. El default debe ser 5 USD, no 20.
      const usd = montoRestantePorPagar({
        remainingToPay: 5,
        totalSesionUsd: 0,
        totalSesionBs: 0,
        bcvRate: 50,
        enBolivares: false,
      });
      assert.equal(usd, 5);
      // En Bs: 5 * 50 = 250, no 1000.
      const bs = montoRestantePorPagar({
        remainingToPay: 5,
        totalSesionUsd: 0,
        totalSesionBs: 0,
        bcvRate: 50,
        enBolivares: true,
      });
      assert.equal(bs, 250);
    });

    test('descuenta lo ya ingresado en la sesión', () => {
      // Falta 20 USD (1000 Bs); ya se ingresaron 300 Bs en esta sesión → 700 Bs
      const bs = montoRestantePorPagar({
        remainingToPay: 20,
        totalSesionUsd: 6,
        totalSesionBs: 300,
        bcvRate: 50,
        enBolivares: true,
      });
      assert.equal(bs, 700);
      // En USD: 20 - 6 = 14
      const usd = montoRestantePorPagar({
        remainingToPay: 20,
        totalSesionUsd: 6,
        totalSesionBs: 300,
        bcvRate: 50,
        enBolivares: false,
      });
      assert.equal(usd, 14);
    });

    test('sin tasa (bcvRate 0) el monto en Bs es 0', () => {
      const bs = montoRestantePorPagar({
        remainingToPay: 20,
        totalSesionUsd: 0,
        totalSesionBs: 0,
        bcvRate: 0,
        enBolivares: true,
      });
      assert.equal(bs, 0);
    });
  });

  describe('isReallyFullyPaid', () => {
    test('true cuando el pago cubre exactamente el total debido', () => {
      // Orden $20 + propina $2 + CxC $10 = $32 debido; pagado $32
      assert.equal(isReallyFullyPaid(32, 32), true);
    });

    test('true dentro de la tolerancia de $0.50', () => {
      // Debido $32, pagado $31.60 (diff $0.40 <= $0.50)
      assert.equal(isReallyFullyPaid(31.6, 32), true);
    });

    test('false cuando el pago solo cubre la orden pero no las cuentas por cobrar seleccionadas', () => {
      // Orden $20 + CxC $10 = $30 debido; pagó $20 (cubre la orden sola pero faltan los $10 de CxC)
      assert.equal(isReallyFullyPaid(20, 30), false);
    });

    test('false cuando el faltante supera la tolerancia', () => {
      // Debido $20, pagado $19.40 (diff $0.60 > $0.50)
      assert.equal(isReallyFullyPaid(19.4, 20), false);
    });
  });
});

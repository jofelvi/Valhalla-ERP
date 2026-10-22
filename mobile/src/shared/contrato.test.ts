import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOMINA_DEFAULT,
  TARIFAS_DEFAULT,
  calcularComision,
  calcularServiceCharge,
  computeOrderTotals,
} from './contrato.ts';

const linea = (total: number, extra: Record<string, unknown> = {}) => ({
  total,
  ...extra,
});

test('servicio adicional del 10 % solo con mesonero (valores neutros)', () => {
  const con = computeOrderTotals([linea(100)], true);
  assert.equal(con.serviceCharge, 10);
  assert.equal(con.total, 110);
  const sin = computeOrderTotals([linea(100)], false);
  assert.equal(sin.serviceCharge, 0);
  assert.equal(sin.total, 100);
});

test('la tarifa configurada reemplaza al 10 %', () => {
  const tarifas = { ...TARIFAS_DEFAULT, serviceRate: 0.15 };
  const t = computeOrderTotals([linea(200)], true, tarifas);
  assert.equal(t.serviceCharge, 30);
  assert.equal(t.total, 230);
  assert.equal(t.tasaServicio, 0.15);
});

test('modo none no cobra servicio aunque haya mesonero', () => {
  const tarifas = { ...TARIFAS_DEFAULT, serviceMode: 'none' as const };
  assert.equal(
    computeOrderTotals([linea(100)], true, tarifas).serviceCharge,
    0,
  );
});

test('modo included no suma el servicio y lo informa', () => {
  const tarifas = { ...TARIFAS_DEFAULT, serviceMode: 'included' as const };
  const t = computeOrderTotals([linea(110)], true, tarifas);
  assert.equal(t.serviceCharge, 0);
  assert.equal(t.total, 110);
  assert.ok(t.servicioIncluido > 0);
});

test('serviceOnlyWithWaiter = false cobra servicio también sin mesonero', () => {
  const tarifas = { ...TARIFAS_DEFAULT, serviceOnlyWithWaiter: false };
  assert.equal(calcularServiceCharge(100, false, tarifas), 10);
});

test('impuesto sumado solo si está activo', () => {
  const sumado = {
    ...TARIFAS_DEFAULT,
    tax: {
      ...TARIFAS_DEFAULT.tax,
      enabled: true,
      includedInPrice: false,
      rate: 0.16,
    },
  };
  const t = computeOrderTotals([linea(100)], false, sumado);
  assert.equal(t.tax, 16);
  assert.equal(t.total, 116);
  assert.equal(computeOrderTotals([linea(100)], false).tax, 0);
});

test('cortesías y descuentos: el servicio sale sobre lo que se paga', () => {
  const t = computeOrderTotals(
    [
      linea(100),
      linea(50, { noCharge: true }),
      linea(20, { discountAmount: 10 }),
    ],
    true,
  );
  assert.equal(t.noChargeAmount, 50);
  assert.equal(t.discountAmount, 10);
  // base del servicio = subtotal (170) - descuento (10) = 160 -> 16
  assert.equal(t.serviceCharge, 16);
});

test('la comisión sale de calcularComision con la tasa de nómina, no con un 10 % fijo', () => {
  const t = computeOrderTotals([linea(1000)], true);
  assert.equal(t.comisionBase, 1000);
  assert.equal(calcularComision(t.comisionBase, NOMINA_DEFAULT), 70);
  assert.equal(
    calcularComision(t.comisionBase, {
      ...NOMINA_DEFAULT,
      commissionRate: 0.1,
    }),
    100,
  );
});

test('las líneas canceladas no cuentan', () => {
  const t = computeOrderTotals(
    [linea(100), linea(40, { cancelledAt: '2026-10-21' })],
    false,
  );
  assert.equal(t.subtotal, 100);
});

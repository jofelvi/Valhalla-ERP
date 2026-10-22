import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { computeOrderTotals } from '@odin6/types';

/**
 * Paridad del dinero: los casos de packages/types/src/rules/money.fixtures.json
 * son el contrato de computeOrderTotals. La API y la web lo importan del
 * paquete; el APK debe reusar el mismo JSON cuando tenga su prueba.
 *
 * Reglas que fijan: la cortesia NO baja el servicio (la factura queda intacta)
 * pero SI sale de la base de comision; el descuento baja las dos; lo cancelado
 * no cuenta; el redondeo es a centavos, mitad hacia arriba.
 */
interface ParityCase {
  name: string;
  items: Parameters<typeof computeOrderTotals>[0];
  hadServiceCharge: boolean;
  expected: Record<string, number>;
}

const cases = JSON.parse(
  readFileSync(
    new URL(
      '../../../packages/types/src/rules/money.fixtures.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as ParityCase[];

describe('computeOrderTotals contra los casos de paridad', () => {
  for (const c of cases) {
    test(c.name, () => {
      const got = computeOrderTotals(
        c.items,
        c.hadServiceCharge,
      ) as unknown as Record<string, number>;
      for (const [campo, esperado] of Object.entries(c.expected)) {
        assert.ok(
          Math.abs(got[campo] - esperado) < 0.005,
          `${campo}: esperado ${esperado}, dio ${got[campo]}`,
        );
      }
    });
  }
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  totalPagadoUsd,
  totalPagadoBs,
  pagoCompleto,
  validarTechoMoneda,
} from './cobroMobile.ts';

describe('cobroMobile.ts - cálculos y decisiones de cobro móvil', () => {
  describe('totalPagadoUsd', () => {
    test('con bcvRate > 0 convierte Bs a USD usando bsToUsd', () => {
      const entries = [
        { method: 'CASH_BS', amount: '1000' }, // 1000 / 50 = 20 USD
        { method: 'CASH_USD', amount: '10' }, // 10 USD
      ];
      assert.equal(totalPagadoUsd(entries, 50), 30);
    });

    test('con bcvRate <= 0 NO suma montos en Bs como USD', () => {
      const entries = [
        { method: 'CASH_BS', amount: '5000' },
        { method: 'PAGO_MOVIL', amount: '3000' },
        { method: 'CASH_USD', amount: '15' },
      ];
      // Solo debe sumar los 15 USD, nunca 8015 USD
      assert.equal(totalPagadoUsd(entries, 0), 15);
      assert.equal(totalPagadoUsd(entries, -1), 15);
    });

    test('filtra solo confirmados si onlyConfirmed = true', () => {
      const entries = [
        { method: 'CASH_USD', amount: '10', confirmed: true },
        { method: 'CASH_USD', amount: '20', confirmed: false },
      ];
      assert.equal(totalPagadoUsd(entries, 50, true), 10);
      assert.equal(totalPagadoUsd(entries, 50, false), 30);
    });
  });

  describe('totalPagadoBs', () => {
    test('suma montos en Bs y convierte USD a Bs con tasa', () => {
      const entries = [
        { method: 'CASH_BS', amount: '500' },
        { method: 'CASH_USD', amount: '10' }, // 10 * 50 = 500 Bs
      ];
      assert.equal(totalPagadoBs(entries, 50), 1000);
    });

    test('sin tasa solo suma los montos en Bs', () => {
      const entries = [
        { method: 'CASH_BS', amount: '500' },
        { method: 'CASH_USD', amount: '10' },
      ];
      assert.equal(totalPagadoBs(entries, 0), 500);
    });
  });

  describe('pagoCompleto', () => {
    test('true cuando el total pagado en Bs cubre el total debido', () => {
      const entries = [{ method: 'CASH_BS', amount: '1000' }];
      // 1000 Bs con tasa 50 para orden de 20 USD (debido 1000 Bs)
      assert.equal(pagoCompleto(entries, 50, 20), true);
    });

    test('false si no alcanza el total', () => {
      const entries = [{ method: 'CASH_BS', amount: '800' }];
      assert.equal(pagoCompleto(entries, 50, 20), false);
    });

    test('false si bcvRate <= 0 (no se puede verificar)', () => {
      const entries = [{ method: 'CASH_USD', amount: '20' }];
      assert.equal(pagoCompleto(entries, 0, 20), false);
    });
  });

  describe('validarTechoMoneda', () => {
    test('rechaza montos que superan ampliamente el total de la orden (parece bolívares en USD)', () => {
      // Orden de $20, entra un pago de $5000 (claramente bolívares) -> 5000/20 = 250 > 20
      const resultado = validarTechoMoneda(5000, 20);
      assert.equal(resultado.error, true);
      assert.ok(resultado.mensaje?.includes('parece estar en bolívares'));
    });

    test('acepta montos razonables de la orden', () => {
      const resultado = validarTechoMoneda(20, 20);
      assert.equal(resultado.error, false);
    });

    test('permite propinas o excedentes moderados (hasta 20x)', () => {
      const resultado = validarTechoMoneda(50, 20);
      assert.equal(resultado.error, false);
    });
  });
});

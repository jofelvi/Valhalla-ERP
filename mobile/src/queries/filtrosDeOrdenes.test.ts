import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  paramsPendientesDeCobro,
  paramsDeMesonero,
  paramsDeZonas,
} from './filtrosDeOrdenes.ts';

describe('filtros de ordenes: lo que se le pide al servidor', () => {
  it('pendientes de cobro: filtra por los DOS ejes, no solo por pago', () => {
    // Sin el filtro de estado entrarian las anuladas, que la pantalla vieja
    // descartaba en el telefono DESPUES de haberlas descargado.
    const p = paramsPendientesDeCobro();
    assert.equal(p.paymentStatus, 'pending,pending_verification,partial');
    assert.equal(p.status, 'PENDING,IN_PROGRESS,READY,DELIVERED,CREDIT');
  });

  it('nunca se pide sin limite', () => {
    // El caso que costo 1,57 MB por llamada: pedir /api/orders con {}.
    for (const p of [
      paramsPendientesDeCobro(),
      paramsDeMesonero('w1'),
      paramsDeZonas(),
    ]) {
      assert.ok(p.limit !== undefined);
      assert.ok(Number(p.limit) > 0);
      // El tope DURO del servidor (`LIMITE_DURO_DE_ORDENES`) son 2.000; pedir
      // mas seria mentirse solo, porque los recorta igual.
      assert.ok(Number(p.limit) <= 2000);
    }
  });

  it('se pide el tope DURO (2.000), no el de POR DEFECTO (500)', () => {
    // Esta prueba existe porque la version anterior afirmaba "el servidor topa
    // en 500" y por eso pedia 500. 500 es el tope POR DEFECTO; el duro son
    // 2.000. Medido en PRE el 23/09/2026: con limit=500 el filtro de la caja
    // devolvia 500 ordenes y con limit=2000 devolvia 531, o sea que **31
    // cuentas con pago pendiente eran invisibles para el cajero**. No fallaba
    // nada: la pantalla mostraba 500 filas y se veia normal.
    //
    // La prueba vieja no solo no lo detectaba: con `<= 500` lo CEMENTABA.
    for (const p of [
      paramsPendientesDeCobro(),
      paramsDeMesonero('w1'),
      paramsDeZonas(),
    ]) {
      assert.equal(
        p.limit,
        '2000',
        'pedir el defecto en vez del tope duro esconde filas sin avisar',
      );
    }
  });

  it('ningun filtro sale vacio (un valor vacio no filtra nada)', () => {
    for (const p of [
      paramsPendientesDeCobro(),
      paramsDeMesonero('w1'),
      paramsDeZonas(),
    ]) {
      for (const [clave, valor] of Object.entries(p)) {
        assert.ok(!/=$/.test(`${clave}=${valor}`));
      }
    }
  });

  it('las anuladas y las pagadas quedan fuera', () => {
    const vivos = paramsPendientesDeCobro().status ?? '';
    assert.ok(vivos.length > 0);
    assert.ok(!vivos.includes('CANCELLED'));
    assert.ok(!vivos.includes('PAID'));
  });

  it('mesonero: manda su id y solo lo vivo', () => {
    const p = paramsDeMesonero('abc123');
    assert.equal(p.waiterId, 'abc123');
    assert.ok((p.status ?? '').includes('PENDING'));
  });
});

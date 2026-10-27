import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { despachoDe, etiquetaDeDespacho } from './estadoDeDespacho.ts';

describe('despachoDe', () => {
  it('todo entregado es "despachada"', () => {
    const d = despachoDe({
      items: [
        { quantity: 2, sentQty: 2, deliveredQty: 2 },
        { quantity: 1, sentQty: 1, deliveredQty: 1 },
      ],
    });
    assert.deepEqual(d, {
      pedido: 3,
      enviado: 3,
      entregado: 3,
      estado: 'despachada',
    });
  });

  it('cuenta unidades, no líneas, y topa lo entregado al pedido', () => {
    const d = despachoDe({
      items: [
        { quantity: 2, sentQty: 2, deliveredQty: 2 },
        { quantity: 3, sentQty: 3, deliveredQty: 1 },
        { quantity: 1, sentQty: 1, deliveredQty: 5 }, // dato sucio: no puede pasar de 1
      ],
    });
    assert.deepEqual(d, {
      pedido: 6,
      enviado: 6,
      entregado: 4,
      estado: 'parcial',
    });
  });

  it('enviado sin entregar es "sin_despachar"', () => {
    const d = despachoDe({
      items: [{ quantity: 2, sentQty: 2, deliveredQty: 0 }],
    });
    assert.equal(d.estado, 'sin_despachar');
  });

  it('sin enviar nada, o sin ítems, es "sin_enviar"', () => {
    assert.equal(despachoDe({ items: [{ quantity: 2 }] }).estado, 'sin_enviar');
    assert.equal(despachoDe({ items: [] }).estado, 'sin_enviar');
    assert.equal(despachoDe({}).estado, 'sin_enviar');
  });

  it('ignora ítems anulados', () => {
    const d = despachoDe({
      items: [
        { quantity: 1, sentQty: 1, deliveredQty: 1 },
        { quantity: 4, sentQty: 4, deliveredQty: 0, cancelledAt: '2026-10-25' },
        { quantity: 4, sentQty: 4, deliveredQty: 0, status: 'CANCELLED' },
      ],
    });
    assert.deepEqual(d, {
      pedido: 1,
      enviado: 1,
      entregado: 1,
      estado: 'despachada',
    });
  });
});

describe('etiquetaDeDespacho', () => {
  it('el parcial dice cuántas de cuántas', () => {
    const e = etiquetaDeDespacho({
      items: [{ quantity: 5, sentQty: 5, deliveredQty: 3 }],
    });
    assert.equal(e.texto, 'Despacho 3/5');
    assert.equal(e.variant, 'warning');
  });

  it('los otros tres estados tienen su texto', () => {
    assert.equal(
      etiquetaDeDespacho({
        items: [{ quantity: 1, sentQty: 1, deliveredQty: 1 }],
      }).texto,
      'Despachada',
    );
    assert.equal(
      etiquetaDeDespacho({ items: [{ quantity: 1, sentQty: 1 }] }).texto,
      'Sin despachar',
    );
    assert.equal(
      etiquetaDeDespacho({ items: [{ quantity: 1 }] }).texto,
      'Sin enviar',
    );
  });
});

describe('etiquetaDeDespacho con la última entrega', () => {
  const entregada = {
    items: [{ quantity: 2, sentQty: 2, deliveredQty: 2 }],
    ultimaEntrega: {
      porId: 'u-7',
      por: null,
      rol: 'kitchen',
      estacion: 'KITCHEN',
      en: '2026-10-25T19:14:18.188Z',
    },
  };

  it('dice quién y cuándo, resolviendo el nombre por id', () => {
    const e = etiquetaDeDespacho(entregada, {
      nombreDe: (id) => (id === 'u-7' ? 'Nohelia' : undefined),
      hora: () => '25/10 15:14',
    });
    assert.equal(e.texto, 'Despachada · Nohelia · 25/10 15:14');
  });

  it('sin nombre ni usuario conocido usa la estación', () => {
    const e = etiquetaDeDespacho(entregada, { hora: () => '25/10 15:14' });
    assert.equal(e.texto, 'Despachada · Cocina · 25/10 15:14');
  });

  it('el nombre guardado manda sobre el id', () => {
    const e = etiquetaDeDespacho(
      {
        ...entregada,
        ultimaEntrega: { ...entregada.ultimaEntrega, por: 'Barra' },
      },
      { nombreDe: () => 'Otro', hora: () => '1:00' },
    );
    assert.equal(e.texto, 'Despachada · Barra · 1:00');
  });

  it('el parcial también lleva el detalle; sin sello no lleva nada', () => {
    const parcial = {
      items: [{ quantity: 5, sentQty: 5, deliveredQty: 3 }],
      ultimaEntrega: {
        porId: null,
        por: 'Xiomara',
        rol: 'bar',
        estacion: 'BAR',
        en: '2026-10-25T20:30:05.461Z',
      },
    };
    assert.equal(
      etiquetaDeDespacho(parcial, { hora: () => '16:30' }).texto,
      'Despacho 3/5 · Xiomara · 16:30',
    );
    assert.equal(
      etiquetaDeDespacho({ items: parcial.items }).texto,
      'Despacho 3/5',
    );
  });
});

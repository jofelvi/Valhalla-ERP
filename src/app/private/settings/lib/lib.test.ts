import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  NOMINA_DEFAULT,
  PALETA_CLARA_DEFAULT,
  PALETA_CLAVES,
  PALETA_OSCURA_DEFAULT,
  TARIFAS_DEFAULT,
} from '@odin6/types';

import { ejemploComision, ejemploServicio } from './ejemplos.ts';
import { listaErrores } from './errores.ts';
import {
  aFraccion,
  aPorcentaje,
  parsearPorcentajes,
  validarListaPorcentajes,
} from './porcentaje.ts';
import { PARES_TEXTO, razonContraste, revisarContraste } from './contraste.ts';
import { VARIABLE_CSS } from './tokensCss.ts';
import { ZONAS_COMUNES, esZonaValida } from './zonasHorarias.ts';

describe('contraste WCAG', () => {
  test('negro sobre blanco es 21:1 y el orden de los colores no cambia el resultado', () => {
    assert.equal(razonContraste('#000000', '#FFFFFF'), 21);
    assert.equal(razonContraste('#FFFFFF', '#000000'), 21);
  });

  test('gris #777777 sobre blanco (4.48:1) NO llega a AA de texto', () => {
    const r = razonContraste('#777777', '#FFFFFF');
    assert.ok(r !== null && r > 4.4 && r < 4.5, `razón ${r}`);
  });

  test('hex inválido devuelve null en vez de un número engañoso', () => {
    assert.equal(razonContraste('rojo', '#FFFFFF'), null);
  });

  test('las paletas neutras por defecto cumplen AA en todos los pares de texto', () => {
    for (const paleta of [PALETA_CLARA_DEFAULT, PALETA_OSCURA_DEFAULT]) {
      const fallos = revisarContraste(paleta).filter((r) => !r.cumple);
      assert.deepEqual(
        fallos.map((f) => `${f.descripcion}: ${f.razon}`),
        [],
      );
    }
  });

  test('marca un par que no llega a AA con su razón redondeada', () => {
    const paleta = {
      ...PALETA_CLARA_DEFAULT,
      content: '#777777',
      surface: '#FFFFFF',
    };
    const par = revisarContraste(paleta).find(
      (r) => r.texto === 'content' && r.fondo === 'surface',
    );
    assert.equal(par?.cumple, false);
    assert.equal(par?.razon, 4.48);
  });

  test('cada par apunta a tokens que existen en la paleta', () => {
    for (const par of PARES_TEXTO) {
      assert.ok((PALETA_CLAVES as readonly string[]).includes(par.texto));
      assert.ok((PALETA_CLAVES as readonly string[]).includes(par.fondo));
    }
  });
});

describe('ejemplos vivos (misma fórmula que la API)', () => {
  test('servicio adicional 10 %: cuenta de 100 con mesonero paga 110; sin mesonero paga 100', () => {
    const e = ejemploServicio(100, TARIFAS_DEFAULT);
    assert.equal(e.pagaConMesonero, 110);
    assert.equal(e.servicio, 10);
    assert.equal(e.pagaSinMesonero, 100);
  });

  test('servicio incluido: no se suma, pero informa cuánto contiene el precio', () => {
    const e = ejemploServicio(110, {
      ...TARIFAS_DEFAULT,
      serviceMode: 'included',
    });
    assert.equal(e.pagaConMesonero, 110);
    assert.equal(e.servicio, 0);
    assert.equal(e.incluido, 10);
  });

  test('sin servicio: paga la cuenta tal cual', () => {
    const e = ejemploServicio(100, { ...TARIFAS_DEFAULT, serviceMode: 'none' });
    assert.equal(e.pagaConMesonero, 100);
    assert.equal(e.servicio, 0);
  });

  test('comisión 7 % sobre ventas: la cortesía de 20 se excluye (base 100, comisión 7)', () => {
    const e = ejemploComision(NOMINA_DEFAULT, TARIFAS_DEFAULT);
    assert.equal(e.comisionBase, 100);
    assert.equal(e.comision, 7);
  });

  test('si la nómina NO excluye cortesías, la base sube a 120', () => {
    const e = ejemploComision(
      { ...NOMINA_DEFAULT, excludeComplimentaryFromCommission: false },
      TARIFAS_DEFAULT,
    );
    assert.equal(e.comisionBase, 120);
  });

  test('comisión sobre servicio: la base es el 10 % de las ventas', () => {
    const e = ejemploComision(
      { ...NOMINA_DEFAULT, commissionBasis: 'service', commissionRate: 0.5 },
      TARIFAS_DEFAULT,
    );
    assert.equal(e.comisionBase, 10);
    assert.equal(e.comision, 5);
  });
});

describe('porcentajes en pantalla vs fracciones guardadas', () => {
  test('ida y vuelta sin perder precisión', () => {
    for (const f of [0, 0.07, 0.1, 0.165, 1]) {
      assert.equal(aFraccion(aPorcentaje(f)), f);
    }
    assert.equal(aFraccion(7.5), 0.075);
  });

  test('parsea listas de propinas y descarta lo que no es número', () => {
    assert.deepEqual(parsearPorcentajes('10, 15,  20'), [10, 15, 20]);
    assert.deepEqual(parsearPorcentajes('10,,abc, 5'), [10, 5]);
    assert.deepEqual(parsearPorcentajes(''), []);
  });

  test('valida el tope de cantidad y el rango 0-100', () => {
    assert.equal(validarListaPorcentajes('10, 15', 6), true);
    assert.notEqual(validarListaPorcentajes('10, 150', 6), true);
    assert.notEqual(validarListaPorcentajes('1,2,3,4,5,6,7', 6), true);
    assert.notEqual(validarListaPorcentajes('diez', 6), true);
  });
});

describe('zonas horarias', () => {
  test('acepta zonas IANA y rechaza nombres inventados o vacíos', () => {
    assert.equal(esZonaValida('America/Caracas'), true);
    assert.equal(esZonaValida('Mars/Olympus'), false);
    assert.equal(esZonaValida(''), false);
    assert.equal(esZonaValida('x'.repeat(61)), false);
  });

  test('todas las sugeridas son válidas', () => {
    for (const z of ZONAS_COMUNES) assert.equal(esZonaValida(z), true, z);
  });
});

describe('errores de formulario', () => {
  test('junta mensajes anidados (listas) y omite claves técnicas', () => {
    const errores = {
      tradeName: {
        type: 'required',
        message: 'Escriba el nombre',
        ref: { name: 'x' },
      },
      deducciones: [undefined, { label: { message: 'Falta el nombre' } }],
      email: undefined,
    };
    assert.deepEqual(listaErrores(errores), [
      'Escriba el nombre',
      'Falta el nombre',
    ]);
  });

  test('sin errores devuelve lista vacía', () => {
    assert.deepEqual(listaErrores({}), []);
    assert.deepEqual(listaErrores(undefined), []);
  });
});

describe('variables CSS de la vista previa', () => {
  test('cada token de la paleta tiene su variable y ninguna sobra', () => {
    assert.deepEqual(
      Object.keys(VARIABLE_CSS).sort(),
      [...PALETA_CLAVES].sort(),
    );
    assert.equal(
      new Set(Object.values(VARIABLE_CSS)).size,
      PALETA_CLAVES.length,
    );
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CAPAS_DE_MODAL,
  claseDeCapa,
  enfocablesDe,
  siguienteFoco,
  type CapaDeModal,
} from './modal.ts';

describe('capas del modal', () => {
  test('hay una capa por cada nivel que hoy se escribe a mano', () => {
    // Medido el 08/09/2026: los modales a mano usan z-40, z-50, z-[60] y
    // z-[100]. Sin un nombre para cada una es imposible anidar dos modales
    // sin adivinar el numero.
    assert.deepEqual(Object.keys(CAPAS_DE_MODAL).sort(), [
      'base',
      'encima',
      'fondo',
      'sobreTodo',
    ]);
  });

  test('cada capa devuelve la clase que ya se usaba', () => {
    assert.equal(claseDeCapa('fondo'), 'z-40');
    assert.equal(claseDeCapa('base'), 'z-50');
    assert.equal(claseDeCapa('encima'), 'z-[60]');
    assert.equal(claseDeCapa('sobreTodo'), 'z-[100]');
  });

  test('la capa por defecto es la de siempre', () => {
    assert.equal(claseDeCapa(undefined), 'z-50');
  });

  test('las capas estan ordenadas de menor a mayor', () => {
    const orden: CapaDeModal[] = ['fondo', 'base', 'encima', 'sobreTodo'];
    const valores = orden.map((c) => CAPAS_DE_MODAL[c]);
    assert.deepEqual(
      [...valores].sort((a, b) => a - b),
      valores,
    );
  });
});

describe('trampa de foco', () => {
  /** Un elemento de mentira: solo lo que mira `enfocablesDe`. */
  const elemento = (etiqueta: string, extra: Record<string, unknown> = {}) =>
    ({
      tagName: etiqueta.toUpperCase(),
      disabled: false,
      hidden: false,
      getAttribute: () => null,
      ...extra,
    }) as unknown as HTMLElement;

  test('toma botones, enlaces y campos', () => {
    const nodos = [elemento('button'), elemento('a'), elemento('input')];
    assert.equal(enfocablesDe(nodos).length, 3);
  });

  test('descarta lo deshabilitado, lo oculto y lo sacado del tabulador', () => {
    const nodos = [
      elemento('button', { disabled: true }),
      elemento('input', { hidden: true }),
      elemento('a', {
        getAttribute: (n: string) => (n === 'tabindex' ? '-1' : null),
      }),
      elemento('button'),
    ];
    assert.equal(enfocablesDe(nodos).length, 1);
  });

  test('tabular en el ultimo vuelve al primero, y al reves', () => {
    // Es lo que hace que el modal SEA modal: el foco no se escapa a la
    // pantalla de atras, que sigue ahi debajo.
    assert.equal(siguienteFoco(2, 3, false), 0);
    assert.equal(siguienteFoco(0, 3, true), 2);
  });

  test('en el medio avanza y retrocede de uno', () => {
    assert.equal(siguienteFoco(0, 3, false), 1);
    assert.equal(siguienteFoco(2, 3, true), 1);
  });

  test('sin nada enfocable no se mueve a ninguna parte', () => {
    assert.equal(siguienteFoco(-1, 0, false), -1);
  });

  test('si el foco esta fuera del modal, entra por el primero', () => {
    assert.equal(siguienteFoco(-1, 3, false), 0);
    assert.equal(siguienteFoco(-1, 3, true), 2);
  });
});

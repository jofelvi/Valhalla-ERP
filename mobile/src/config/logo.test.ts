import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { elegirLogo, iniciales, resolverUrlLogo } from './logo.ts';

const API = 'https://api.example.com/';

describe('resolverUrlLogo', () => {
  test('una URL absoluta se respeta tal cual', () => {
    assert.equal(
      resolverUrlLogo('https://cdn.example.com/logo.png', API),
      'https://cdn.example.com/logo.png',
    );
  });

  test('una ruta de la API se resuelve contra la API, sin doble barra', () => {
    assert.equal(
      resolverUrlLogo('/uploads/generic/marca/a.png', API),
      'https://api.example.com/uploads/generic/marca/a.png',
    );
  });

  test('vacío, esquemas peligrosos y rutas con // dan "sin logo"', () => {
    assert.equal(resolverUrlLogo('', API), '');
    assert.equal(resolverUrlLogo(undefined, API), '');
    assert.equal(resolverUrlLogo('javascript:alert(1)', API), '');
    assert.equal(resolverUrlLogo('data:image/png;base64,AAAA', API), '');
    assert.equal(resolverUrlLogo('//evil.example/x.png', API), '');
  });
});

describe('elegirLogo', () => {
  const marca = { logoLightUrl: '/uploads/claro.png', logoDarkUrl: '' };

  test('usa el del tema y, si falta, el del otro', () => {
    assert.equal(
      elegirLogo(marca, false, API),
      'https://api.example.com/uploads/claro.png',
    );
    assert.equal(
      elegirLogo(marca, true, API),
      'https://api.example.com/uploads/claro.png',
    );
  });

  test('prefiere el del tema cuando hay los dos', () => {
    const dos = {
      logoLightUrl: '/uploads/claro.png',
      logoDarkUrl: '/uploads/oscuro.png',
    };
    assert.equal(
      elegirLogo(dos, true, API),
      'https://api.example.com/uploads/oscuro.png',
    );
    assert.equal(
      elegirLogo(dos, false, API),
      'https://api.example.com/uploads/claro.png',
    );
  });

  test('sin ningún logo devuelve vacío', () => {
    assert.equal(
      elegirLogo({ logoLightUrl: '', logoDarkUrl: '' }, false, API),
      '',
    );
  });
});

describe('iniciales', () => {
  test('toma las dos primeras palabras', () => {
    assert.equal(iniciales('Taquería Los Ejemplos'), 'TL');
    assert.equal(iniciales('  pizza  nova '), 'PN');
  });

  test('con una palabra usa una letra, y sin nombre usa la P de "Punto de venta"', () => {
    assert.equal(iniciales('Sabor'), 'S');
    assert.equal(iniciales(''), 'P');
    assert.equal(iniciales('   '), 'P');
  });

  test('no parte un carácter fuera del plano básico', () => {
    assert.equal(iniciales('Ñandú 𝒜'), 'Ñ𝒜');
  });
});

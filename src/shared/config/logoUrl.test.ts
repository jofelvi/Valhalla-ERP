import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolverUrlMarca } from './logoUrl.ts';

describe('resolverUrlMarca', () => {
  test('una ruta de uploads se resuelve contra la API', () => {
    assert.equal(
      resolverUrlMarca(
        '/uploads/generic/marca/a.png',
        'https://api.example.com/',
      ),
      'https://api.example.com/uploads/generic/marca/a.png',
    );
  });

  test('una URL absoluta y los archivos de la propia web no se tocan', () => {
    assert.equal(
      resolverUrlMarca(
        'https://cdn.example.com/a.png',
        'https://api.example.com',
      ),
      'https://cdn.example.com/a.png',
    );
    assert.equal(
      resolverUrlMarca('/icono.svg', 'https://api.example.com'),
      '/icono.svg',
    );
  });

  test('sin API configurada o sin valor no inventa nada', () => {
    assert.equal(resolverUrlMarca('/uploads/a.png', ''), '/uploads/a.png');
    assert.equal(resolverUrlMarca(undefined, 'https://api.example.com'), '');
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearColores } from './paleta.ts';
import {
  MARCA_DEFAULT,
  PALETA_CLARA_DEFAULT,
  PALETA_OSCURA_DEFAULT,
} from '../shared/contrato.ts';

const MARCA_PRUEBA = {
  primary: '#123456',
  success: '#00AA00',
  danger: '#AA0000',
};

test('crearColores: los tokens de marca salen de la paleta, no de constantes', () => {
  const claro = crearColores(
    { ...PALETA_CLARA_DEFAULT, ...MARCA_PRUEBA },
    'light',
  );
  assert.equal(claro.brand, '#123456');
  assert.equal(claro.primary, '#123456');
  assert.equal(claro.ok, '#00AA00');
  assert.equal(claro.error, '#AA0000');
  assert.equal(claro['on-brand'], PALETA_CLARA_DEFAULT.onPrimary);
});

test('crearColores: claro y oscuro salen de paletas distintas', () => {
  const claro = crearColores(PALETA_CLARA_DEFAULT, 'light');
  const oscuro = crearColores(PALETA_OSCURA_DEFAULT, 'dark');
  assert.equal(claro.page, PALETA_CLARA_DEFAULT.page);
  assert.equal(oscuro.page, PALETA_OSCURA_DEFAULT.page);
  assert.notEqual(claro.page, oscuro.page);
});

test('crearColores: las variantes se derivan y ninguna queda vacía', () => {
  const t = crearColores(PALETA_OSCURA_DEFAULT, 'dark');
  for (const [clave, valor] of Object.entries(t)) {
    assert.ok(
      typeof valor === 'string' && valor.length > 0,
      `token vacío: ${clave}`,
    );
  }
  assert.match(t.successLight, /^#[0-9A-F]{6}$/);
  assert.match(t.successDark, /^#[0-9A-F]{6}$/);
});

test('marca por defecto: la instalación neutra no trae identidad de ningún negocio', () => {
  assert.equal(MARCA_DEFAULT.appName, '');
  assert.equal(MARCA_DEFAULT.logoLightUrl, '');
  assert.equal(MARCA_DEFAULT.defaultTheme, 'system');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esRespuestaValida,
  leerCacheConfig,
  normalizarConfigPublica,
} from './configPublica.ts';
import { CONFIG_PUBLICA_DEFAULT } from '../shared/contrato.ts';

test('leerCacheConfig: sin texto o JSON roto devuelve null', () => {
  assert.equal(leerCacheConfig(null), null);
  assert.equal(leerCacheConfig(''), null);
  assert.equal(leerCacheConfig('{no es json'), null);
});

test('leerCacheConfig: un objeto sin bloques principales no es configuración', () => {
  assert.equal(leerCacheConfig(JSON.stringify({ hola: 1 })), null);
  assert.equal(leerCacheConfig(JSON.stringify([1, 2])), null);
});

test('normalizarConfigPublica: un documento a medias completa con valores neutros', () => {
  const c = normalizarConfigPublica({
    negocio: { tradeName: 'Demo' },
    marca: { appName: 'Demo POS' },
    tarifas: { serviceRate: 0.12 },
  });
  assert.equal(c.negocio.tradeName, 'Demo');
  assert.equal(c.marca.appName, 'Demo POS');
  assert.equal(c.tarifas.serviceRate, 0.12);
  assert.equal(
    c.tarifas.baseCurrency,
    CONFIG_PUBLICA_DEFAULT.tarifas.baseCurrency,
  );
  assert.deepEqual(c.modulos, CONFIG_PUBLICA_DEFAULT.modulos);
  assert.equal(c.configured, false);
});

test('normalizarConfigPublica: valores inválidos caen al neutro, no se propagan', () => {
  const c = normalizarConfigPublica({
    negocio: { tradeName: 'X' },
    marca: { palette: { light: { primary: 'rojo' } } },
    tarifas: { serviceRate: 'mucho', serviceMode: 'otro' },
    modulos: { telegramBot: 'si' },
  });
  assert.equal(
    c.marca.palette.light.primary,
    CONFIG_PUBLICA_DEFAULT.marca.palette.light.primary,
  );
  assert.equal(
    c.tarifas.serviceRate,
    CONFIG_PUBLICA_DEFAULT.tarifas.serviceRate,
  );
  assert.equal(
    c.tarifas.serviceMode,
    CONFIG_PUBLICA_DEFAULT.tarifas.serviceMode,
  );
  assert.equal(c.modulos.telegramBot, false);
});

test('leerCacheConfig: una respuesta guardada se recupera igual', () => {
  const guardada = JSON.stringify({
    configured: true,
    negocio: { tradeName: 'Mi local' },
    marca: { appName: '', palette: { light: {}, dark: {} } },
    tarifas: { serviceRate: 0.15 },
  });
  const c = leerCacheConfig(guardada);
  assert.ok(c);
  assert.equal(c.configured, true);
  assert.equal(c.negocio.tradeName, 'Mi local');
  assert.equal(c.tarifas.serviceRate, 0.15);
});

test('esRespuestaValida: exige marca, tarifas y negocio como objetos', () => {
  assert.equal(
    esRespuestaValida({ negocio: {}, marca: {}, tarifas: {} }),
    true,
  );
  assert.equal(esRespuestaValida({ negocio: {}, marca: {} }), false);
  assert.equal(
    esRespuestaValida({ negocio: {}, marca: [], tarifas: {} }),
    false,
  );
});

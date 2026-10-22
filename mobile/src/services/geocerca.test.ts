import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { geocercaDesdeRespuesta, type Geocerca } from './geocerca.ts';

const DEL_BUILD: Geocerca = {
  latitude: 10.2344525,
  longitude: -67.5447014,
  radiusMeters: 200,
};

describe('geocercaDesdeRespuesta', () => {
  test('usa la geocerca que manda el servidor', () => {
    assert.deepEqual(
      geocercaDesdeRespuesta(
        { geofence: { latitude: 10.5, longitude: -66.9, radiusMeters: 150 } },
        DEL_BUILD,
      ),
      { latitude: 10.5, longitude: -66.9, radiusMeters: 150 },
    );
  });

  test('sin respuesta (API vieja, sin red) se queda con la del build', () => {
    assert.equal(geocercaDesdeRespuesta(null, DEL_BUILD), DEL_BUILD);
    assert.equal(geocercaDesdeRespuesta({}, DEL_BUILD), DEL_BUILD);
  });

  test('un valor roto no deja a nadie sin fichar', () => {
    assert.equal(
      geocercaDesdeRespuesta(
        { geofence: { latitude: 10.5, longitude: -66.9, radiusMeters: 0 } },
        DEL_BUILD,
      ),
      DEL_BUILD,
    );
    assert.equal(
      geocercaDesdeRespuesta(
        { geofence: { latitude: '10.5', longitude: -66.9, radiusMeters: 150 } },
        DEL_BUILD,
      ),
      DEL_BUILD,
    );
  });
});

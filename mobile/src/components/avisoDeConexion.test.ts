import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decidirAviso, MENSAJES } from './avisoDeConexion.ts';

describe('avisoDeConexion - que se le muestra al mesonero cuando se cae la red', () => {
  it('con todo bien no muestra nada', () => {
    assert.equal(
      decidirAviso({ isOffline: false, isAuthenticated: true, hayRed: true }),
      'ninguno',
    );
  });

  it('sin sesion no muestra nada: la pantalla de login ya avisa sola', () => {
    assert.equal(
      decidirAviso({ isOffline: true, isAuthenticated: false, hayRed: false }),
      'ninguno',
    );
  });

  it('sin WiFi dice que no hay conexion', () => {
    assert.equal(
      decidirAviso({ isOffline: true, isAuthenticated: true, hayRed: false }),
      'sin_red',
    );
  });

  it('se corta el WiFi MIENTRAS trabaja: avisa sin esperar a que algo falle', () => {
    // Este es EL caso, y es el que fallaba. `isOffline` del authStore solo se
    // pone en true dentro de `initialize()`, o sea al abrir la app: si la red
    // se cae con la sesion ya abierta, se queda en false para siempre. Con la
    // version anterior el aviso no salia nunca — se probo en la PWA cortando
    // la red de verdad y no aparecio.
    assert.equal(
      decidirAviso({ isOffline: false, isAuthenticated: true, hayRed: false }),
      'sin_red',
    );
  });

  it('con WiFi pero sin respuesta del servidor NO culpa al WiFi', () => {
    const tipo = decidirAviso({
      isOffline: true,
      isAuthenticated: true,
      hayRed: true,
    });
    assert.equal(tipo, 'servidor_mudo');
    assert.ok(
      !MENSAJES[tipo].toLowerCase().includes('sin conexion'),
      'no debe mandar a revisar el router cuando el router esta bien',
    );
  });

  it('si NetInfo todavia no reporto, no inventa que no hay red', () => {
    // hayRed === null NO es lo mismo que hayRed === false. Decir "sin
    // conexion" aca manda a alguien a revisar el router sin motivo.
    assert.equal(
      decidirAviso({ isOffline: true, isAuthenticated: true, hayRed: null }),
      'servidor_mudo',
    );
  });

  it('los dos mensajes son distintos y estan en español', () => {
    assert.notEqual(MENSAJES.sin_red, MENSAJES.servidor_mudo);
    for (const m of Object.values(MENSAJES)) {
      assert.ok(m.length > 0);
      assert.ok(
        !/network|failed|error/i.test(m),
        `"${m}" es jerga de programador, no sirve en una barra`,
      );
    }
  });
});

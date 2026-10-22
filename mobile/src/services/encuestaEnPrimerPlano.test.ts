import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  encuestarEnPrimerPlano,
  type EstadoDeAplicacion,
} from './encuestaEnPrimerPlano.ts';

/** Un `AppState` de mentira que se puede mover a mano. */
function appStateFalso(inicial = 'active') {
  let actual = inicial;
  const handlers: Array<(estado: string) => void> = [];
  const app: EstadoDeAplicacion = {
    get currentState() {
      return actual;
    },
    addEventListener: (_tipo, handler) => {
      handlers.push(handler);
      return {
        remove: () => {
          const i = handlers.indexOf(handler);
          if (i >= 0) handlers.splice(i, 1);
        },
      };
    },
  };
  return {
    app,
    mover: (estado: string) => {
      actual = estado;
      for (const h of [...handlers]) h(estado);
    },
    suscriptores: () => handlers.length,
  };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('encuestarEnPrimerPlano', () => {
  test('consulta de inmediato, sin esperar al primer intervalo', async () => {
    let n = 0;
    const cancelar = encuestarEnPrimerPlano(() => void n++, { cadaMs: 10_000 });
    await esperar(5);
    assert.equal(n, 1);
    cancelar();
  });

  test('repite mientras esta en primer plano', async () => {
    let n = 0;
    const cancelar = encuestarEnPrimerPlano(() => void n++, { cadaMs: 20 });
    await esperar(110);
    cancelar();
    assert.ok(n >= 4, `esperaba al menos 4 consultas, hubo ${n}`);
  });

  test('en SEGUNDO PLANO no consulta: es el ahorro entero', async () => {
    // Un mesonero con el APK en el bolsillo 8 horas pegaba 9.600 peticiones de
    // chat sin que nadie mirara la pantalla.
    const { app, mover } = appStateFalso('active');
    let n = 0;
    const cancelar = encuestarEnPrimerPlano(() => void n++, {
      cadaMs: 20,
      appState: app,
    });
    await esperar(50);
    const alIrseAlFondo = n;
    mover('background');
    await esperar(120);
    cancelar();
    assert.equal(
      n,
      alIrseAlFondo,
      `no debia consultar en segundo plano (${alIrseAlFondo} -> ${n})`,
    );
  });

  test('al volver consulta YA, no al proximo intervalo', async () => {
    // Si esperara, el cajero desbloquearia el telefono y veria datos viejos
    // hasta 10 s: peor que el sondeo que se quiso ahorrar.
    const { app, mover } = appStateFalso('active');
    let n = 0;
    const cancelar = encuestarEnPrimerPlano(() => void n++, {
      cadaMs: 10_000,
      appState: app,
    });
    await esperar(5);
    mover('background');
    const antes = n;
    mover('active');
    await esperar(5);
    cancelar();
    assert.equal(n, antes + 1);
  });

  test('arranca dormido si la aplicacion ya estaba en segundo plano', async () => {
    const { app } = appStateFalso('background');
    let n = 0;
    const cancelar = encuestarEnPrimerPlano(() => void n++, {
      cadaMs: 20,
      appState: app,
    });
    await esperar(60);
    cancelar();
    assert.equal(n, 0);
  });

  test('no se solapa consigo mismo en red lenta', async () => {
    // Con `setInterval` sobre una promesa —lo que habia— una consulta mas
    // lenta que el intervalo encolaba llamadas una encima de otra.
    let enVuelo = 0;
    let maxSimultaneas = 0;
    const cancelar = encuestarEnPrimerPlano(
      async () => {
        enVuelo++;
        maxSimultaneas = Math.max(maxSimultaneas, enVuelo);
        await esperar(60);
        enVuelo--;
      },
      { cadaMs: 5 },
    );
    await esperar(200);
    cancelar();
    assert.equal(maxSimultaneas, 1);
  });

  test('cancelar detiene todo y suelta el suscriptor', async () => {
    const { app, suscriptores } = appStateFalso('active');
    let n = 0;
    const cancelar = encuestarEnPrimerPlano(() => void n++, {
      cadaMs: 20,
      appState: app,
    });
    await esperar(50);
    cancelar();
    const alCancelar = n;
    assert.equal(suscriptores(), 0);
    await esperar(80);
    assert.equal(n, alCancelar);
  });

  test('un tick que revienta no mata la encuesta', async () => {
    // Una caida de red no puede dejar la pantalla congelada para siempre.
    let n = 0;
    const cancelar = encuestarEnPrimerPlano(
      async () => {
        n++;
        if (n === 1) throw new Error('red caida');
      },
      { cadaMs: 20 },
    );
    await esperar(110);
    cancelar();
    assert.ok(n >= 3, `esperaba que siguiera consultando, hubo ${n}`);
  });
});

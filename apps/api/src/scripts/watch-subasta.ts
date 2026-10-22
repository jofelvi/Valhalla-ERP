import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DivisasModule } from '../modules/divisas/divisas.module';
import { SubastaWatcherService } from '../modules/divisas/subasta-watcher.service';
import { BanvenezSessionService } from '../modules/banvenez/banvenez-session.service';
import { ConfigsService } from '../modules/configs/configs.service';
import { moduloActivo } from '../common/modulos/modulo-activo';
import {
  fechaCalendario,
  instanteDePared,
} from '../common/operacion/operacion.util';
import { OperacionConfig } from '@odin6/types';

/**
 * Vigilante de la Subasta electronica de divisas del BDV.
 *
 * Lo lanza cron a las 7:55 (ver /etc/cron.d/vigilante-subasta). Vigila
 * hasta la hora de cierre de la franja y termina; no queda ningun proceso vivo
 * el resto del dia.
 *
 *   node dist/scripts/watch-subasta.js            # franja normal
 *   node dist/scripts/watch-subasta.js --once     # una sola comprobacion (prueba)
 *
 * Las horas de la franja son de la zona de la operacion (`operacion`), no del servidor.
 */
const logger = new Logger('WatchSubasta');

/** "08:30" -> la fecha de hoy (en la zona de la operacion) a esa hora. */
function horaDeHoy(hhmm: string, op: OperacionConfig): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const [anio, mes, dia] = fechaCalendario(new Date(), op)
    .split('-')
    .map(Number);
  return instanteDePared(anio, mes, dia, h, m, op.timezone);
}

async function main(): Promise<void> {
  const soloUna = process.argv.includes('--once');
  // Modo local: navegador VISIBLE y, al terminar, la ventana se queda abierta
  // con la sesion viva. Es para correrlo en la PC de uno y comprar en el acto
  // cuando la subasta abra, en vez de enterarse por un SMS.
  const local = process.argv.includes('--local');

  const app = await NestFactory.createApplicationContext(DivisasModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const config = app.get(ConfigService);
    const configs = app.get(ConfigsService);
    if (!(await moduloActivo(configs, 'currencyWatcher'))) {
      logger.log(
        'Modulo currencyWatcher apagado en la configuracion: no se vigila la subasta',
      );
      return;
    }
    const op = await configs.obtener('operacion');
    const watcher = app.get(SubastaWatcherService);

    const artifactsDir =
      config.get<string>('DIVISAS_ARTIFACTS_DIR') ?? './logs/subasta';

    if (soloUna) {
      // Prueba manual: entra, mira una vez y reporta. No manda avisos.
      const session = app.get(BanvenezSessionService);
      const { estado, screen } = await session.withSession(
        (page) => watcher.checkOnce(page),
        { blockAssets: false },
      );
      logger.log(`Estado: ${estado}`);
      logger.log(`URL: ${screen.url}`);
      logger.log(`Snackbar: ${screen.snackbarText || '(ninguno)'}`);
      logger.log(`Campos visibles: ${screen.inputCount}`);
      return;
    }

    const finFranja = config.get<string>('DIVISAS_WINDOW_END') ?? '08:30';
    const intervaloSeg = parseInt(
      config.get<string>('DIVISAS_CHECK_INTERVAL_SEC') ?? '5',
      10,
    );
    const until = horaDeHoy(finFranja, op);

    if (until.getTime() <= Date.now()) {
      logger.warn(
        `La franja ya cerro (fin ${finFranja}). No se vigila nada. Usa --once para una prueba suelta.`,
      );
      return;
    }

    const minutos = Math.round((until.getTime() - Date.now()) / 60000);
    logger.log(
      `Vigilando la subasta hasta las ${finFranja} (${minutos} min), una comprobacion cada ${intervaloSeg}s`,
    );

    const result = await watcher.watch({
      until,
      intervalMs: intervaloSeg * 1000,
      // Con la franja de 35 min y una sesion que dura lo suyo, 4 reaperturas
      // cubren de sobra los cortes sin machacar el login del banco.
      maxSessions: 4,
      artifactsDir,
      headless: !local,
      keepBrowserOpen: local,
    });

    logger.log(
      `Fin: estado=${result.estado} comprobaciones=${result.checks} sesiones=${result.sessions}`,
    );
    await watcher.enviarResumen(result);

    if (local) {
      // Playwright mata el navegador cuando termina el proceso, asi que hay que
      // quedarse vivo para que la ventana siga ahi.
      if (result.estado === 'ABIERTA') {
        logger.log('=========================================================');
        logger.log('  LA SUBASTA ESTA ABIERTA — la ventana del banco quedo');
        logger.log('  abierta y con la sesion iniciada. Ve a comprar.');
        logger.log('=========================================================');
      } else {
        logger.log(
          `La franja cerro sin abrir (estado ${result.estado}). La ventana del banco queda abierta por si quieres mirar.`,
        );
      }
      logger.log('Cierra esta terminal (Ctrl+C) cuando termines.');
      await new Promise(() => {});
    }
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const msg = error instanceof Error ? error.stack : String(error);
    logger.error(`El vigilante fallo: ${msg}`);
    process.exit(1);
  });

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReleasesController } from './releases.controller';
import {
  ReleasesService,
  EJECUTOR_ROLLBACK,
  type ResultadoEjecucion,
} from './releases.service';
import { Release, ReleaseSchema } from './schemas/release.schema';
import {
  RollbackLock,
  RollbackLockSchema,
} from './schemas/rollback-lock.schema';
import { AuthModule } from '../auth/auth.module';

const ejecutarArchivo = promisify(execFile);

/**
 * El script de despliegue (ruta en ROLLBACK_SCRIPT) tiene interfaz FIJA: <script> <ambito> <sha>.
 *
 * Se invoca con execFile, NO con exec: sin shell de por medio no hay
 * interpolacion posible. Los argumentos ya vienen validados del service (el
 * sha contra ^[0-9a-f]{7,40}$) y el script los vuelve a validar por su cuenta.
 */
/** Sin ROLLBACK_SCRIPT no hay rollback en esta instalación: se responde con un error claro. */
const RUTA_SCRIPT = process.env.ROLLBACK_SCRIPT ?? '';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Release.name, schema: ReleaseSchema },
      { name: RollbackLock.name, schema: RollbackLockSchema },
    ]),
    AuthModule,
  ],
  controllers: [ReleasesController],
  providers: [
    ReleasesService,
    {
      provide: EJECUTOR_ROLLBACK,
      useValue: async (args: string[]): Promise<ResultadoEjecucion> => {
        if (!RUTA_SCRIPT) {
          return {
            ok: false,
            salida: 'Rollback no configurado: falta ROLLBACK_SCRIPT',
          };
        }
        try {
          const { stdout } = await ejecutarArchivo(RUTA_SCRIPT, args);
          return { ok: true, salida: stdout };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, salida: msg };
        }
      },
    },
  ],
  exports: [ReleasesService],
})
export class ReleasesModule {}

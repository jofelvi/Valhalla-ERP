import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { User } from '../../modules/auth/schemas/user.schema';

interface RequestConUsuario extends Request {
  user?: { id?: string; sub?: string };
}

/**
 * Deja constancia de qué versión del APK usa cada persona.
 *
 * El teléfono ya manda `X-App-Version` en TODAS sus peticiones (lo pone
 * `apiClient` desde hace tiempo), pero el servidor solo la escribía en un log
 * cuando rechazaba algo — así que no había forma de responder "¿qué versión
 * tiene Emanuel?" ni de correlacionar un error reportado con la versión que lo
 * produjo.
 *
 * Va como INTERCEPTOR y no como middleware porque necesita `req.user`, que lo
 * pone el guard de JWT: el middleware corre antes que los guards y ahí el
 * usuario todavía no existe.
 *
 * Importante: NO hace falta compilar un APK nuevo. El dato ya viaja; lo único
 * que faltaba era guardarlo.
 */
@Injectable()
export class ClientVersionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ClientVersionInterceptor.name);

  /**
   * Última versión ya guardada por usuario, en memoria.
   *
   * Sin esto habría una escritura a Mongo por cada request de cada teléfono.
   * Solo se escribe cuando la versión CAMBIA o cuando pasó más de una hora:
   * la instalación de una actualización y la señal de "sigue activo".
   */
  private readonly visto = new Map<string, { version: string; ts: number }>();

  private static readonly REFRESCO_MS = 60 * 60 * 1000;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestConUsuario>();

    // Telemetría: nunca debe bloquear ni retrasar la respuesta.
    void this.registrar(req).catch((error) => {
      this.logger.debug(
        `No se pudo registrar la version del cliente: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return next.handle();
  }

  private async registrar(req: RequestConUsuario): Promise<void> {
    const version = String(req.headers['x-app-version'] ?? '').trim();
    if (!version) return;

    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) return;

    const plataforma = String(
      req.headers['x-client-platform'] ?? req.headers['x-client-type'] ?? '',
    ).trim();

    const previo = this.visto.get(userId);
    const ahora = Date.now();
    const cambio = !previo || previo.version !== version;
    const viejo =
      !!previo && ahora - previo.ts > ClientVersionInterceptor.REFRESCO_MS;
    if (!cambio && !viejo) return;

    this.visto.set(userId, { version, ts: ahora });

    await this.userModel
      .updateOne(
        { _id: userId },
        {
          $set: {
            lastAppVersion: version,
            lastAppPlatform: plataforma || 'desconocida',
            lastAppSeenAt: new Date(),
          },
        },
      )
      .exec();

    if (cambio && previo) {
      this.logger.log(
        `Usuario ${userId} paso de la version ${previo.version} a la ${version}`,
      );
    }
  }
}

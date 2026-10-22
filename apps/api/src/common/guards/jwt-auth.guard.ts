import {
  Injectable,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  decideWriteAuth,
  isEnforceEnabled,
  readAuthMode,
} from './write-auth-policy';

/**
 * JWT Auth Guard.
 *
 * Durante la transicion Firebase → NestJS este guard quedo permisivo: dejaba
 * pasar GETs sin token y ADEMAS, porque `handleRequest` devuelve null en vez de
 * lanzar, dejaba pasar TAMBIEN las escrituras sin credenciales. Es decir: la
 * API aceptaba POST/PATCH/DELETE de cualquiera.
 *
 * Cerrarlo de golpe no era viable: auditando los logs de produccion aparecieron
 * escrituras legitimas llegando sin token (claims de mesa, alguna orden). Asi
 * que el cierre va en dos pasos, con el interruptor `AUTH_ENFORCE_WRITES`:
 *
 *   1. AUDITORIA (por defecto): deja pasar, pero deja un WARN con metodo, ruta,
 *      cliente y version — para identificar y arreglar esos clientes con datos.
 *   2. ENFORCE (AUTH_ENFORCE_WRITES=true): responde 401.
 *
 * Se activa/revierte con un restart, sin redeploy. La decision vive en
 * write-auth-policy.ts (pura y con tests).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const hasAuthHeader = !!request.headers?.authorization;

    // Resuelve el usuario si viene token. handleRequest no lanza, asi que esto
    // deja request.user en null cuando no hay token valido y decidimos abajo.
    try {
      await super.canActivate(context);
    } catch {
      // Con tokens corruptos Passport puede lanzar: se trata como "sin usuario".
    }

    const decision = decideWriteAuth({
      method: request.method,
      hasUser: !!request.user,
      hasAuthHeader,
      enforce: isEnforceEnabled(process.env),
      readMode: readAuthMode(process.env),
    });

    if (decision.action === 'allow') return true;

    const client = request.headers?.['x-client-type'] ?? 'desconocido';
    const version = request.headers?.['x-app-version'] ?? '?';
    const detalle =
      `${request.method} ${request.originalUrl ?? request.url} ` +
      `cliente=${client}:${version} ip=${request.ip} — ${decision.reason}`;

    const tipoAcceso =
      request.method?.toUpperCase() === 'GET' ? 'lectura' : 'escritura';
    if (decision.action === 'deny') {
      this.logger.warn(`[auth] RECHAZADA ${tipoAcceso} sin sesion: ${detalle}`);
      throw new UnauthorizedException(
        'Debes iniciar sesion para realizar esta accion',
      );
    }

    // Auditoria: se permite, pero queda el rastro para poder cerrar despues.
    this.logger.warn(
      `[auth-audit] ${tipoAcceso} sin sesion (permitida): ${detalle}`,
    );
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleRequest(
    err: any,
    user: any,
    _info: any,
    _context?: any,
    _status?: any,
  ) {
    // No lanza a proposito: canActivate decide segun la politica de arriba.
    if (err || !user) {
      return null;
    }
    return user;
  }
}

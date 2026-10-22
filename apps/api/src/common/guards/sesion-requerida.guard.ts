import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Exige una sesion de verdad, sin la manga ancha de la transicion.
 *
 * `RolesGuard` deja pasar cuando NO hay usuario ("si no hay usuario, dejar
 * pasar", resto de la migracion Firebase→NestJS), y `JwtAuthGuard` solo
 * rechaza si `AUTH_ENFORCE_WRITES=true`. En produccion esa variable esta
 * puesta, pero un endpoint que DESPLIEGA no puede depender de que una variable
 * de entorno siga puesta manana, ni quedar abierto en local.
 *
 * Se aplica a las escrituras de la bitacora, delante de RolesGuard.
 */
@Injectable()
export class SesionRequeridaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string };
    }>();
    if (!request?.user) {
      throw new UnauthorizedException('Hace falta iniciar sesion');
    }
    return true;
  }
}

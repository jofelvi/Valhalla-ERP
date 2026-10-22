import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que permite acceso sin token (para transición Firebase → NestJS).
 * Si hay token, lo valida. Si no hay token, deja pasar igual.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // Si no hay token, dejar pasar
    if (!authHeader) {
      return true;
    }

    // Si hay token, validarlo
    return super.canActivate(context);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleRequest(
    err: any,
    user: any,
    _info: any,
    _context?: any,
    _status?: any,
  ) {
    // Si hay error o no hay user, no lanzar excepción
    if (err || !user) {
      return null;
    }
    return user;
  }
}

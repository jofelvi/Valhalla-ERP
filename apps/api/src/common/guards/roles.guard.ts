import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { decideRoleAuth, isRoleEnforceEnabled } from './role-auth-policy';

interface RequestConUsuario {
  method?: string;
  url?: string;
  originalUrl?: string;
  ip?: string;
  user?: { role?: string };
  headers?: Record<string, string | string[] | undefined>;
}

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const user = request.user;

    const decision = decideRoleAuth({
      requiresRoles: !!requiredRoles,
      hasUser: !!user,
      userRole: user?.role,
      requiredRoles: requiredRoles ?? [],
      enforce: isRoleEnforceEnabled(process.env),
    });

    if (decision.action === 'allow') return true;

    const client = request.headers?.['x-client-type'] ?? 'desconocido';
    const version = request.headers?.['x-app-version'] ?? '?';
    const ruta = request.originalUrl ?? request.url ?? '';
    const detalle =
      `${request.method} ${ruta} cliente=${String(client)}:${String(version)} ` +
      `ip=${request.ip ?? '?'} — ${decision.reason ?? ''}`;

    if (decision.action === 'deny') {
      // Anonimo con enforce, o rol que no calza (esto ultimo ya pasaba hoy).
      this.logger.warn(`[roles] RECHAZADA: ${detalle}`);
      throw new ForbiddenException(
        'No tienes permiso para realizar esta accion',
      );
    }

    // Auditoria: se permite al anonimo, pero queda el rastro para poder cerrar.
    this.logger.warn(
      `[roles-audit] ruta con rol sin sesion (permitida): ${detalle}`,
    );
    return true;
  }
}

import { interruptorApagado } from './write-auth-policy';

/**
 * Politica de autorizacion por rol (@Roles).
 *
 * Contexto: durante la migracion Firebase→NestJS el RolesGuard quedo con una
 * puerta trasera — si NO habia usuario autenticado, dejaba pasar aunque la ruta
 * exigiera un rol (`if (!user) return true`). Efecto real: los `@Roles` de 29
 * controllers eran groundwork inerte; p.ej. `GET /customers` sin token
 * respondia 200 y exponia las fichas de clientes.
 *
 * No se puede cerrar de golpe: prender el control afecta a TODOS los `@Roles`
 * a la vez y en produccion hay trafico legitimo sin token (claims de mesa,
 * ordenes de APKs viejas). Se cierra igual que las escrituras
 * (write-auth-policy), con el interruptor `AUTH_ENFORCE_ROLES`:
 *
 *   1. AUDITORIA (por defecto): deja pasar al anonimo pero deja un WARN con
 *      metodo, ruta, cliente y version — para identificar quien pega sin token
 *      ANTES de cerrar.
 *   2. ENFORCE (AUTH_ENFORCE_ROLES=true): responde 403.
 *
 * El caso "usuario autenticado con rol que NO coincide" NO depende del flag:
 * eso ya se rechazaba hoy y se sigue rechazando (403). El flag solo gobierna
 * al anonimo. Se activa/revierte con un restart, sin redeploy.
 */

export type RoleAuthAction = 'allow' | 'audit' | 'deny';

export interface RoleAuthDecision {
  action: RoleAuthAction;
  /** Motivo legible, para el log de auditoria o el mensaje de error. */
  reason?: string;
}

export interface RoleAuthInput {
  /** ¿La ruta exige roles (tiene decorador @Roles)? */
  requiresRoles: boolean;
  /** ¿Passport resolvio un usuario valido a partir del token? */
  hasUser: boolean;
  /** Rol del usuario resuelto, si lo hay. */
  userRole?: string;
  /** Roles permitidos declarados por @Roles. */
  requiredRoles: string[];
  /** true = rechazar al anonimo; false = solo auditar. */
  enforce: boolean;
}

export function decideRoleAuth(input: RoleAuthInput): RoleAuthDecision {
  const { requiresRoles, hasUser, userRole, requiredRoles, enforce } = input;

  // Sin @Roles: la ruta no restringe por rol, pasa siempre.
  if (!requiresRoles) return { action: 'allow' };

  // Anonimo (sin usuario): es el hueco que cerramos gradualmente.
  if (!hasUser) {
    const reason = 'ruta exige rol y no hay sesion';
    return enforce
      ? { action: 'deny', reason }
      : { action: 'audit', reason: `${reason} (permitido en auditoria)` };
  }

  // Con usuario: el rol debe coincidir. Esto NO depende del flag: ya se aplica
  // hoy (el guard devolvia false → 403 cuando el rol no calzaba).
  const autorizado = requiredRoles.some((role) => role === userRole);
  return autorizado
    ? { action: 'allow' }
    : { action: 'deny', reason: `rol ${userRole ?? '?'} no autorizado` };
}

/**
 * AUTH_ENFORCE_ROLES: por defecto activo (el anónimo recibe 403 donde se exige
 * rol). Solo "false", "0", "off" o "audit" vuelven al modo auditoría.
 */
export function isRoleEnforceEnabled(
  env: Record<string, string | undefined>,
): boolean {
  return !interruptorApagado(env.AUTH_ENFORCE_ROLES);
}

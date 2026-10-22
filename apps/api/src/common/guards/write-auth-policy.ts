/**
 * Politica de autenticacion para escrituras.
 *
 * Contexto: durante la migracion Firebase→NestJS los guards se dejaron
 * permisivos (JwtAuthGuard.handleRequest devuelve null en vez de lanzar, y
 * RolesGuard pasa si no hay user). Efecto real: cualquiera puede hacer
 * POST/PATCH/DELETE sin credenciales.
 *
 * No se puede cerrar de golpe: la auditoria de logs de produccion mostro
 * escrituras legitimas llegando sin token (claims de mesa, alguna orden), asi
 * que bloquear de una dejaria al restaurante sin poder operar.
 *
 * De ahi los dos modos:
 *   - AUDITORIA (por defecto): deja pasar y REGISTRA quien escribe sin token,
 *     para poder arreglar esos clientes con datos en la mano.
 *   - ENFORCE (AUTH_ENFORCE_WRITES=true): rechaza con 401.
 *
 * El interruptor es una variable de entorno para poder activar/revertir con un
 * restart, sin redeploy, si algo se rompe en plena operacion.
 */

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type WriteAuthAction = 'allow' | 'audit' | 'deny';
export type ReadAuthMode = 'open' | 'audit' | 'enforce';

export interface WriteAuthDecision {
  action: WriteAuthAction;
  /** Motivo legible, para el log de auditoria o el mensaje de error. */
  reason?: string;
}

export interface WriteAuthInput {
  method: string;
  /** ¿Passport resolvio un usuario valido a partir del token? */
  hasUser: boolean;
  /** ¿Venia header Authorization (aunque fuera invalido)? */
  hasAuthHeader: boolean;
  /** true = rechazar; false = solo auditar. */
  enforce: boolean;
  /** Lecturas sin sesion: abiertas (hoy), auditadas o rechazadas. */
  readMode: ReadAuthMode;
}

export function decideWriteAuth(input: WriteAuthInput): WriteAuthDecision {
  const { method, hasUser, hasAuthHeader, enforce, readMode } = input;

  // Sesion valida: pasa siempre.
  if (hasUser) return { action: 'allow' };

  const m = (method ?? '').toUpperCase();

  // El preflight de CORS nunca lleva token: cerrarlo rompe el navegador.
  if (m === 'OPTIONS') return { action: 'allow' };

  // Lecturas: se aplica la politica de readMode.
  if (READ_METHODS.has(m)) {
    if (readMode === 'open') return { action: 'allow' };
    const reason = hasAuthHeader
      ? 'lectura con token invalido o expirado'
      : 'lectura sin header Authorization';
    return { action: readMode === 'enforce' ? 'deny' : 'audit', reason };
  }

  // Escritura sin sesion valida. Se distingue el caso para el log: un token
  // presente pero rechazado (expirado/corrupto) es mas grave que no mandar
  // ninguno, porque significa que el cliente CREE estar autenticado.
  const reason = hasAuthHeader
    ? 'token presente pero invalido o expirado'
    : 'sin header Authorization';

  return { action: enforce ? 'deny' : 'audit', reason };
}

/**
 * Valores que APAGAN un interruptor. Esta instalación nace sin clientes viejos
 * que escriban sin token, así que lo seguro es el valor por defecto: todo se
 * rechaza salvo que alguien lo relaje de forma explícita.
 */
const APAGADO = new Set(['false', '0', 'off', 'audit']);

export const interruptorApagado = (valor: string | undefined): boolean =>
  APAGADO.has(
    String(valor ?? '')
      .trim()
      .toLowerCase(),
  );

/**
 * AUTH_ENFORCE_READS: por defecto "enforce" (lecturas sin sesión rechazadas en
 * los controladores protegidos). "audit" registra y deja pasar; "open" o
 * "false" las abre del todo.
 */
export function readAuthMode(
  env: Record<string, string | undefined>,
): ReadAuthMode {
  const v = String(env.AUTH_ENFORCE_READS ?? '')
    .trim()
    .toLowerCase();
  if (v === 'audit') return 'audit';
  if (v === 'open' || v === 'false' || v === '0' || v === 'off') return 'open';
  return 'enforce';
}

/**
 * AUTH_ENFORCE_WRITES: por defecto activo. Solo "false", "0", "off" o "audit"
 * vuelven al modo auditoría (deja pasar y registra).
 */
export function isEnforceEnabled(
  env: Record<string, string | undefined>,
): boolean {
  return !interruptorApagado(env.AUTH_ENFORCE_WRITES);
}

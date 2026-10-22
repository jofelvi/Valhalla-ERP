import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS ?? 1000);
const BODY_MAX_CHARS = Number(process.env.LOG_BODY_MAX_CHARS ?? 2000);
const STRING_MAX_CHARS = 200;

// Rutas ruidosas cuyo payload es irrelevante para trazabilidad.
// Incluir polling: print-queue, health, session.
const NOISY_PATHS = [
  '/api/print-queue/pending',
  '/api/auth/session',
  '/health',
];

// Campos cuyo valor NUNCA debe ir al log (secretos o blobs pesados).
const REDACT_FIELDS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'token',
  'accessToken',
  'refreshToken',
  'pin',
  'adminPin',
  'pdfBase64',
  'imageBase64',
  'fileBase64',
]);

interface AuthedUser {
  id?: string;
  email?: string;
  role?: string;
}

interface AuthedRequest extends Request {
  user?: AuthedUser;
}

function detectOrigin(req: Request): string {
  const clientType = String(req.headers['x-client-type'] ?? '').toLowerCase();
  if (clientType === 'apk' || clientType === 'web') return clientType;

  // Fallback para clientes viejos que no mandan X-Client-Type.
  const ua = String(req.headers['user-agent'] ?? '').toLowerCase();
  if (
    ua.includes('okhttp') ||
    ua.includes('expo') ||
    ua.includes('react-native')
  ) {
    return 'apk';
  }
  if (
    ua.includes('mozilla') ||
    ua.includes('chrome') ||
    ua.includes('safari')
  ) {
    return 'web';
  }
  return 'unknown';
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > STRING_MAX_CHARS
      ? `${value.slice(0, STRING_MAX_CHARS)}…[${value.length}ch]`
      : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map(redactValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (REDACT_FIELDS.has(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactValue(v);
      }
    }
    return out;
  }
  return value;
}

function stringifyBody(body: unknown): string {
  if (body == null) return '';
  try {
    const redacted = redactValue(body);
    const json = JSON.stringify(redacted);
    return json.length > BODY_MAX_CHARS
      ? `${json.slice(0, BODY_MAX_CHARS)}…[truncado ${json.length}b]`
      : json;
  } catch {
    return '[unserializable]';
  }
}

// Middleware HTTP con trazabilidad completa: userId, origen (apk/web), IP,
// payload redactado (solo en 4xx/5xx para no spamear), duracion y status.
// Diseñado para que cuando un error aparezca en produccion se sepa EXACTAMENTE
// quien lo disparo, desde donde, con que datos.
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: AuthedRequest, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    const { method, originalUrl } = req;
    const origin = detectOrigin(req);
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ||
      req.socket.remoteAddress ||
      '-';
    const bodySnapshot = req.body; // parseado por json() antes de este middleware
    const isNoisy = NOISY_PATHS.some((p) => originalUrl.startsWith(p));

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const status = res.statusCode;
      const user = req.user;
      const userTag = user?.id
        ? `user=${user.id}${user.email ? `(${user.email})` : ''}${user.role ? `:${user.role}` : ''}`
        : 'user=anon';
      const base = `[${origin}] ${method} ${originalUrl} ${status} ${durationMs.toFixed(0)}ms ${userTag} ip=${ip}`;

      const shouldLogBody =
        (status >= 400 || process.env.DEBUG_HTTP === '1') &&
        !isNoisy &&
        method !== 'GET' &&
        bodySnapshot != null;
      const bodyTag = shouldLogBody
        ? ` body=${stringifyBody(bodySnapshot)}`
        : '';

      if (status >= 500) {
        this.logger.error(`${base}${bodyTag}`);
      } else if (status >= 400) {
        this.logger.warn(`${base}${bodyTag}`);
      } else if (durationMs >= SLOW_REQUEST_MS) {
        this.logger.warn(`SLOW ${base}`);
      } else if (process.env.DEBUG_HTTP === '1' && !isNoisy) {
        this.logger.log(`${base}${bodyTag}`);
      }
    });

    res.on('close', () => {
      if (!res.writableEnded) {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        const user = req.user;
        const userTag = user?.id ? `user=${user.id}` : 'user=anon';
        this.logger.warn(
          `ABORTED [${origin}] ${method} ${originalUrl} ${durationMs.toFixed(0)}ms ${userTag} ip=${ip} (cliente desconecto)`,
        );
      }
    });

    next();
  }
}

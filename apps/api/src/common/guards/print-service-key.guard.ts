import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  decidePrintServiceKey,
  PRINT_SERVICE_KEY_HEADER,
} from './print-service-key';

/** Endpoints que usa el print-service de la caja (ver print-service-key.ts). */
@Injectable()
export class PrintServiceKeyGuard implements CanActivate {
  private readonly logger = new Logger('PrintServiceKey');
  // El print-service sondea cada pocos segundos: en auditoria basta un aviso
  // cada 10 min por origen y motivo, no uno por peticion.
  private readonly ultimoAviso = new Map<string, number>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const decision = decidePrintServiceKey(
      req.headers[PRINT_SERVICE_KEY_HEADER],
      process.env,
    );
    if (decision.action === 'allow') return true;

    const quien = `${req.method} ${req.originalUrl} desde ${req.ip ?? '?'}`;
    if (decision.action === 'deny') {
      this.logger.warn(`[print-key] RECHAZADO ${quien}: ${decision.reason}`);
      throw new UnauthorizedException(decision.reason);
    }
    const llave = `${req.ip ?? '?'}|${decision.reason}`;
    const ahora = Date.now();
    if (ahora - (this.ultimoAviso.get(llave) ?? 0) > 10 * 60_000) {
      this.ultimoAviso.set(llave, ahora);
      this.logger.warn(`[print-key] auditoria ${quien}: ${decision.reason}`);
    }
    return true;
  }
}

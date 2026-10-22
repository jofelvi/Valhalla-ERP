import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { connect, constants, type ClientHttp2Session } from 'node:http2';
import type { PushPayload } from './push.service';
import { signApnsJwt } from './apns-jwt.util';
import { buildApnsPayload } from './apns-payload';

/**
 * Envio de push a iPhones por APNs directo (HTTP/2 + token auth con la .p8).
 *
 * El iPhone registra su token APNs (via expo-notifications) y aqui se le entrega
 * directo, sin pasar por FCM. Android sigue por FCM en PushService. Todo es
 * tolerante a fallos: sin config (.p8/env) queda inerte y no rompe el flujo.
 */

const HOST_PROD = 'https://api.push.apple.com';
const HOST_SANDBOX = 'https://api.sandbox.push.apple.com';
const JWT_TTL_MS = 50 * 60 * 1000; // Apple rechaza tokens de mas de 60min.

export interface ApnsSendResult {
  ok: boolean;
  /** El token ya no sirve (app desinstalada / token invalido): limpiarlo. */
  unregistered: boolean;
}

interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKeyPem: string;
  host: string;
}

@Injectable()
export class ApnsService {
  private readonly logger = new Logger(ApnsService.name);
  private readonly config: ApnsConfig | null = null;
  private session: ClientHttp2Session | null = null;
  private jwt = '';
  private jwtIssuedAt = 0;

  constructor(private readonly configService: ConfigService) {
    const keyPath = (
      this.configService.get<string>('APNS_KEY_PATH') ?? ''
    ).trim();
    const keyId = (this.configService.get<string>('APNS_KEY_ID') ?? '').trim();
    const teamId = (
      this.configService.get<string>('APNS_TEAM_ID') ?? ''
    ).trim();
    const bundleId = (
      this.configService.get<string>('APNS_BUNDLE_ID') ?? ''
    ).trim();
    const production =
      (
        this.configService.get<string>('APNS_PRODUCTION') ?? 'true'
      ).toLowerCase() !== 'false';

    if (!keyPath || !keyId || !teamId || !bundleId) {
      this.logger.log(
        'APNs desactivado: falta APNS_KEY_PATH/KEY_ID/TEAM_ID/BUNDLE_ID',
      );
      return;
    }
    try {
      const privateKeyPem = readFileSync(keyPath, 'utf8');
      this.config = {
        keyId,
        teamId,
        bundleId,
        privateKeyPem,
        host: production ? HOST_PROD : HOST_SANDBOX,
      };
      this.logger.log(
        `APNs habilitado (${production ? 'produccion' : 'sandbox'}, topic ${bundleId})`,
      );
    } catch (err) {
      this.logger.error(
        `APNs desactivado: no se pudo leer ${keyPath}: ${(err as Error).message}`,
      );
    }
  }

  get enabled(): boolean {
    const flag = this.configService.get<string>('PUSH_ENABLED');
    if (flag !== undefined && flag.toLowerCase() === 'false') return false;
    return this.config !== null;
  }

  /** JWT del provider, cacheado ~50min. */
  private providerToken(): string {
    if (!this.config) throw new Error('APNs no configurado');
    if (this.jwt && Date.now() - this.jwtIssuedAt < JWT_TTL_MS) return this.jwt;
    const iat = Math.floor(Date.now() / 1000);
    this.jwt = signApnsJwt(
      this.config.keyId,
      this.config.teamId,
      this.config.privateKeyPem,
      iat,
    );
    this.jwtIssuedAt = Date.now();
    return this.jwt;
  }

  /** Sesion HTTP/2 reusada; se reconecta si Apple la cerro. */
  private getSession(host: string): ClientHttp2Session {
    if (this.session && !this.session.closed && !this.session.destroyed) {
      return this.session;
    }
    const session = connect(host);
    // Sin handler, un error de red emitiria 'error' sin captura y tumbaria el
    // proceso. Aqui solo lo anulamos para reconectar en el proximo envio.
    session.on('error', (err) => {
      this.logger.warn(`Sesion APNs con error: ${err.message}`);
      if (this.session === session) this.session = null;
    });
    session.on('close', () => {
      if (this.session === session) this.session = null;
    });
    this.session = session;
    return session;
  }

  /**
   * Entrega un aviso a un token APNs. Nunca lanza por errores esperados; retorna
   * `{ ok, unregistered }`. Solo relanza fallos de red inesperados.
   */
  async sendToToken(
    token: string,
    payload: PushPayload,
  ): Promise<ApnsSendResult> {
    if (!this.config) return { ok: false, unregistered: false };

    const { body, collapseId } = buildApnsPayload(payload);
    const json = JSON.stringify(body);
    const session = this.getSession(this.config.host);
    const jwt = this.providerToken();

    return new Promise<ApnsSendResult>((resolve, reject) => {
      const req = session.request({
        [constants.HTTP2_HEADER_METHOD]: 'POST',
        [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
        [constants.HTTP2_HEADER_SCHEME]: 'https',
        authorization: `bearer ${jwt}`,
        'apns-topic': this.config!.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-collapse-id': collapseId,
        'content-type': 'application/json',
      });

      let status = 0;
      let data = '';
      req.setEncoding('utf8');
      req.on('response', (headers) => {
        status = Number(headers[constants.HTTP2_HEADER_STATUS]) || 0;
      });
      req.on('data', (chunk: string) => {
        data += chunk;
      });
      req.on('error', reject);
      req.on('end', () => {
        if (status === 200) {
          resolve({ ok: true, unregistered: false });
          return;
        }
        // 410 = token muerto; 400 BadDeviceToken = token invalido → limpiar.
        const unregistered =
          status === 410 ||
          data.includes('BadDeviceToken') ||
          data.includes('Unregistered');
        if (unregistered) {
          resolve({ ok: false, unregistered: true });
          return;
        }
        this.logger.warn(`APNs ${status}: ${data.slice(0, 160)}`);
        resolve({ ok: false, unregistered: false });
      });

      req.write(json);
      req.end();
    });
  }
}

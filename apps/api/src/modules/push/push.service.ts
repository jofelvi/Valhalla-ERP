import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { buildFcmMessage } from './push-fcm-message';
import { ApnsService } from './apns.service';

/**
 * Envio de notificaciones push por FCM HTTP v1.
 *
 * Sin firebase-admin a proposito: FCM v1 solo pide un access token OAuth2
 * firmado con la clave del service account (RS256 con node:crypto) y un POST.
 * Misma tecnica que ya corre en el sms-bridge — cero dependencias nuevas en
 * un backend que ya pesa.
 *
 * Queda inerte si falta FCM_SERVICE_ACCOUNT_PATH o si PUSH_ENABLED=false: el
 * flujo que lo invoca (entregar en cocina) NUNCA puede romperse por esto.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Viaja al telefono para abrir la pantalla correcta al tocar el aviso. */
  data?: Record<string, string>;
  /** Canal de Android (la app crea "kitchen" con sonido propio). */
  channelId?: string;
}

const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

const base64url = (input: Buffer | string): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly account: ServiceAccount | null = null;
  private accessToken = '';
  private tokenExpiresAt = 0;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly apns: ApnsService,
  ) {
    const path = (
      this.configService.get<string>('FCM_SERVICE_ACCOUNT_PATH') ?? ''
    ).trim();
    if (!path) {
      this.logger.log('Push desactivado: falta FCM_SERVICE_ACCOUNT_PATH');
      return;
    }
    try {
      const raw = JSON.parse(
        readFileSync(path, 'utf8'),
      ) as Partial<ServiceAccount>;
      if (!raw.project_id || !raw.client_email || !raw.private_key) {
        throw new Error('faltan project_id/client_email/private_key');
      }
      this.account = {
        project_id: raw.project_id,
        client_email: raw.client_email,
        private_key: raw.private_key,
      };
      this.logger.log(`Push por FCM habilitado (proyecto ${raw.project_id})`);
    } catch (err) {
      this.logger.error(
        `Push desactivado: no se pudo leer ${path}: ${(err as Error).message}`,
      );
    }
  }

  get enabled(): boolean {
    const flag = this.configService.get<string>('PUSH_ENABLED');
    if (flag !== undefined && flag.toLowerCase() === 'false') return false;
    return this.account !== null;
  }

  /** Hay algun canal disponible (FCM para Android o APNs para iOS). */
  private get anyChannelEnabled(): boolean {
    return this.enabled || this.apns.enabled;
  }

  // ─── Registro de tokens ───

  /**
   * Guarda (o refresca) el token de un dispositivo. Si el token ya estaba en
   * OTRO usuario se le quita: significa que ese telefono cambio de dueno y no
   * puede seguir recibiendo avisos de ordenes ajenas.
   */
  async registerToken(
    userId: string,
    token: string,
    platform = 'android',
    deviceName?: string,
  ): Promise<void> {
    const clean = token.trim();
    if (!clean) return;

    await this.userModel.updateMany(
      { _id: { $ne: userId }, 'pushTokens.token': clean },
      { $pull: { pushTokens: { token: clean } } },
    );
    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { pushTokens: { token: clean } } },
    );
    await this.userModel.updateOne(
      { _id: userId },
      {
        $push: {
          pushTokens: {
            token: clean,
            platform,
            deviceName: deviceName ?? null,
            updatedAt: new Date(),
          },
        },
      },
    );
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $pull: { pushTokens: { token: token.trim() } } },
    );
  }

  // ─── Envio ───

  /**
   * Notifica a varios usuarios. Devuelve cuantos envios salieron bien.
   * Los errores se loguean y se tragan: quien llama esta en un flujo de
   * operacion (entregar comida) que no puede fallar por una notificacion.
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
    if (!this.anyChannelEnabled || userIds.length === 0) return 0;

    const users = await this.userModel
      .find(
        { _id: { $in: userIds }, 'pushTokens.0': { $exists: true } },
        { pushTokens: 1 },
      )
      .lean()
      .exec();

    // Cada token con su plataforma: iOS va por APNs, el resto por FCM. Se
    // deduplica por token (un mismo telefono no debe recibir dos avisos).
    const byToken = new Map<string, string>();
    for (const u of users) {
      for (const t of (u.pushTokens ?? []) as Array<{
        token: string;
        platform?: string;
      }>) {
        if (t.token && !byToken.has(t.token)) {
          byToken.set(t.token, (t.platform ?? 'android').toLowerCase());
        }
      }
    }
    if (byToken.size === 0) return 0;

    let ok = 0;
    for (const [token, platform] of byToken) {
      try {
        if (platform === 'ios') {
          if (!this.apns.enabled) continue;
          const res = await this.apns.sendToToken(token, payload);
          if (res.ok) ok++;
          else if (res.unregistered) await this.cleanToken(token);
        } else {
          if (!this.enabled) continue;
          await this.sendToToken(token, payload);
          ok++;
        }
      } catch (err) {
        this.logger.warn(`Push fallido: ${(err as Error).message}`);
      }
    }
    return ok;
  }

  /** Quita un token muerto de todos los usuarios para no insistir. */
  private async cleanToken(token: string): Promise<void> {
    await this.userModel.updateMany(
      { 'pushTokens.token': token },
      { $pull: { pushTokens: { token } } },
    );
    this.logger.log('Token push vencido eliminado');
  }

  private async sendToToken(
    token: string,
    payload: PushPayload,
  ): Promise<void> {
    if (!this.account) return;
    const accessToken = await this.getAccessToken();

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildFcmMessage(token, payload)),
      },
    );

    if (res.ok) return;

    const body = await res.text();
    // Token de una app desinstalada o reinstalada: se limpia para no insistir.
    if (res.status === 404 || body.includes('UNREGISTERED')) {
      await this.userModel.updateMany(
        { 'pushTokens.token': token },
        { $pull: { pushTokens: { token } } },
      );
      this.logger.log('Token push vencido eliminado');
      return;
    }
    throw new Error(`FCM ${res.status}: ${body.slice(0, 200)}`);
  }

  /** Access token OAuth2 del service account, cacheado ~55 min. */
  private async getAccessToken(): Promise<string> {
    if (!this.account) throw new Error('Push no configurado');
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({
        iss: this.account.client_email,
        scope: SCOPE,
        aud: OAUTH_URL,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    const assertion = `${header}.${claims}.${base64url(
      signer.sign(this.account.private_key),
    )}`;

    const res = await fetch(OAUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) throw new Error(`OAuth ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = json.access_token;
    this.tokenExpiresAt = Date.now() + (json.expires_in - 300) * 1000;
    return this.accessToken;
  }
}

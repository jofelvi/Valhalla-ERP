import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface PendingPhoto {
  invoiceUrl: string;
  ocrText: string;
}

export interface TelegramSession<TDraft> {
  chatId: number;
  step: string;
  draft: TDraft;
  pendingPhoto?: PendingPhoto;
  updatedAt: Date;
}

/**
 * La conversacion de cada socio vive en Mongo y no en memoria: un
 * `pm2 restart` a mitad de una compra no la pierde. Caduca sola a las 2 h.
 */
@Injectable()
export class SessionStore {
  private readonly logger = new Logger(SessionStore.name);
  private static readonly COLLECTION = 'telegram_sessions';
  private static readonly TTL_SEG = 2 * 3600;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private col() {
    return this.connection.collection(SessionStore.COLLECTION);
  }

  async ensureIndexes(): Promise<void> {
    try {
      await this.col().createIndex({ updatedAt: 1 }, { expireAfterSeconds: SessionStore.TTL_SEG });
    } catch (error) {
      this.logger.warn(
        `No se pudo crear el TTL de sesiones: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async get<TDraft>(chatId: number): Promise<TelegramSession<TDraft> | null> {
    const doc = await this.col().findOne({ _id: chatId as never });
    if (!doc) return null;
    return {
      chatId,
      step: String(doc.step),
      draft: doc.draft as TDraft,
      pendingPhoto: (doc.pendingPhoto as PendingPhoto | undefined) ?? undefined,
      updatedAt: doc.updatedAt as Date,
    };
  }

  async set<TDraft>(
    chatId: number,
    data: { step: string; draft: TDraft; pendingPhoto?: PendingPhoto | null },
  ): Promise<void> {
    await this.col().updateOne(
      { _id: chatId as never },
      {
        $set: {
          step: data.step,
          draft: data.draft,
          pendingPhoto: data.pendingPhoto ?? null,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  async clear(chatId: number): Promise<void> {
    await this.col().deleteOne({ _id: chatId as never });
  }
}

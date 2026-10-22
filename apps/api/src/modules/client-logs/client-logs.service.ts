import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientLog, ClientLogDocument } from './schemas/client-log.schema';

export interface ClientLogInput {
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  context?: Record<string, unknown> | null;
  stack?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  clientTime?: string; // ISO capturado cuando ocurrió el evento
}

@Injectable()
export class ClientLogsService {
  private readonly logger = new Logger('ClientLog');

  constructor(
    @InjectModel(ClientLog.name)
    private readonly model: Model<ClientLogDocument>,
  ) {}

  /**
   * Loguea un evento de cliente. `error` y `warn` se persisten a Mongo (TTL
   * 30 dias). `info` va solo a pm2 logs para no saturar la coleccion.
   */
  async record(input: ClientLogInput): Promise<void> {
    const line = this.buildLogLine(input);
    if (input.level === 'error') this.logger.error(line);
    else if (input.level === 'warn') this.logger.warn(line);
    else this.logger.log(line);

    if (input.level === 'info') return;

    try {
      await this.model.create({
        level: input.level,
        source: input.source,
        message: input.message,
        context: input.context ?? null,
        stack: input.stack ?? null,
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        platform: input.platform ?? null,
        appVersion: input.appVersion ?? null,
        // Preservar clientTime si viene en el payload (capturado cuando
        // ocurrió el evento en el cliente). Si no viene, asignar ahora.
        clientTime: input.clientTime ?? new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo persistir client-log: ${(err as Error).message}`,
      );
    }
  }

  async recordBatch(inputs: ClientLogInput[]): Promise<void> {
    for (const input of inputs) {
      await this.record(input);
    }
  }

  async findRecent(filters: {
    level?: 'info' | 'warn' | 'error';
    source?: string;
    platform?: string;
    appVersion?: string;
    userId?: string;
    limit?: number;
    since?: Date;
  }) {
    const q: Record<string, unknown> = {};
    if (filters.level) q.level = filters.level;
    if (filters.source) q.source = filters.source;
    if (filters.platform) q.platform = filters.platform;
    if (filters.appVersion) q.appVersion = filters.appVersion;
    if (filters.userId) q.userId = filters.userId;
    if (filters.since) q.createdAt = { $gte: filters.since };

    const docs = await this.model
      .find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(filters.limit ?? 200, 1000))
      .lean()
      .exec();
    return docs.map((d) => ({ ...d, id: d._id }));
  }

  /**
   * Retorna episodios de conectividad (outage-start/outage-end) para un mes específico.
   * Calcula resumen: cantidad total, duración máxima, minutos totales offline.
   */
  async getConnectivityEpisodes(opts: {
    year: number;
    month: number;
  }): Promise<Record<string, unknown>[]> {
    const startDate = new Date(opts.year, opts.month - 1, 1);
    const endDate = new Date(opts.year, opts.month, 1);

    const docs = await this.model
      .find({
        $or: [
          { 'context.evento': 'outage-start' },
          { 'context.evento': 'outage-end' },
        ],
        clientTime: { $gte: startDate.toISOString(), $lt: endDate.toISOString() },
      })
      .sort({ clientTime: -1 })
      .lean()
      .exec();

    if (docs.length === 0) {
      return [];
    }

    // Agrupar episodios: inicio + fin = 1 episodio completo
    const episodes: Record<string, Record<string, unknown>> = {};
    const grouped: Record<string, Record<string, unknown>> = {};

    for (const doc of docs) {
      const context = doc.context as Record<string, unknown> | null;
      if (!context) continue;

      const evento = context.evento as string;
      const inicioClientTime = context.inicioClientTime as string;

      if (!inicioClientTime) continue;

      if (!grouped[inicioClientTime]) {
        grouped[inicioClientTime] = { inicioClientTime };
      }

      if (evento === 'outage-start') {
        grouped[inicioClientTime].start = doc;
      } else if (evento === 'outage-end') {
        grouped[inicioClientTime].end = doc;
        grouped[inicioClientTime].durationMs = context.duracionMs ?? 0;
      }
    }

    // Convertir a array
    const episodesList = Object.values(grouped);

    // Calcular resumen
    const duraciones = episodesList
      .map((ep) => ep.durationMs as number)
      .filter((d) => d > 0);

    const summary: Record<string, unknown> = {
      count: episodesList.length,
      maxDurationMs: duraciones.length > 0 ? Math.max(...duraciones) : 0,
      totalMinutes:
        duraciones.length > 0
          ? Math.round(
              (duraciones.reduce((a, b) => a + b, 0) / 1000 / 60) * 100,
            ) / 100
          : 0,
    };

    return [...episodesList, { summary }];
  }

  private buildLogLine(input: ClientLogInput): string {
    const user = input.userEmail ?? input.userId ?? 'anon';
    const platform = input.platform ?? '?';
    const ver = input.appVersion ?? '?';
    const ctx = input.context
      ? ` ctx=${JSON.stringify(input.context).slice(0, 800)}`
      : '';
    return `[${platform}:${ver}] ${input.source} user=${user} :: ${input.message}${ctx}`;
  }
}

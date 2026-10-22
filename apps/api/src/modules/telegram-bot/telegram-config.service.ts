import { Injectable, Logger } from '@nestjs/common';
import { ConfigsService } from '../configs/configs.service';

export interface SocioAutorizado {
  telegramId: number;
  socio: string;
  userId?: string;
}

export interface TelegramBotConfig {
  allowed: SocioAutorizado[];
  groupChatId: number | null;
  reportChatIds: number[];
  weeklyReportHourVe: number;
  /** Minuto del disparo semanal. Sin el, el informe solo podia salir en punto. */
  weeklyReportMinuteVe: number;
  dailySummaryHourVe: number | null;
}

/**
 * `configs/telegram_bot`. Vive en Mongo para dar de alta un socio o cambiar
 * el grupo sin desplegar. Sin documento el bot no atiende a nadie: es el lado
 * seguro.
 */
@Injectable()
export class TelegramConfigService {
  private readonly logger = new Logger(TelegramConfigService.name);

  constructor(private readonly configs: ConfigsService) {}

  async leer(): Promise<TelegramBotConfig> {
    return this.configs.obtenerCrudo('telegram_bot', (doc) => {
      const valor: TelegramBotConfig = {
        allowed: [],
        groupChatId: null,
        reportChatIds: [],
        weeklyReportHourVe: 8,
        weeklyReportMinuteVe: 0,
        dailySummaryHourVe: 23,
      };
      if (!doc) return valor;
      const allowed = (Array.isArray(doc.allowed) ? doc.allowed : [])
        .filter(
          (a: unknown): a is SocioAutorizado =>
            typeof a === 'object' &&
            a !== null &&
            typeof (a as SocioAutorizado).telegramId === 'number' &&
            typeof (a as SocioAutorizado).socio === 'string',
        )
        .map((a) => ({
          telegramId: a.telegramId,
          socio: a.socio,
          userId: a.userId,
        }));
      const groupChatId =
        typeof doc.groupChatId === 'number' ? doc.groupChatId : null;
      const reportChatIds = Array.isArray(doc.reportChatIds)
        ? (doc.reportChatIds as unknown[]).filter(
            (x): x is number => typeof x === 'number',
          )
        : groupChatId !== null
          ? [groupChatId]
          : [];
      return {
        allowed,
        groupChatId,
        reportChatIds,
        weeklyReportHourVe:
          typeof doc.weeklyReportHourVe === 'number'
            ? doc.weeklyReportHourVe
            : 8,
        weeklyReportMinuteVe:
          typeof doc.weeklyReportMinuteVe === 'number'
            ? doc.weeklyReportMinuteVe
            : 0,
        dailySummaryHourVe:
          doc.dailySummaryHourVe === null
            ? null
            : typeof doc.dailySummaryHourVe === 'number'
              ? doc.dailySummaryHourVe
              : 23,
      };
    });
  }

  async socioDe(telegramId: number): Promise<SocioAutorizado | null> {
    const { allowed } = await this.leer();
    return allowed.find((a) => a.telegramId === telegramId) ?? null;
  }

  /**
   * Da de alta a alguien en `allowed`. Idempotente: si ya estaba (dos fotos
   * seguidas del mismo socio nuevo), devuelve el que habia.
   */
  async autorizar(telegramId: number, socio: string): Promise<SocioAutorizado> {
    await this.configs.actualizarCrudo(
      'telegram_bot',
      { 'allowed.telegramId': { $ne: telegramId } },
      { $push: { allowed: { telegramId, socio } } },
    );
    return (await this.socioDe(telegramId)) ?? { telegramId, socio };
  }

  invalidar(): void {
    this.configs.invalidar('telegram_bot');
  }
}

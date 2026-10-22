import { ConfigsService } from '../configs/configs.service';
import { Injectable, Logger } from '@nestjs/common';
import type { Api } from 'grammy';
import { TelegramConfigService } from './telegram-config.service';
import type { ExpenseLean } from '../expenses/schemas/expense.schema';
import type { StockAhora } from '../expenses/expenses.service';
import {
  formatearGastoTelegram,
  escapeHtml,
  montoDe,
  etiquetaDe,
} from '../expenses/expenses-report.helper';

/**
 * Difusion al grupo de socios. Nunca lanza: si el grupo no esta configurado
 * o Telegram falla, el gasto ya quedo registrado y eso es lo que importa.
 */
@Injectable()
export class GroupNotifierService {
  private readonly logger = new Logger(GroupNotifierService.name);
  private api: Api | null = null;

  constructor(
    private readonly config: TelegramConfigService,
    private readonly configs: ConfigsService,
  ) {}

  attach(api: Api): void {
    this.api = api;
  }

  async publicarTexto(texto: string): Promise<void> {
    const { groupChatId } = await this.config.leer();
    if (!this.api || groupChatId === null) return;
    try {
      await this.api.sendMessage(groupChatId, texto, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.warn(
        `No se pudo publicar al grupo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async publicarGasto(e: ExpenseLean, stockAhora: StockAhora[]): Promise<void> {
    const { groupChatId } = await this.config.leer();
    if (!this.api || groupChatId === null) return;
    const operacion = await this.configs.obtener('operacion');
    const caption = formatearGastoTelegram(e, stockAhora, operacion);
    const foto = e.invoiceUrls[0];
    // Telegram limita el caption a 1024 chars; si se pasa, foto y texto aparte.
    const cabeCaption = Boolean(foto) && caption.length <= 1024;

    if (foto) {
      try {
        if (cabeCaption) {
          await this.api.sendPhoto(groupChatId, foto, {
            caption,
            parse_mode: 'HTML',
          });
          return; // el texto ya viajo en el caption
        }
        await this.api.sendPhoto(groupChatId, foto);
      } catch (error) {
        // Si Telegram no pudo traer la foto (ej: URL caida) el grupo igual
        // tiene que enterarse del gasto por texto — no se puede quedar sin
        // ninguna aviso.
        this.logger.warn(
          `No se pudo enviar la foto del gasto ${e._id} al grupo: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    try {
      await this.api.sendMessage(groupChatId, caption, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.warn(
        `No se pudo publicar el gasto ${e._id} al grupo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  publicarPago(e: ExpenseLean, socio: string): Promise<void> {
    const fondos =
      e.fundsSource === 'PROPIOS'
        ? `propios de ${escapeHtml(e.paidBy ?? socio)}`
        : 'Negocio';
    return this.publicarTexto(
      `💵 <b>${escapeHtml(socio)}</b> pagó el crédito: ${etiquetaDe(e)} — ${montoDe(e)} (fondos ${fondos})`,
    );
  }

  publicarReembolso(e: ExpenseLean, socio: string): Promise<void> {
    return this.publicarTexto(
      `✔️ <b>${escapeHtml(socio)}</b> marcó reembolsado a ${escapeHtml(e.paidBy ?? '?')}: ${etiquetaDe(e)} — ${montoDe(e)}`,
    );
  }
}

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
// mongoose re-exporta su propio Collection (envuelve la version de mongodb
// que trae mongoose como dependencia); importarlo directo de 'mongodb'
// choca con la version distinta que hay hoisteada en la raiz del monorepo.
import type { Collection } from 'mongoose';
import {
  TelegramConfigService,
  TelegramBotConfig,
} from './telegram-config.service';
import { TelegramBotService } from './telegram-bot.service';
import { GroupNotifierService } from './group-notifier.service';
import { ExpensesReportService } from '../expenses/expenses-report.service';
import { InformePdfService } from '../expenses/informe-pdf.service';
import { ConfigsService } from '../configs/configs.service';
import { ejecutarSiModuloActivo } from '../../common/modulos/modulo-activo';
import type { InformeSemanal } from '../expenses/expenses-report.helper';
import { reportesVencidos } from './scheduler.helper';

interface SentReportDoc {
  _id: string;
  sentAt: Date;
}

/** Mismo patron que weekly-report.service: setInterval, sin @nestjs/schedule. */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('TelegramInformes');
  private timer: ReturnType<typeof setInterval> | null = null;
  private corriendo = false;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: TelegramConfigService,
    private readonly bot: TelegramBotService,
    private readonly grupo: GroupNotifierService,
    private readonly report: ExpensesReportService,
    private readonly pdf: InformePdfService,
    private readonly configs: ConfigsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () => {
        // Con el módulo apagado el informe no se arma ni se envía.
        ejecutarSiModuloActivo(this.configs, 'telegramBot', () =>
          this.tick(),
        ).catch((error: unknown) =>
          this.logger.error(
            `El tick de informes revento: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      },
      5 * 60 * 1000,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.corriendo || !this.bot.api()) return;
    this.corriendo = true;
    try {
      const cfg = await this.config.leer();
      const operacion = await this.configs.obtener('operacion');
      for (const r of reportesVencidos(now, cfg, operacion)) {
        // Un informe roto no debe frenar al otro en el mismo tick.
        try {
          if (r.kind === 'weekly') await this.enviarSemanal(r.id, now, cfg);
          else await this.enviarDiario(r.id, cfg);
        } catch (error) {
          this.logger.error(
            `Fallo el informe ${r.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } finally {
      this.corriendo = false;
    }
  }

  private async enviarSemanal(
    id: string,
    now: Date,
    cfg: TelegramBotConfig,
  ): Promise<void> {
    if (!(await this.reservar(id))) return; // ya se mando (o lo esta mandando otro tick)
    // El lunes cae dentro de la semana mar->mar que termina ese mismo dia:
    // es la semana que acaba de correr, no hay que restarle 7 dias.
    const inf = await this.report.semana(now);
    const partes = await this.report.textoTelegram(inf);
    // El PDF se arma UNA vez para todos los destinos, y antes del bucle: si
    // chromium falla, el informe de texto sale igual (que es lo que habia
    // antes) en vez de perderse por un adjunto.
    const adjunto = await this.armarPdf(inf);

    for (const chatId of cfg.reportChatIds) {
      for (const parte of partes) {
        try {
          await this.bot.enviarHtml(chatId, parte);
        } catch (error) {
          this.logger.warn(
            `No se pudo enviar el informe semanal a ${chatId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (adjunto) {
        try {
          await this.bot.enviarDocumento(
            chatId,
            adjunto.archivo,
            adjunto.nombre,
          );
        } catch (error) {
          this.logger.warn(
            `No se pudo enviar el PDF del informe a ${chatId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    this.logger.log(`Informe ${id} enviado`);
  }

  /** El PDF es un extra: si revienta, el informe de texto va igual. */
  private async armarPdf(
    inf: InformeSemanal,
  ): Promise<{ archivo: Buffer; nombre: string } | null> {
    try {
      return {
        archivo: await this.pdf.generar(inf),
        nombre: this.pdf.nombreArchivo(
          inf,
          await this.configs.obtener('operacion'),
        ),
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo generar el PDF del informe: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async enviarDiario(
    id: string,
    cfg: TelegramBotConfig,
  ): Promise<void> {
    if (cfg.groupChatId === null) {
      // Sin grupo no hay a donde publicar: no se marca, asi que si se
      // configura el grupo mas tarde el mismo dia, el proximo tick lo intenta.
      this.logger.warn(
        `Resumen diario ${id} sin grupo configurado: no se envia`,
      );
      return;
    }
    // Lectura barata ANTES de armar el informe: si ya se mando, los demas
    // ticks de la hora configurada no recalculan nada. reservar() sigue
    // siendo el gate atomico que de verdad decide quien manda.
    if (await this.yaMarcado(id)) return;

    const inf = await this.report.hoy();
    if (!inf.gastos.length) {
      // Dia sin gastos (todavia): no hay nada que publicar ni que marcar.
      // El proximo tick vuelve a intentar por si aparece algo en la hora.
      return;
    }
    if (!(await this.reservar(id))) return; // ya se mando (o lo esta mandando otro tick)
    for (const parte of await this.report.textoTelegram(inf)) {
      await this.grupo.publicarTexto(
        parte.replace(
          'Informe de gastos — Semana de',
          'Resumen de hoy — semana de',
        ),
      );
    }
    this.logger.log(`Informe ${id} enviado`);
  }

  private async yaMarcado(id: string): Promise<boolean> {
    const doc = await this.col().findOne({ _id: id });
    return doc !== null;
  }

  private col(): Collection<SentReportDoc> {
    return this.connection.collection<SentReportDoc>('telegram_sent_reports');
  }

  /**
   * Inserta la marca ANTES de enviar (no upsert): si `_id` ya existe, el
   * insert falla por clave duplicada y el informe se salta entero — asi un
   * envio parcial (falla a mitad de un chat) nunca se reintenta como
   * duplicado, solo se pierde ese chat (queda en el log por chat).
   *
   * Solo la clave duplicada (E11000, `id` ya reservado por este u otro tick)
   * cuenta como "ya se mando". Cualquier otro error (Mongo caido, auth,
   * etc.) se relanza: no quedo marca escrita, asi que el catch por informe
   * en `tick()` lo loguea como ERROR y el proximo tick reintenta solo.
   */
  private async reservar(id: string): Promise<boolean> {
    try {
      await this.col().insertOne({ _id: id, sentAt: new Date() });
      return true;
    } catch (error: unknown) {
      const esDuplicado =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 11000;
      if (esDuplicado) return false;
      throw error;
    }
  }
}

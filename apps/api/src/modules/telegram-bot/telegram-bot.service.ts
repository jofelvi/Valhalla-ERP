import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigsService } from '../configs/configs.service';
import { moduloActivo } from '../../common/modulos/modulo-activo';
import { Api, Bot, Context, InlineKeyboard, InputFile } from 'grammy';
import {
  TelegramConfigService,
  SocioAutorizado,
} from './telegram-config.service';
import { SessionStore } from './session.store';
import { BotDepsService } from './bot-deps.service';
import { PhotoHandler } from './photo.handler';
import { CommandsHandler } from './commands.handler';
import { GroupNotifierService } from './group-notifier.service';
import {
  ExpensesService,
  RegistrarGastoInput,
  RegistroParcialError,
} from '../expenses/expenses.service';
import {
  Boton,
  ExpenseDraft,
  Reply,
  Step,
  StepInput,
  draftVacio,
} from './conversation/draft';
import { arrancar, avanzar, Avance, STEPS } from './conversation/router';
import { formatearGastoTelegram } from '../expenses/expenses-report.helper';
import { parseInvoiceHeader } from '../ocr/invoice-header-parser';
import { teclado } from './teclado';
import {
  destinoDeFoto,
  esAccionable,
  esMiembroDelGrupo,
  imagenDelMensaje,
  nombreDeSocio,
} from './routing.helper';

export type ActorTelegram = SocioAutorizado;

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly botConfig: TelegramConfigService,
    private readonly sessions: SessionStore,
    private readonly deps: BotDepsService,
    private readonly photos: PhotoHandler,
    private readonly commands: CommandsHandler,
    private readonly grupo: GroupNotifierService,
    private readonly expenses: ExpensesService,
    private readonly configs: ConfigsService,
  ) {}

  api(): Api | null {
    return this.bot?.api ?? null;
  }

  async onModuleInit(): Promise<void> {
    // Con el módulo apagado el bot no arranca (no hay polling ni alta de socios). Para
    // encenderlo hace falta reiniciar la API: el arranque es el único punto de entrada.
    if (!(await moduloActivo(this.configs, 'telegramBot'))) {
      this.logger.log(
        'Módulo telegramBot apagado en la configuración: el bot no arranca',
      );
      return;
    }
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN ausente: el bot de gastos no arranca',
      );
      return;
    }
    await this.sessions.ensureIndexes();
    const bot = new Bot(token);
    this.bot = bot;
    this.grupo.attach(bot.api);

    // /id funciona para cualquiera: es como se consiguen los ids para la config.
    bot.command('id', (ctx) =>
      ctx.reply(`chatId: ${ctx.chat.id}\ntelegramId: ${ctx.from?.id ?? '?'}`),
    );

    // Whitelist: todo lo demas exige estar en configs/telegram_bot.allowed.
    bot.use(async (ctx, next) => {
      const id = ctx.from?.id;
      const socio = id ? await this.botConfig.socioDe(id) : null;
      if (socio) {
        await next();
        return;
      }
      // Con el modo privacidad APAGADO (hace falta para ver las fotos del
      // grupo) Telegram entrega toda la conversacion de los socios. Avisar por
      // cada "ok dale" llenaria el log de WARN y taparia los que importan.
      if (
        !esAccionable({
          tieneFoto: Boolean(imagenDelMensaje(ctx.message)),
          texto: ctx.message?.text,
          esCallback: Boolean(ctx.callbackQuery),
        })
      ) {
        return;
      }
      // Estar en el grupo de socios ES la autorizacion (decision del dueño,
      // 18/09/2026): antes habia que agregar cada telegramId a mano en Mongo y
      // Mariale, recien entrada al grupo, se topo con "no estás autorizado".
      if (id && (await this.altaPorGrupo(ctx, id))) {
        await next();
        return;
      }
      this.logger.warn(`Telegram: mensaje de ${id ?? '?'} no autorizado`);
      if (ctx.chat?.type === 'private') {
        await ctx.reply(
          'No estás autorizado para usar este bot. Pídele a un socio que te agregue al grupo de socios y vuelve a escribirme.',
        );
      } else if (imagenDelMensaje(ctx.message)) {
        // En el grupo solo se contesta a una factura: quedarse callado es lo
        // que ya nos costo una prueba ("le pase una foto y no hizo nada").
        await ctx
          .reply('No estás autorizado para cargar gastos.')
          .catch(() => undefined);
      }
      return;
    });

    // En el grupo solo se atienden comandos de consulta; las fotos y botones
    // van por el chat privado de cada socio.
    bot.command('informe', async (ctx) =>
      this.commands.informe(ctx, await this.actorDe(ctx)),
    );
    bot.command('hoy', (ctx) => this.commands.hoy(ctx));
    bot.command('porpagar', (ctx) =>
      this.enPrivado(ctx, () => this.commands.porPagar(ctx)),
    );
    bot.command('reembolsos', (ctx) =>
      this.enPrivado(ctx, () => this.commands.reembolsos(ctx)),
    );
    bot.command('stock', (ctx) => this.commands.stock(ctx));
    bot.command('novedad', async (ctx) =>
      this.commands.novedad(ctx, await this.actorDe(ctx)),
    );
    bot.command('saldo', async (ctx) =>
      this.commands.saldo(ctx, await this.actorDe(ctx)),
    );
    bot.command(['start', 'ayuda'], (ctx) => this.commands.ayuda(ctx));
    bot.command('cancelar', (ctx) =>
      this.enPrivado(ctx, () => this.cancelar(ctx)),
    );

    // La factura se puede soltar en el grupo (asi los socios la ven entrar) y
    // la conversacion sigue en el privado de quien la mando.
    bot.on('message:photo', (ctx) => this.onFoto(ctx));
    // La misma factura mandada como archivo (jpg/png): llega sin comprimir.
    bot.on('message:document', (ctx) =>
      imagenDelMensaje(ctx.message) ? this.onFoto(ctx) : undefined,
    );
    // Los botones (confirmar compra, marcar pagado, etc.) son parte de la
    // conversacion privada de cada socio; en el grupo no tienen sesion
    // detras. Sin responder el callback, Telegram deja el boton "cargando".
    bot.on('callback_query:data', (ctx) =>
      this.enPrivado(
        ctx,
        () => this.onCallback(ctx),
        () =>
          ctx
            .answerCallbackQuery(
              'Los botones solo funcionan en el chat privado.',
            )
            .catch(() => undefined),
      ),
    );
    bot.on('message:text', (ctx) =>
      this.enPrivado(ctx, () => this.onTexto(ctx)),
    );

    bot.catch((err) => {
      this.logger.error(`Telegram: ${err.message}`, err.stack);
      // Un update sin chat (ej: inline query) no tiene a donde responder.
      if (err.ctx.chat)
        err.ctx
          .reply('Algo falló. Intenta de nuevo o escribe /cancelar.')
          .catch(() => undefined);
    });

    // start() resuelve solo cuando el bot se detiene: no se espera. Pero si
    // Telegram lo rechaza (401/409, ej. otro proceso haciendo polling con el
    // mismo token) rechaza la promesa; sin .catch() esa excepcion no
    // atrapada tumba todo el proceso de Node. Aqui el bot muere en silencio
    // y el resto de la API sigue viva.
    bot
      .start({
        onStart: (me) =>
          this.logger.log(`Bot de gastos conectado como @${me.username}`),
      })
      .catch((error: unknown) =>
        this.logger.error(
          `El bot de gastos se detuvo: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot?.stop();
  }

  /**
   * Si quien escribe esta en el grupo de socios, lo da de alta y lo saluda.
   * Vale desde el grupo o desde el privado; de otro grupo, no: el bot puede
   * estar en chats que no son de los socios.
   */
  private async altaPorGrupo(ctx: Context, id: number): Promise<boolean> {
    const { groupChatId, allowed } = await this.botConfig.leer();
    if (groupChatId === null) return false;
    const tipo = ctx.chat?.type;
    if (tipo !== 'private' && ctx.chat?.id !== groupChatId) return false;
    const miembro = await ctx.api
      .getChatMember(groupChatId, id)
      .then((m) =>
        esMiembroDelGrupo(m as { status: string; is_member?: boolean }),
      )
      .catch(() => false);
    if (!miembro) return false;
    const nombre = nombreDeSocio(
      ctx.from?.first_name ?? '',
      ctx.from?.last_name,
      allowed.map((a) => a.socio),
    );
    const socio = await this.botConfig.autorizar(id, nombre);
    this.logger.log(
      `Telegram: ${socio.socio} (${id}) autorizado por estar en el grupo de socios`,
    );
    await ctx
      .reply(
        `✅ ${socio.socio}, quedaste autorizado para cargar gastos por estar en el grupo de socios.`,
      )
      .catch(() => undefined);
    return true;
  }

  private async actorDe(ctx: Context): Promise<ActorTelegram> {
    const socio = ctx.from?.id
      ? await this.botConfig.socioDe(ctx.from.id)
      : null;
    // La whitelist ya paso antes de llegar aca; si esto no resuelve es un
    // bug, no un socio anonimo al que haya que dejar estampar un gasto.
    if (!socio) throw new Error('Usuario no autorizado');
    return socio;
  }

  private async enPrivado(
    ctx: Context,
    fn: () => Promise<unknown>,
    siGrupo?: () => Promise<unknown>,
  ): Promise<void> {
    if (ctx.chat?.type !== 'private') {
      if (siGrupo) await siGrupo();
      return;
    }
    await fn();
  }

  async enviarHtml(
    chatId: number,
    texto: string,
    buttons?: Boton[][],
  ): Promise<void> {
    await this.bot?.api.sendMessage(chatId, texto, {
      parse_mode: 'HTML',
      reply_markup: teclado(buttons),
    });
  }

  /**
   * Un archivo, desde memoria.
   *
   * `InputFile` acepta el Buffer tal cual: no hace falta escribirlo a disco
   * para mandarlo, y asi el informe no deja PDFs sueltos en el VPS.
   */
  async enviarDocumento(
    chatId: number,
    archivo: Buffer,
    nombre: string,
    caption?: string,
  ): Promise<void> {
    await this.bot?.api.sendDocument(chatId, new InputFile(archivo, nombre), {
      caption,
      parse_mode: 'HTML',
    });
  }

  /**
   * Las respuestas van al chat DESTINO, no a donde llego el mensaje: una foto
   * soltada en el grupo se contesta en el privado de quien la mando.
   */
  private async responder(chatId: number, replies: Reply[]): Promise<void> {
    for (const r of replies) {
      await this.enviarHtml(chatId, r.text, r.buttons);
    }
  }

  // ─── Flujo de registro ───

  private async onFoto(ctx: Context): Promise<void> {
    const ruta = ctx.chat ? destinoDeFoto(ctx.chat, ctx.from?.id) : null;
    if (!ruta) return;
    const { destino, avisarEn } = ruta;
    const imagen = imagenDelMensaje(ctx.message);
    if (!imagen) return;

    // Desde el grupo, el primer mensaje al privado puede rebotar: Telegram no
    // deja que un bot escriba primero a quien nunca le hablo. Se avisa EN EL
    // GRUPO, que es donde el socio esta mirando.
    if (avisarEn !== null && !(await this.puedeEscribirAlPrivado(destino, ctx)))
      return;

    await this.enviarHtml(destino, '📷 Leyendo la factura…');
    if (avisarEn !== null) {
      const quien = ctx.from?.first_name ?? 'Socio';
      await ctx
        .reply(
          `📷 Factura recibida de ${quien}. Sigo por privado y publico el gasto aquí cuando termine.`,
        )
        .catch(() => undefined);
    }

    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    const buffer = await this.photos.descargar(ctx.api, imagen.fileId, token);
    if (!buffer) {
      await this.enviarHtml(
        destino,
        'No pude descargar la foto. Mándala otra vez.',
      );
      return;
    }
    const foto = await this.photos.procesar(buffer, imagen.extension);

    const previa = await this.sessions.get<ExpenseDraft>(destino);
    if (previa) {
      await this.sessions.set(destino, {
        step: previa.step,
        draft: previa.draft,
        pendingPhoto: { invoiceUrl: foto.invoiceUrl, ocrText: foto.ocrText },
      });
      await this.responder(destino, [
        {
          text: 'Tienes una compra a medias. ¿Qué hago con la foto nueva?',
          buttons: [
            [
              {
                label: '🗑 Descartar la anterior y empezar',
                data: 'photo:nueva',
              },
              { label: '↩️ Seguir con la anterior', data: 'photo:seguir' },
            ],
          ],
        },
      ]);
      return;
    }
    await this.iniciar(ctx, destino, foto.invoiceUrl, foto.ocrText);
  }

  /**
   * Un bot no puede iniciar una conversacion: si el socio nunca le escribio en
   * privado, el mensaje rebota con 403 y la factura se perderia en silencio.
   */
  private async puedeEscribirAlPrivado(
    destino: number,
    ctx: Context,
  ): Promise<boolean> {
    try {
      await ctx.api.sendChatAction(destino, 'typing');
      return true;
    } catch {
      await ctx
        .reply(
          'Antes de mandar facturas por aquí, escríbeme una vez por privado 👉 t.me/NegocioBot',
        )
        .catch(() => undefined);
      return false;
    }
  }

  private async iniciar(
    ctx: Context,
    chatId: number,
    invoiceUrl: string,
    ocrText: string,
  ): Promise<void> {
    const draft = draftVacio(invoiceUrl, ocrText, parseInvoiceHeader(ocrText));
    const avance = await arrancar(draft, this.deps);
    await this.aplicar(ctx, chatId, avance);
  }

  private async onTexto(ctx: Context): Promise<void> {
    const chatId = ctx.chat!.id;
    const s = await this.sessions.get<ExpenseDraft>(chatId);
    if (!s) {
      await ctx.reply(
        'Mándame la foto de la factura para registrar una compra, o /ayuda.',
      );
      return;
    }
    const avance = await avanzar(
      { step: s.step as Step, draft: s.draft },
      { kind: 'text', text: ctx.message?.text ?? '' },
      this.deps,
    );
    await this.aplicar(ctx, chatId, avance);
  }

  private async onCallback(ctx: Context): Promise<void> {
    const data = ctx.callbackQuery?.data ?? '';
    await ctx.answerCallbackQuery().catch(() => undefined);
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    if (
      data.startsWith('pay:id:') ||
      data.startsWith('payf:') ||
      data.startsWith('reemb:')
    ) {
      await this.commands.callback(ctx, data, await this.actorDe(ctx));
      return;
    }

    const s = await this.sessions.get<ExpenseDraft>(chatId);
    if (data === 'photo:nueva' && s?.pendingPhoto) {
      await this.sessions.clear(chatId);
      await this.iniciar(
        ctx,
        chatId,
        s.pendingPhoto.invoiceUrl,
        s.pendingPhoto.ocrText,
      );
      return;
    }
    if (data === 'photo:seguir' && s) {
      await this.sessions.set(chatId, {
        step: s.step,
        draft: s.draft,
        pendingPhoto: null,
      });
      await this.responder(chatId, [
        await STEPS[s.step as Step].prompt(s.draft, this.deps),
      ]);
      return;
    }
    if (!s) {
      await ctx.reply(
        'Esa conversación ya terminó. Manda una foto para empezar otra.',
      );
      return;
    }
    const input: StepInput = { kind: 'callback', data };
    const avance = await avanzar(
      { step: s.step as Step, draft: s.draft },
      input,
      this.deps,
    );
    await this.aplicar(ctx, chatId, avance);
  }

  private async aplicar(
    ctx: Context,
    chatId: number,
    avance: Avance,
  ): Promise<void> {
    if (avance.kind === 'cancelado') {
      await this.sessions.clear(chatId);
      await this.enviarHtml(chatId, 'Compra descartada.');
      return;
    }
    if (avance.kind === 'continuar') {
      await this.sessions.set(chatId, {
        step: avance.step,
        draft: avance.draft,
      });
      await this.responder(chatId, avance.replies);
      return;
    }
    await this.registrar(ctx, chatId, avance.draft);
  }

  private async registrar(
    ctx: Context,
    chatId: number,
    d: ExpenseDraft,
  ): Promise<void> {
    const actor = await this.actorDe(ctx);
    const input: RegistrarGastoInput = {
      kind: d.kind ?? 'GENERAL',
      category: d.category ?? 'Otros',
      description: d.description ?? undefined,
      supplierId: d.supplierId ?? undefined,
      supplierName: d.supplierName ?? undefined,
      employeeId: d.employeeId ?? undefined,
      employeeName: d.employeeName ?? undefined,
      currency: d.currency ?? 'BS',
      amount: d.amount ?? 0,
      exchangeRate: d.exchangeRate ?? 0,
      lines:
        d.kind === 'INSUMOS'
          ? d.lines.map((l) => ({
              productId: l.productId ?? '',
              quantity: l.quantity ?? 0,
              unit: l.unit ?? 'und',
              unitCost: l.unitCost ?? 0,
              invoiceText: l.invoiceText || undefined,
              unitsPerPack: l.unitsPerPack,
            }))
          : undefined,
      paymentStatus: d.paymentStatus ?? 'PAID',
      fundsSource: d.fundsSource ?? undefined,
      invoiceUrls: d.invoiceUrl ? [d.invoiceUrl] : [],
      ocrText: d.ocrText || undefined,
      purchaseId: d.purchaseId,
      actor: {
        telegramId: actor.telegramId,
        socio: actor.socio,
        userId: actor.userId,
        source: 'telegram',
      },
    };

    try {
      const { expense, stockAhora } = await this.expenses.registrar(input);
      await this.sessions.clear(chatId);
      const operacion = await this.configs.obtener('operacion');
      const texto = formatearGastoTelegram(expense, stockAhora, operacion);
      await this.enviarHtml(chatId, `✅ Registrado.\n\n${texto}`);
      await this.grupo.publicarGasto(expense, stockAhora);
    } catch (error) {
      if (error instanceof RegistroParcialError) {
        // La compra de inventario SI quedo creada: hay que reusarla en el
        // proximo intento, no duplicarla. Se guarda en el borrador de la
        // sesion (que persiste a traves de sum:edit -> KIND..SUMMARY).
        this.logger.error(
          `Compra ${error.purchaseId} de ${actor.socio} quedo sin su gasto: ${error.message}`,
        );
        await this.sessions.set(chatId, {
          step: 'SUMMARY',
          draft: { ...d, purchaseId: error.purchaseId },
        });
        await this.enviarHtml(
          chatId,
          `❌ No se pudo registrar: ${error.message}`,
          [
            [
              { label: '✏️ Corregir', data: 'sum:edit' },
              { label: '❌ Cancelar', data: 'cancel' },
            ],
          ],
        );
        return;
      }
      // El borrador se conserva: el socio corrige y confirma de nuevo.
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `No se pudo registrar el gasto de ${actor.socio}: ${msg}`,
      );
      // Los botones de abajo los atiende el paso del resumen.
      await this.sessions.set(chatId, { step: 'SUMMARY', draft: d });
      await this.enviarHtml(chatId, `❌ No se pudo registrar: ${msg}`, [
        d.kind === 'INSUMOS'
          ? [
              { label: '✏️ Corregir renglones', data: 'sum:lineas' },
              { label: '❌ Cancelar', data: 'cancel' },
            ]
          : [
              { label: '✏️ Corregir', data: 'sum:edit' },
              { label: '❌ Cancelar', data: 'cancel' },
            ],
      ]);
    }
  }

  private async cancelar(ctx: Context): Promise<void> {
    await this.sessions.clear(ctx.chat!.id);
    await ctx.reply('Listo, sin compra pendiente.');
  }
}

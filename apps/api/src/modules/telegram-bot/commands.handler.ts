import { ConfigsService } from '../configs/configs.service';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { ExpensesService } from '../expenses/expenses.service';
import { ExpensesReportService } from '../expenses/expenses-report.service';
import { MovementsService } from '../inventory/movements.service';
import { WarehousesService } from '../inventory/warehouses.service';
import { Product } from '../products/schemas/product.schema';
import type { ProductDocument } from '../products/schemas/product.schema';
import { GroupNotifierService } from './group-notifier.service';
import type { SocioAutorizado } from './telegram-config.service';
import {
  argumentoDe,
  textoPorPagar,
  textoReembolsos,
  textoStock,
} from './commands.helper';
import { escapeHtml } from '../expenses/expenses-report.helper';
import type { BaseUnit } from '../inventory/units';
import { teclado } from './teclado';
import { regexTolerante } from '../../common/busqueda-texto.util';

const AYUDA = [
  '📷 Mándame la <b>foto de la factura</b> y te pregunto lo demás.',
  '',
  '/stock &lt;producto&gt; — stock actual (solo lectura)',
  '/porpagar — créditos abiertos, marcar pagado',
  '/reembolsos — lo que Negocio debe a cada socio',
  '/novedad &lt;texto&gt; — novedad para el informe de la semana',
  '/saldo &lt;monto&gt; — con cuánto abrió la semana el banco',
  '/hoy — gastos de hoy',
  '/informe — semana en curso · /informe anterior',
  '/cancelar — descartar la compra a medias',
].join('\n');

/** Comandos de consulta del bot (/informe, /hoy, /porpagar, etc.) y los callbacks de pago/reembolso. */
@Injectable()
export class CommandsHandler {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly report: ExpensesReportService,
    private readonly configs: ConfigsService,
    private readonly movements: MovementsService,
    private readonly warehouses: WarehousesService,
    private readonly grupo: GroupNotifierService,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  ayuda(ctx: Context): Promise<unknown> {
    return ctx.reply(AYUDA, { parse_mode: 'HTML' });
  }

  // El actor ya viene resuelto (whitelist verificada por el middleware), pero
  // el informe es igual para cualquier socio: no se usa aqui.
  async informe(ctx: Context, _actor: SocioAutorizado): Promise<void> {
    const arg = argumentoDe(ctx.message?.text ?? '');
    const inf = await this.report.semana(
      arg === 'anterior' ? 'anterior' : new Date(),
    );
    for (const parte of await this.report.textoTelegram(inf)) {
      await ctx.reply(parte, { parse_mode: 'HTML' });
    }
  }

  async hoy(ctx: Context): Promise<void> {
    const inf = await this.report.hoy();
    for (const parte of await this.report.textoTelegram(inf)) {
      await ctx.reply(
        parte.replace(
          'Informe de gastos — Semana de',
          'Gastos de hoy — semana de',
        ),
        { parse_mode: 'HTML' },
      );
    }
  }

  async porPagar(ctx: Context): Promise<void> {
    const r = textoPorPagar(
      await this.expenses.porPagar(),
      await this.configs.obtener('operacion'),
    );
    await ctx.reply(r.text, {
      parse_mode: 'HTML',
      reply_markup: teclado(r.buttons),
    });
  }

  async reembolsos(ctx: Context): Promise<void> {
    const r = textoReembolsos(
      await this.expenses.reembolsosPendientes(),
      await this.configs.obtener('operacion'),
    );
    await ctx.reply(r.text, {
      parse_mode: 'HTML',
      reply_markup: teclado(r.buttons),
    });
  }

  async stock(ctx: Context): Promise<void> {
    const q = argumentoDe(ctx.message?.text ?? '');
    if (q.length < 2) {
      await ctx.reply('Uso: /stock harina');
      return;
    }
    // Tolera tildes y mayusculas como el resto del sistema: sin esto
    // `/stock cafe` no encontraba «CAFÉ BALLET».
    const regex = regexTolerante(q);
    const productos = await this.productModel
      .find(
        {
          name: regex,
          isActive: true,
          isForInventory: { $ne: false },
          $or: [{ isForInventory: true }, { type: 'BASE' }],
        },
        { name: 1 },
      )
      .limit(3)
      .lean();
    if (!productos.length) {
      await ctx.reply(
        `No encontré ningún insumo que se llame "${escapeHtml(q)}".`,
        { parse_mode: 'HTML' },
      );
      return;
    }
    const almacenes = (await this.warehouses.findAll()).filter(
      (w) => w.isActive !== false,
    );
    // Una sola lectura de stock por almacen, no una por cada producto x almacen.
    const porAlmacen = await Promise.all(
      almacenes.map((w) => this.movements.getStock(w.id)),
    );
    for (const p of productos) {
      const filas: Array<{ almacen: string; qty: number; baseUnit: BaseUnit }> =
        [];
      almacenes.forEach((w, i) => {
        const fila = porAlmacen[i].find((s) => s.productId === String(p._id));
        if (fila && fila.qty !== 0)
          filas.push({
            almacen: w.name,
            qty: fila.qty,
            baseUnit: fila.baseUnit,
          });
      });
      await ctx.reply(textoStock(p.name, filas), { parse_mode: 'HTML' });
    }
  }

  async novedad(ctx: Context, actor: SocioAutorizado): Promise<void> {
    const texto = argumentoDe(ctx.message?.text ?? '');
    if (!texto) {
      await ctx.reply('Uso: /novedad se dañó la nevera de la barra');
      return;
    }
    await this.expenses.agregarNovedad(texto, {
      telegramId: actor.telegramId,
      socio: actor.socio,
      userId: actor.userId,
      source: 'telegram',
    });
    await ctx.reply('📝 Novedad anotada para el informe de la semana.');
    await this.grupo.publicarTexto(
      `📝 <b>${escapeHtml(actor.socio)}</b>: ${escapeHtml(texto)}`,
    );
  }

  /**
   * Con cuanta plata abrio la semana el banco. Va a mano y no se calcula desde
   * la semana anterior: si una semana queda incompleta, el arrastre mete ese
   * error en todas las siguientes sin que nada avise (dueño, 29/09/2026).
   */
  async saldo(ctx: Context, actor: SocioAutorizado): Promise<void> {
    const texto = argumentoDe(ctx.message?.text ?? '');
    // Acepta "533", "533,25" y "$533.25": el telefono escribe con coma.
    const monto = Number(texto.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (!texto || !Number.isFinite(monto)) {
      await ctx.reply(
        'Uso: /saldo 533 — lo que había en el banco al abrir la semana, en dólares.',
      );
      return;
    }
    const r = await this.report.fijarSaldoInicial({
      monto,
      socio: actor.socio,
      telegramId: actor.telegramId,
    });
    await ctx.reply(
      `🏦 Saldo inicial de la semana: <b>$ ${r.saldoInicial.toFixed(2)}</b>.
` + 'El informe lo va a sumar al "debería quedar".',
      { parse_mode: 'HTML' },
    );
  }

  /** Botones de /porpagar y /reembolsos. Sin sesion: todo va en el callback data. */
  async callback(
    ctx: Context,
    data: string,
    actor: SocioAutorizado,
  ): Promise<void> {
    if (data.startsWith('pay:id:')) {
      const id = data.slice('pay:id:'.length);
      await ctx.reply('¿Con qué fondos se pagó?', {
        reply_markup: new InlineKeyboard()
          .text('🏢 Negocio', `payf:EMPRESA:${id}`)
          .text('👤 Propios', `payf:PROPIOS:${id}`),
      });
      return;
    }
    if (data.startsWith('payf:')) {
      const [, fondos, id] = data.split(':');
      const fundsSource = fondos === 'PROPIOS' ? 'PROPIOS' : 'EMPRESA';
      try {
        const e = await this.expenses.marcarPagado(id, {
          fundsSource,
          socio: actor.socio,
        });
        await ctx.reply(
          `✅ Marcado pagado (${fundsSource === 'PROPIOS' ? 'fondos propios' : 'fondos Negocio'}).`,
        );
        // Sin esto un segundo tap re-dispara marcarPagado y duplica la publicacion al grupo.
        await ctx
          .editMessageReplyMarkup({ reply_markup: undefined })
          .catch(() => undefined);
        await this.grupo.publicarPago(e, actor.socio);
      } catch (error) {
        await ctx.reply(
          `❌ ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return;
    }
    if (data.startsWith('reemb:')) {
      const id = data.slice('reemb:'.length);
      try {
        const e = await this.expenses.marcarReembolsado(id, actor.socio);
        await ctx.reply('✅ Reembolso marcado.');
        // Sin esto un segundo tap re-dispara marcarReembolsado y duplica la publicacion al grupo.
        await ctx
          .editMessageReplyMarkup({ reply_markup: undefined })
          .catch(() => undefined);
        await this.grupo.publicarReembolso(e, actor.socio);
      } catch (error) {
        await ctx.reply(
          `❌ ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExpensesService } from './expenses.service';
import { TurnosSociosService } from '../analytics/turnos-socios.service';
import { PanelService } from '../analytics/panel/panel.service';
import { PayrollService } from '../payroll/payroll.service';
import {
  Purchase,
  PurchaseDocument,
} from '../inventory/schemas/purchase.schema';
import {
  WeeklyBalance,
  WeeklyBalanceDocument,
} from './schemas/weekly-balance.schema';
import { ConfigsService } from '../configs/configs.service';
import {
  fechaCalendario,
  medianocheDe,
} from '../../common/operacion/operacion.util';
import {
  armarInforme,
  formatearInformeTelegram,
  InformeSemanal,
  CompraWebSinOrigen,
  SemanaInforme,
} from './expenses-report.helper';

const DIA_MS = 86400000;

@Injectable()
export class ExpensesReportService {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly turnos: TurnosSociosService,
    private readonly panel: PanelService,
    private readonly payroll: PayrollService,
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<PurchaseDocument>,
    @InjectModel(WeeklyBalance.name)
    private readonly balanceModel: Model<WeeklyBalanceDocument>,
    private readonly configs: ConfigsService,
  ) {}

  async semana(ref: Date | 'anterior' = new Date()): Promise<InformeSemanal> {
    const fecha = ref === 'anterior' ? new Date(Date.now() - 7 * DIA_MS) : ref;
    const s = await this.turnos.semanaDe(fecha);
    return this.armar(
      { desde: s.desde, hasta: s.hasta, socio: s.socio, estimado: s.estimado },
      true,
    );
  }

  /** El dia de hoy en Venezuela, atribuido al socio de la semana en curso. */
  async hoy(): Promise<InformeSemanal> {
    const op = await this.configs.obtener('operacion');
    const desde = medianocheDe(fechaCalendario(new Date(), op), op);
    const s = await this.turnos.semanaDe(desde);
    return this.armar({
      desde,
      hasta: new Date(desde.getTime() + DIA_MS),
      socio: s.socio,
      estimado: s.estimado,
    });
  }

  async textoTelegram(inf: InformeSemanal): Promise<string[]> {
    return formatearInformeTelegram(
      inf,
      await this.configs.obtener('operacion'),
    );
  }

  /**
   * Fija lo que habia en el banco al abrir una semana. Se escribe una vez por
   * semana y se pisa si se corrige: la clave es el weekStart, asi que no puede
   * haber dos saldos de la misma semana.
   */
  async fijarSaldoInicial(args: {
    monto: number;
    socio: string;
    telegramId?: number;
    ref?: Date;
  }): Promise<{ weekStart: Date; saldoInicial: number }> {
    const s = await this.turnos.semanaDe(args.ref ?? new Date());
    await this.balanceModel.updateOne(
      { _id: s.desde.toISOString() },
      {
        $set: {
          weekStart: s.desde,
          saldoInicial: args.monto,
          socio: args.socio,
          telegramId: args.telegramId,
        },
      },
      { upsert: true },
    );
    return { weekStart: s.desde, saldoInicial: args.monto };
  }

  /** Lo que se cargo para esa semana, o undefined si nadie lo cargo. */
  private async saldoInicialDe(weekStart: Date): Promise<number | undefined> {
    const doc = await this.balanceModel
      .findById(weekStart.toISOString())
      .lean();
    return doc?.saldoInicial;
  }

  /**
   * @param conCaja cruza los gastos contra lo que entro y contra la nomina.
   *   Solo para la semana: en el resumen del dia el "deberia quedar" no
   *   significa nada, porque la nomina se paga una vez por semana.
   */
  private async armar(
    semana: SemanaInforme,
    conCaja = false,
  ): Promise<InformeSemanal> {
    const [gastos, porPagar, reembolsos, novedades, registrados] =
      await Promise.all([
        this.expenses.listar(semana),
        this.expenses.porPagar(),
        this.expenses.reembolsosPendientes(),
        this.expenses.novedades(semana),
        this.expenses.purchaseIdsRegistrados(),
      ]);

    // Compras que entraron por la pantalla web: tienen stock pero nadie dijo
    // con que plata se pagaron. Se muestran aparte para que no se pierdan.
    const compras = await this.purchaseModel
      .find({ date: { $gte: semana.desde, $lt: semana.hasta } })
      .sort({ date: 1 })
      .lean();
    const comprasWeb: CompraWebSinOrigen[] = compras
      .filter((p) => !registrados.has(String(p._id)))
      .map((p) => ({
        purchaseId: String(p._id),
        placeName: p.placeName,
        date: p.date,
        total: p.total,
        totalBs: p.totalBs,
        category: p.category,
      }));

    if (!conCaja) {
      return armarInforme({
        semana,
        gastos,
        porPagar,
        reembolsos,
        comprasWeb,
        novedades,
      });
    }

    // Las MISMAS fechas de los dos lados: el panel tiene su propia semana (que
    // arranca lunes) y la nomina se filtra por cuando salio la plata.
    const [cobros, nomina, saldoInicial] = await Promise.all([
      this.panel.cobrosEntre(semana.desde, semana.hasta),
      this.payroll.pagadoEnRango(semana.desde, semana.hasta),
      this.saldoInicialDe(semana.desde),
    ]);

    return armarInforme({
      semana,
      gastos,
      porPagar,
      reembolsos,
      comprasWeb,
      novedades,
      cobros,
      nomina,
      saldoInicial,
    });
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Expense,
  ExpenseDocument,
  ExpenseKind,
  ExpenseCurrency,
  ExpenseLean,
  ExpensePaymentStatus,
  FundsSource,
} from './schemas/expense.schema';
import {
  WeeklyNote,
  WeeklyNoteDocument,
  WeeklyNoteLean,
} from './schemas/weekly-note.schema';
import { PurchasesService } from '../inventory/purchases.service';
import { MovementsService } from '../inventory/movements.service';
import { TurnosSociosService } from '../analytics/turnos-socios.service';
import { PurchaseUnit } from '../inventory/dto/create-purchase.dto';
import { BaseUnit } from '../inventory/units';
import { convertir } from './money';
import { referenciaDeOperacion } from '../ocr/invoice-header-parser';

export interface ExpenseActor {
  telegramId?: number;
  socio: string;
  userId?: string;
  source: 'telegram' | 'web';
}

export interface RegistrarGastoLinea {
  productId: string;
  quantity: number;
  unit: PurchaseUnit;
  unitCost: number;
  invoiceText?: string;
  unitsPerPack?: number | null;
}

export interface RegistrarGastoInput {
  kind: ExpenseKind;
  category: string;
  description?: string;
  supplierId?: string;
  supplierName?: string;
  /** A quien se le presto o a quien se le pago, cuando el gasto es de personal. */
  employeeId?: string;
  employeeName?: string;
  currency: ExpenseCurrency;
  amount: number;
  exchangeRate: number;
  lines?: RegistrarGastoLinea[];
  paymentStatus: ExpensePaymentStatus;
  fundsSource?: FundsSource;
  invoiceUrls: string[];
  ocrText?: string;
  date?: Date;
  actor: ExpenseActor;
  /**
   * Reintento tras un RegistroParcialError: la compra de inventario ya
   * existe con este id, no crear otra.
   */
  purchaseId?: string;
}

/**
 * La compra de inventario SI quedo creada, pero el gasto financiero no se
 * pudo registrar despues (stock, semana de negocio, o el insert mismo).
 * `purchaseId` deja al llamador reintentar `registrar()` reusando esa
 * compra en vez de duplicarla.
 */
export class RegistroParcialError extends Error {
  constructor(
    message: string,
    readonly purchaseId: string,
  ) {
    super(message);
    this.name = 'RegistroParcialError';
  }
}

export interface StockAhora {
  productName: string;
  qty: number;
  baseUnit: BaseUnit;
}

export interface RegistrarGastoResult {
  expense: ExpenseLean;
  stockAhora: StockAhora[];
}

interface Rango {
  desde: Date;
  hasta: Date;
}

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(WeeklyNote.name) private readonly noteModel: Model<WeeklyNoteDocument>,
    private readonly purchases: PurchasesService,
    private readonly movements: MovementsService,
    private readonly turnos: TurnosSociosService,
  ) {}

  /**
   * Orden deliberado: la compra de inventario va PRIMERO. Si falla (insumo sin
   * contenido, unidad incompatible), el socio ve el motivo y no queda un gasto
   * sin su compra. Al reves dejaria plata registrada sin stock.
   */
  async registrar(input: RegistrarGastoInput): Promise<RegistrarGastoResult> {
    if (input.paymentStatus === 'PAID' && !input.fundsSource) {
      throw new BadRequestException('Un gasto de contado necesita el origen de los fondos');
    }
    if (!(input.amount > 0)) throw new BadRequestException('El monto debe ser mayor a cero');
    if (!(input.exchangeRate > 0)) throw new BadRequestException('Tasa invalida');

    // Una sola marca de tiempo para todo el registro (la compra de inventario
    // y el gasto financiero deben quedar fechados exactamente igual).
    const date = input.date ?? new Date();

    let purchaseId = input.purchaseId;
    // Solo si la compra se crea EN ESTA llamada un fallo posterior (stock,
    // semana de negocio, el insert del gasto) la deja huerfana; si ya venia
    // de un intento anterior no hay nada nuevo que limpiar ni que avisar.
    let compraCreadaAhora = false;
    const stockAhora: StockAhora[] = [];

    if (input.kind === 'INSUMOS') {
      if (!input.supplierId) throw new BadRequestException('Los insumos necesitan proveedor');
      if (!input.lines?.length) throw new BadRequestException('Los insumos necesitan al menos un renglon');

      let items: Array<{ productId: string; productName: string; baseUnit: string }>;
      let warehouseId: string;

      if (purchaseId) {
        const compra = await this.purchases.getById(purchaseId);
        items = compra.items;
        warehouseId = compra.warehouseId;
      } else {
        const compra = await this.purchases.create(
          {
            placeId: input.supplierId,
            category: input.category,
            date: date.toISOString(),
            items: input.lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unit: l.unit,
              unitCost: l.unitCost,
              invoiceText: l.invoiceText,
              unitsPerPack: l.unitsPerPack ?? undefined,
            })),
            invoiceUrls: input.invoiceUrls,
            currency: input.currency,
            bcvRate: input.currency === 'BS' ? input.exchangeRate : undefined,
          },
          input.actor.userId ?? `telegram:${input.actor.socio}`,
        );
        purchaseId = compra._id;
        compraCreadaAhora = true;
        items = compra.items;
        warehouseId = compra.warehouseId;
      }

      try {
        for (const item of items) {
          // Con stock unificado la compra entra a la casa del producto (Cocina,
          // Barra...), no al almacen de la compra: leer donde quedo de verdad.
          const casa = (await this.movements.homeWarehouseIdFor(item.productId)) ?? warehouseId;
          const qty = await this.movements.getStockFor(casa, item.productId);
          stockAhora.push({
            productName: item.productName,
            qty,
            baseUnit: item.baseUnit as BaseUnit,
          });
        }
      } catch (error: unknown) {
        throw this.comoParcialSiHuerfana(error, purchaseId, compraCreadaAhora);
      }
    }

    try {
      const semana = await this.turnos.semanaDe(date);
      const { amountBs, amountUsd } = convertir(input.amount, input.currency, input.exchangeRate);
      const pagado = input.paymentStatus === 'PAID';

      const doc = await this.expenseModel.create({
        kind: input.kind,
        category: input.category.trim(),
        description: input.description?.trim() || undefined,
        supplierId: input.supplierId,
        supplierName: input.supplierName,
        employeeId: input.employeeId,
        employeeName: input.employeeName,
        currency: input.currency,
        amountBs,
        amountUsd,
        exchangeRate: input.exchangeRate,
        fundsSource: pagado ? input.fundsSource : undefined,
        paidBy: pagado && input.fundsSource === 'PROPIOS' ? input.actor.socio : undefined,
        paymentStatus: input.paymentStatus,
        paidAt: pagado ? date : undefined,
        purchaseId,
        invoiceUrls: input.invoiceUrls,
        ocrText: input.ocrText?.slice(0, 3000),
        date,
        weekStart: semana.desde,
        // Sin socio en el ciclo (config vacia/rota) no se bloquea el
        // registro: se marca '?' y se corrige la config despues, no el
        // gasto ya hecho (y la compra ya creada).
        socioTurno: semana.socio || '?',
        registeredBy: {
          telegramId: input.actor.telegramId,
          socio: input.actor.socio,
          userId: input.actor.userId,
        },
        source: input.actor.source,
      });

      return { expense: doc.toObject(), stockAhora };
    } catch (error: unknown) {
      throw this.comoParcialSiHuerfana(error, purchaseId, compraCreadaAhora);
    }
  }

  /**
   * Si la compra se creo en ESTA llamada y algo despues revento, la compra
   * queda huerfana (con plata y stock movidos, sin su gasto financiero) —
   * se envuelve en RegistroParcialError con el id para que el reintento la
   * reuse. Si no se creo nada nuevo aqui, el error se relanza tal cual.
   */
  private comoParcialSiHuerfana(
    error: unknown,
    purchaseId: string | undefined,
    compraCreadaAhora: boolean,
  ): Error {
    if (compraCreadaAhora && purchaseId) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Compra ${purchaseId} quedo huerfana: el gasto no se pudo registrar: ${msg}`);
      return new RegistroParcialError(msg, purchaseId);
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Update atomico con el estado viejo como filtro (no leer-y-luego-escribir):
   * dos socios tocando "pagado" al mismo tiempo pasarian ambos el guard si
   * se leyera aparte, y ambos publicarian el pago al grupo. Aqui solo uno
   * hace match contra `paymentStatus: 'CREDIT'`; el otro cae al catch.
   */
  async marcarPagado(
    id: string,
    pago: { fundsSource: FundsSource; socio: string },
  ): Promise<ExpenseLean> {
    const update =
      pago.fundsSource === 'PROPIOS'
        ? {
            $set: {
              paymentStatus: 'PAID' as const,
              paidAt: new Date(),
              fundsSource: pago.fundsSource,
              paidBy: pago.socio,
            },
          }
        : {
            $set: {
              paymentStatus: 'PAID' as const,
              paidAt: new Date(),
              fundsSource: pago.fundsSource,
            },
            $unset: { paidBy: '' },
          };

    const actualizado = await this.expenseModel
      .findOneAndUpdate({ _id: id, paymentStatus: 'CREDIT' }, update, { new: true })
      .lean();
    if (actualizado) return actualizado;

    // Sin match: o no existe (revienta con NotFoundException), o ya estaba
    // pagado (otro socio, u otro tap del mismo, gano la carrera).
    await this.obtener(id);
    throw new BadRequestException('Ese gasto ya esta pagado');
  }

  async marcarReembolsado(id: string, socio: string): Promise<ExpenseLean> {
    const actualizado = await this.expenseModel
      .findOneAndUpdate(
        { _id: id, fundsSource: 'PROPIOS', paymentStatus: 'PAID', reimbursedAt: { $exists: false } },
        { $set: { reimbursedAt: new Date(), reimbursedBy: socio } },
        { new: true },
      )
      .lean();
    if (actualizado) return actualizado;

    const e = await this.obtener(id);
    if (e.fundsSource !== 'PROPIOS' || e.paymentStatus !== 'PAID') {
      throw new BadRequestException('Solo se reembolsa lo pagado con fondos propios');
    }
    throw new BadRequestException('Ese gasto ya fue reembolsado');
  }

  /**
   * Un gasto ya registrado con el MISMO numero de operacion que este
   * comprobante: es el mismo pago fotografiado dos veces.
   *
   * Se compara por la operacion y no por el monto porque tres Ridery distintos
   * de Bs 2.118,61 se registraron en minutos y eran viajes de verdad; el que
   * sobraba (17/09/2026) era otra captura del mismo Pago Movil.
   */
  async posibleDuplicado(ocrText: string | undefined): Promise<ExpenseLean | null> {
    const ref = ocrText ? referenciaDeOperacion(ocrText) : null;
    if (!ref) return null;
    const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // `ref` son solo cifras: se puede usar tal cual en la expresion.
    const candidatos = await this.expenseModel
      .find({ createdAt: { $gte: hace30Dias }, ocrText: { $regex: ref } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    return candidatos.find((c) => c.ocrText && referenciaDeOperacion(c.ocrText) === ref) ?? null;
  }

  porPagar(): Promise<ExpenseLean[]> {
    return this.expenseModel.find({ paymentStatus: 'CREDIT' }).sort({ date: 1 }).lean();
  }

  reembolsosPendientes(): Promise<ExpenseLean[]> {
    return this.expenseModel
      .find({ paymentStatus: 'PAID', fundsSource: 'PROPIOS', reimbursedAt: { $exists: false } })
      .sort({ date: 1 })
      .lean();
  }

  listar(r: Rango): Promise<ExpenseLean[]> {
    return this.expenseModel
      .find({ date: { $gte: r.desde, $lt: r.hasta } })
      .sort({ date: 1 })
      .lean();
  }

  async purchaseIdsRegistrados(): Promise<Set<string>> {
    const ids = (await this.expenseModel.distinct('purchaseId').exec()) as unknown as Array<string | null>;
    return new Set(ids.filter((x): x is string => typeof x === 'string'));
  }

  async agregarNovedad(texto: string, actor: ExpenseActor): Promise<WeeklyNoteLean> {
    const limpio = texto.trim();
    if (!limpio) throw new BadRequestException('La novedad esta vacia');
    const date = new Date();
    const semana = await this.turnos.semanaDe(date);
    const doc = await this.noteModel.create({
      text: limpio,
      socio: actor.socio,
      telegramId: actor.telegramId,
      date,
      weekStart: semana.desde,
    });
    return doc.toObject();
  }

  novedades(r: Rango): Promise<WeeklyNoteLean[]> {
    return this.noteModel.find({ date: { $gte: r.desde, $lt: r.hasta } }).sort({ date: 1 }).lean();
  }

  async obtener(id: string): Promise<ExpenseLean> {
    const e = await this.expenseModel.findOne({ _id: id }).lean();
    if (!e) throw new NotFoundException(`Gasto ${id} no encontrado`);
    return e;
  }
}

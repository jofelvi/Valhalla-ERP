import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payroll, PayrollDocument } from './schemas/payroll.schema';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto';
import { dateRangeFilter } from '../../common/utils/date-range-filter.util';

/** Lo que cobro una persona en el rango, con el comprobante de su pago. */
export interface PagoATrabajador {
  empleadoId: string;
  nombre: string;
  cargo?: string;
  /** Total que se le transfirio. Sin abrir si fue sueldo, comision o propina. */
  neto: number;
  pagos: number;
  /** Foto de la transferencia. Se sirve publica desde /uploads. */
  reciboUrl?: string;
}

/**
 * Lo que salio de nomina en un rango. El desglose CIERRA:
 * `dias + comisiones + propinas + bonos − descuentos = neto`, y `neto` es
 * ademas la suma exacta de `porTrabajador` porque sale de las mismas filas.
 */
export interface NominaPagada {
  dias: number;
  comisiones: number;
  propinas: number;
  bonos: number;
  descuentos: number;
  neto: number;
  pagos: number;
  porTrabajador: PagoATrabajador[];
}

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
  ) {}

  async create(
    createPayrollDto: CreatePayrollDto,
    actor?: { id?: string; email?: string },
  ) {
    // createdBy sale del JWT, no del body: toda liquidacion queda con
    // responsable identificable (antes no habia forma de saber quien pagaba).
    const payroll = await this.payrollModel.create({
      ...createPayrollDto,
      createdBy: {
        userId: actor?.id ?? 'desconocido',
        email: actor?.email ?? '',
      },
    });
    const obj = payroll.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll(filters?: {
    employeeId?: string;
    month?: number;
    year?: number;
    /** Acota por el inicio del periodo: la nomina solo mira una semana. */
    from?: string;
    to?: string;
  }) {
    let query = this.payrollModel.find(
      dateRangeFilter('period.startDate', filters?.from, filters?.to) ?? {},
    );

    if (filters?.employeeId) {
      query = query.where('employeeId').equals(filters.employeeId);
    }

    if (filters?.month) {
      query = query.where('period.month').equals(filters.month);
    }

    if (filters?.year) {
      query = query.where('period.year').equals(filters.year);
    }

    const payrolls = await query.lean().exec();
    return payrolls.map((payroll) => ({ ...payroll, id: payroll._id }));
  }

  /**
   * Lo que SALIO de nomina entre dos fechas, para cuadrar la caja.
   *
   * Se filtra por `paymentDate`, no por el periodo: importa cuando salio la
   * plata del banco, no a que semana se le imputa el trabajo. Las dos cosas no
   * coinciden — el 21/09/2026 se pagaron 12 liquidaciones etiquetadas con el
   * periodo que ARRANCABA ese dia, por trabajo de la semana que terminaba.
   *
   * El desglose cierra: `dias + comisiones + propinas + bonos − descuentos`
   * da `neto`, que es lo que de verdad se transfirio.
   */
  async pagadoEnRango(desde: Date, hasta: Date): Promise<NominaPagada> {
    const suma = (campo: string) => ({ $sum: { $ifNull: [campo, 0] } });

    // Se agrupa POR PERSONA y el total general se suma despues en JS: asi el
    // total y el detalle no pueden discrepar, que es lo que pasa en la
    // pantalla de nomina (muestra 4 de las 5 lineas y no cuadra).
    const filas = await this.payrollModel.aggregate<{
      _id: string;
      dias: number;
      comisiones: number;
      propinas: number;
      bonos: number;
      descuentos: number;
      neto: number;
      pagos: number;
      recibo?: string;
      emp?: Array<{ name?: string; firstName?: string; lastName?: string; position?: string }>;
    }>([
      { $match: { status: 'paid', paymentDate: { $gte: desde, $lt: hasta } } },
      { $sort: { paymentDate: 1 } },
      {
        $group: {
          _id: '$employeeId',
          dias: suma('$salary.baseSalary'),
          comisiones: suma('$salary.commissions'),
          propinas: suma('$tips'),
          bonos: {
            $sum: {
              $add: [
                { $ifNull: ['$salary.bonuses', 0] },
                { $ifNull: ['$salary.overtime', 0] },
              ],
            },
          },
          descuentos: {
            $sum: {
              $add: [
                { $ifNull: ['$deductions.other', 0] },
                { $ifNull: ['$deductions.taxes', 0] },
                { $ifNull: ['$deductions.socialSecurity', 0] },
                { $ifNull: ['$deductions.insurance', 0] },
              ],
            },
          },
          neto: suma('$netPay'),
          pagos: { $sum: 1 },
          // Si a alguien se le pago dos veces en la semana, queda el ultimo
          // comprobante: es el que cierra el total de la fila.
          recibo: { $last: '$proofUrl' },
        },
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'emp',
        },
      },
      { $sort: { neto: -1 } },
    ]);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const total = (campo: keyof (typeof filas)[number]) =>
      r2(filas.reduce((a, f) => a + ((f[campo] as number) ?? 0), 0));

    const porTrabajador: PagoATrabajador[] = filas.map((f) => {
      const e = f.emp?.[0];
      const nombre = (e?.name ?? [e?.firstName, e?.lastName].filter(Boolean).join(' '))
        .replace(/\s+/g, ' ')
        .trim();
      return {
        empleadoId: f._id,
        nombre: nombre || 'Sin nombre',
        cargo: e?.position,
        neto: r2(f.neto),
        pagos: f.pagos,
        reciboUrl: f.recibo,
      };
    });

    return {
      dias: total('dias'),
      comisiones: total('comisiones'),
      propinas: total('propinas'),
      bonos: total('bonos'),
      descuentos: total('descuentos'),
      neto: total('neto'),
      pagos: filas.reduce((a, f) => a + f.pagos, 0),
      porTrabajador,
    };
  }

  /** Cuantos pagos hay, sin traerselos. */
  async count(filters?: { employeeId?: string }) {
    return this.payrollModel
      .countDocuments(
        filters?.employeeId ? { employeeId: filters.employeeId } : {},
      )
      .exec();
  }

  async findById(id: string) {
    const payroll = await this.payrollModel.findOne({ _id: id }).lean().exec();
    if (!payroll) {
      throw new NotFoundException(`Nómina con id ${id} no encontrada`);
    }
    return { ...payroll, id: payroll._id };
  }

  async update(id: string, updatePayrollDto: UpdatePayrollDto) {
    const payroll = await this.payrollModel
      .findOneAndUpdate({ _id: id }, updatePayrollDto, { new: true })
      .lean()
      .exec();

    if (!payroll) {
      throw new NotFoundException(`Nómina con id ${id} no encontrada`);
    }

    return { ...payroll, id: payroll._id };
  }

  async updateStatus(
    id: string,
    updatePayrollStatusDto: UpdatePayrollStatusDto,
  ) {
    const payroll = await this.payrollModel
      .findOneAndUpdate(
        { _id: id },
        { status: updatePayrollStatusDto.status },
        { new: true },
      )
      .lean()
      .exec();

    if (!payroll) {
      throw new NotFoundException(`Nómina con id ${id} no encontrada`);
    }

    return { ...payroll, id: payroll._id };
  }

  async softDelete(id: string) {
    const payroll = await this.payrollModel
      .findOneAndUpdate({ _id: id }, { status: 'cancelled' }, { new: true })
      .lean()
      .exec();

    if (!payroll) {
      throw new NotFoundException(`Nómina con id ${id} no encontrada`);
    }

    return { ...payroll, id: payroll._id };
  }
}

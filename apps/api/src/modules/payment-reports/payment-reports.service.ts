import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentReport,
  PaymentReportDocument,
} from './schemas/payment-report.schema';
import { CreatePaymentReportDto } from './dto/create-payment-report.dto';
import {
  ApprovePaymentReportDto,
  RejectPaymentReportDto,
} from './dto/review-payment-report.dto';
import { AccountReceivable } from '../accounts-receivable/schemas/account-receivable.schema';
import { PaymentsService } from '../payments/payments.service';

/** Lo unico que hace falta de la cuenta para validar el reporte. */
interface CuentaPorCobrarMinima {
  amount?: number;
  paidAmount?: number;
}

@Injectable()
export class PaymentReportsService {
  constructor(
    @InjectModel(PaymentReport.name)
    private paymentReportModel: Model<PaymentReportDocument>,
    @InjectModel(AccountReceivable.name)
    private accountReceivableModel: Model<any>,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Reporte de pago del cliente desde su enlace publico.
   *
   * Las tres validaciones venian de una ruta de Next que leia Firestore. Aqui
   * no habia ninguna: se aceptaba un reporte de $10.000 contra una deuda de
   * $50, o la misma referencia dos veces. Al mudar la pagina a esta API habria
   * que haberlas perdido, asi que se traen.
   */
  async create(dto: CreatePaymentReportDto) {
    const cuenta: CuentaPorCobrarMinima | null =
      await this.accountReceivableModel
        .findOne({ _id: dto.accountReceivableId })
        .select('amount paidAmount')
        .lean<CuentaPorCobrarMinima>()
        .exec();

    if (!cuenta) {
      throw new NotFoundException(
        `No existe la cuenta ${dto.accountReceivableId}`,
      );
    }

    const pendiente = (cuenta.amount ?? 0) - (cuenta.paidAmount ?? 0);
    if (dto.amount > pendiente + 0.01) {
      throw new BadRequestException(
        `El monto ($${dto.amount.toFixed(2)}) supera el pendiente ($${pendiente.toFixed(2)})`,
      );
    }

    const referencia = dto.reference?.trim();
    if (referencia) {
      // 1. Contra pagos ya cobrados (payments + pagoMoviles).
      const choque = await this.paymentsService.checkReferenceUsed(referencia);
      if (choque && (choque as { conflicts?: unknown[] }).conflicts?.length) {
        throw new ConflictException(
          `La referencia ${referencia} ya fue registrada en otro pago. Verifica el numero e intenta nuevamente.`,
        );
      }

      // 2. Contra reportes previos que sigan vivos. Un reporte rechazado no
      //    bloquea: puede que el cliente se equivocara al escribirla.
      const previo = await this.paymentReportModel
        .findOne({ reference: referencia, status: { $ne: 'rejected' } })
        .lean()
        .exec();
      if (previo) {
        throw new ConflictException(
          `La referencia ${referencia} ya fue reportada anteriormente. Si es un pago distinto, usa otra referencia.`,
        );
      }
    }

    const report = await this.paymentReportModel.create({
      ...dto,
      status: 'pending_review',
      reportedAt: new Date(),
    });
    const obj = report.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll(filters?: { status?: string }) {
    let query = this.paymentReportModel.find();

    if (filters?.status) {
      query = query.where('status').equals(filters.status);
    }

    const reports = await query.lean().exec();
    return reports.map((report) => ({ ...report, id: report._id }));
  }

  async findById(id: string) {
    const report = await this.paymentReportModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!report) {
      throw new NotFoundException(`Reporte de pago con id ${id} no encontrado`);
    }
    return { ...report, id: report._id };
  }

  async approve(id: string, approvePaymentReportDto: ApprovePaymentReportDto) {
    const report = await this.paymentReportModel
      .findOneAndUpdate(
        { _id: id },
        {
          status: 'approved',
          reviewedAt: new Date(),
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!report) {
      throw new NotFoundException(`Reporte de pago con id ${id} no encontrado`);
    }

    return { ...report, id: report._id };
  }

  async reject(id: string, rejectPaymentReportDto: RejectPaymentReportDto) {
    const report = await this.paymentReportModel
      .findOneAndUpdate(
        { _id: id },
        {
          status: 'rejected',
          rejectionReason: rejectPaymentReportDto.rejectionReason,
          reviewedAt: new Date(),
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!report) {
      throw new NotFoundException(`Reporte de pago con id ${id} no encontrado`);
    }

    return { ...report, id: report._id };
  }
}

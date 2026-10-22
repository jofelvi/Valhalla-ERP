import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EmployeeLoan,
  EmployeeLoanDocument,
} from './schemas/employee-loan.schema';
import { CreateEmployeeLoanDto } from './dto/create-employee-loan.dto';
import { UpdateEmployeeLoanDto } from './dto/update-employee-loan.dto';
import { AbonoEmployeeLoanDto } from './dto/abono-employee-loan.dto';

const round2 = (n: number): number => Math.round(n * 100) / 100;

@Injectable()
export class EmployeeLoansService {
  constructor(
    @InjectModel(EmployeeLoan.name)
    private loanModel: Model<EmployeeLoanDocument>,
  ) {}

  async create(dto: CreateEmployeeLoanDto) {
    const loan = await this.loanModel.create(dto);
    const obj = loan.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll(filters?: { employeeId?: string; status?: string }) {
    let query = this.loanModel.find();
    if (filters?.employeeId) {
      query = query.where('employeeId').equals(filters.employeeId);
    }
    if (filters?.status === 'outstanding') {
      // Préstamos con saldo por cobrar: sin abonar o abonados a medias
      query = query.where('status').in(['pending', 'partial']);
    } else if (filters?.status) {
      query = query.where('status').equals(filters.status);
    }
    const loans = await query.sort({ createdAt: -1 }).lean().exec();
    return loans.map((l) => ({ ...l, id: String(l._id) }));
  }

  async findById(id: string) {
    const loan = await this.loanModel.findOne({ _id: id }).lean().exec();
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    return { ...loan, id: String(loan._id) };
  }

  async update(id: string, dto: UpdateEmployeeLoanDto) {
    const loan = await this.loanModel
      .findOneAndUpdate({ _id: id }, { ...dto }, { new: true })
      .lean()
      .exec();
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    return { ...loan, id: String(loan._id) };
  }

  // Abono parcial (o total) a un préstamo. Server-side: clampa al saldo,
  // acumula paidAmount, agrega al histórico y ajusta el status. Devuelve el
  // préstamo actualizado (con `applied` = lo realmente abonado).
  async abono(id: string, dto: AbonoEmployeeLoanDto) {
    const loan = await this.loanModel.findOne({ _id: id }).exec();
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    if (loan.status === 'cancelled') {
      throw new BadRequestException('El préstamo está anulado');
    }
    const remaining = round2((loan.amount ?? 0) - (loan.paidAmount ?? 0));
    if (remaining <= 0) {
      throw new BadRequestException('El préstamo ya está saldado');
    }
    // No se puede abonar más que el saldo pendiente
    const applied = round2(Math.min(dto.amount, remaining));
    if (applied <= 0) {
      throw new BadRequestException('El monto a abonar debe ser mayor a 0');
    }

    loan.paidAmount = round2((loan.paidAmount ?? 0) + applied);
    loan.paymentHistory = [
      ...(loan.paymentHistory ?? []),
      { amount: applied, payrollId: dto.payrollId, date: new Date() },
    ];
    const saldado = loan.paidAmount >= round2(loan.amount ?? 0) - 0.001;
    loan.status = saldado ? 'deducted' : 'partial';
    if (saldado) {
      loan.deductedPayrollId = dto.payrollId;
      loan.deductedAt = new Date();
    }
    loan.markModified('paymentHistory');
    await loan.save();

    const obj = loan.toObject();
    return { ...obj, id: String(obj._id), applied };
  }

  async remove(id: string) {
    const loan = await this.loanModel
      .findOneAndDelete({ _id: id })
      .lean()
      .exec();
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    return { deleted: true };
  }
}

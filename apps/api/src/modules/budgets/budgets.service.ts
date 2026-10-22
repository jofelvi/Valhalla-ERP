import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Budget, BudgetDocument } from './schemas/budget.schema';
import {
  AccountReceivable,
  AccountReceivableDocument,
} from '../accounts-receivable/schemas/account-receivable.schema';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { UpdateBudgetStatusDto } from './dto/update-budget-status.dto';
import { AcceptBudgetDto } from './dto/accept-budget.dto';
import { diaMesAnio } from '../../common/operacion/operacion.util';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private budgetModel: Model<BudgetDocument>,
    @InjectModel(AccountReceivable.name)
    private accountReceivableModel: Model<AccountReceivableDocument>,
  ) {}

  async create(createBudgetDto: CreateBudgetDto) {
    const budget = await this.budgetModel.create(createBudgetDto);
    const obj = budget.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll() {
    const budgets = await this.budgetModel.find().lean().exec();
    return budgets.map((budget) => ({ ...budget, id: budget._id }));
  }

  async findById(id: string) {
    const budget = await this.budgetModel.findOne({ _id: id }).lean().exec();
    if (!budget) {
      throw new NotFoundException(`Presupuesto con id ${id} no encontrado`);
    }
    return { ...budget, id: budget._id };
  }

  async findCalendar() {
    const budgets = await this.budgetModel
      .find({ status: 'approved', eventDate: { $exists: true, $ne: null } })
      .select(
        '_id budgetNumber customerName eventName eventDate total abonoAmount',
      )
      .lean()
      .exec();
    return budgets.map((b) => ({ ...b, id: b._id }));
  }

  async update(id: string, updateBudgetDto: UpdateBudgetDto) {
    const budget = await this.budgetModel
      .findOneAndUpdate({ _id: id }, updateBudgetDto, { new: true })
      .lean()
      .exec();
    if (!budget) {
      throw new NotFoundException(`Presupuesto con id ${id} no encontrado`);
    }
    return { ...budget, id: budget._id };
  }

  async updateStatus(id: string, updateBudgetStatusDto: UpdateBudgetStatusDto) {
    const budget = await this.budgetModel
      .findOneAndUpdate(
        { _id: id },
        { status: updateBudgetStatusDto.status },
        { new: true },
      )
      .lean()
      .exec();
    if (!budget) {
      throw new NotFoundException(`Presupuesto con id ${id} no encontrado`);
    }
    return { ...budget, id: budget._id };
  }

  async softDelete(id: string) {
    const budget = await this.budgetModel
      .findOneAndUpdate({ _id: id }, { status: 'expired' }, { new: true })
      .lean()
      .exec();
    if (!budget) {
      throw new NotFoundException(`Presupuesto con id ${id} no encontrado`);
    }
    return { ...budget, id: budget._id };
  }

  async acceptBudget(id: string, dto: AcceptBudgetDto) {
    const budget = await this.budgetModel.findOne({ _id: id }).lean().exec();
    if (!budget) {
      throw new NotFoundException(`Presupuesto con id ${id} no encontrado`);
    }
    if (budget.status === 'approved') {
      throw new BadRequestException('Este presupuesto ya fue aceptado.');
    }
    if (!budget.eventDate) {
      throw new BadRequestException(
        'El presupuesto no tiene fecha de evento. Agrega la fecha antes de aceptarlo.',
      );
    }
    if (dto.abonoAmount > budget.total) {
      throw new BadRequestException(
        'El abono no puede ser mayor que el total del presupuesto.',
      );
    }

    // Verificar conflicto de fecha: mismo día UTC
    const eventDay = new Date(budget.eventDate);
    const startOfDay = new Date(
      Date.UTC(
        eventDay.getUTCFullYear(),
        eventDay.getUTCMonth(),
        eventDay.getUTCDate(),
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        eventDay.getUTCFullYear(),
        eventDay.getUTCMonth(),
        eventDay.getUTCDate(),
        23,
        59,
        59,
      ),
    );
    const conflicting = await this.budgetModel
      .findOne({
        _id: { $ne: id },
        status: 'approved',
        eventDate: { $gte: startOfDay, $lte: endOfDay },
      })
      .lean()
      .exec();
    if (conflicting) {
      throw new ConflictException(
        `Ya existe un evento aceptado para esa fecha: "${conflicting.eventName}". Solo puede haber un evento por día.`,
      );
    }

    // Generar número EVT secuencial
    const lastEvt = await this.accountReceivableModel
      .findOne({ invoiceNumber: /^EVT-/ })
      .sort({ invoiceNumber: -1 })
      .lean()
      .exec();
    let nextNum = 1;
    if (lastEvt?.invoiceNumber) {
      const match = lastEvt.invoiceNumber.match(/^EVT-(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const evtNumber = `EVT-${String(nextNum).padStart(5, '0')}`;

    const saldo = Math.max(0, budget.total - dto.abonoAmount);
    // La fecha del evento es de calendario (medianoche UTC): se formatea en UTC.
    const eventDateFormatted = diaMesAnio(new Date(budget.eventDate), 'UTC');

    // Crear cuenta por cobrar
    const ar = await this.accountReceivableModel.create({
      _id: new Types.ObjectId().toString(),
      invoiceNumber: evtNumber,
      budgetId: id,
      customerName: budget.customerName,
      amount: saldo,
      paidAmount: 0,
      dueDate: budget.eventDate,
      status: 'pending',
      description: `Saldo pendiente — ${budget.eventName} (${eventDateFormatted})`,
    });

    // Actualizar presupuesto
    const updated = await this.budgetModel
      .findOneAndUpdate(
        { _id: id },
        {
          status: 'approved',
          abonoAmount: dto.abonoAmount,
          abonoMethod: dto.abonoMethod,
          abonoReference: dto.abonoReference ?? null,
          abonoDate: new Date(),
          accountReceivableId: String(ar._id),
        },
        { new: true },
      )
      .lean()
      .exec();

    return { ...updated, id: updated!._id, evtNumber };
  }
}

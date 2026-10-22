import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  computeCustomerDebt,
  parentIdsOf,
  type CustomerDebt,
  type DebtAccount,
  type ParentStatus,
} from './customer-debt';

/**
 * Deuda total de un cliente, en UN solo lugar.
 *
 * Vive aqui —y no repetida en pagos y cuentas por cobrar— para que las tres
 * vistas del negocio (pagina de cuentas, nomina y avisos) no puedan
 * desincronizarse entre si.
 */
@Injectable()
export class CustomerDebtService {
  private readonly logger = new Logger(CustomerDebtService.name);

  constructor(
    @InjectModel('AccountReceivable')
    private readonly accountReceivableModel: Model<DebtAccount>,
  ) {}

  async forCustomer(customerId?: string | null): Promise<CustomerDebt> {
    if (!customerId) return { count: 0, total: 0, orphanCount: 0 };

    const accounts = await this.accountReceivableModel
      .find({ customerId })
      .select('amount paidAmount status isMerged mergedIntoId')
      .lean()
      .exec();

    // Las madres pueden estar bajo OTRA ficha de cliente (consolidaciones
    // entre fichas son legitimas), asi que se consultan por id sin filtrar
    // por cliente.
    const parentIds = parentIdsOf(accounts);
    const parents: ParentStatus[] = parentIds.length
      ? (
          await this.accountReceivableModel
            .find({ _id: { $in: parentIds } })
            .select('status')
            .lean()
            .exec()
        ).map((p) => ({
          id: String((p as { _id: unknown })._id),
          status: p.status,
        }))
      : [];

    const debt = computeCustomerDebt(accounts, parents);

    // Señal temprana: si aparecen huerfanas, algo volvio a dejar la marca mal
    // puesta. La deuda ya quedo contada, pero conviene saberlo.
    if (debt.orphanCount > 0) {
      this.logger.warn(
        `Cliente ${customerId}: ${debt.orphanCount} cuenta(s) marcadas como fusionadas cuya consolidada no cobra. Se contaron igual; revisar consistencia.`,
      );
    }

    return debt;
  }
}

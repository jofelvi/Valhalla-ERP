import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Member,
  MemberDocument,
  accionNormalizada,
} from './schemas/member.schema';

@Injectable()
export class PublicService {
  constructor(
    @InjectModel('AccountReceivable')
    private accountReceivableModel: Model<any>,
    @InjectModel('Order') private orderModel: Model<any>,
    @InjectModel('Customer') private customerModel: Model<any>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  async getAccountReceivableInfo(id: string) {
    const ar: any = await this.accountReceivableModel
      .findOne({ _id: id })
      .select(
        'customerId invoiceNumber customerName amount paidAmount status dueDate createdAt updatedAt',
      )
      .lean()
      .exec();

    if (!ar) {
      throw new NotFoundException(
        `Accounts Receivable with id ${id} not found`,
      );
    }

    return {
      ...ar,
      id: ar._id,
      pending: (ar.amount || 0) - (ar.paidAmount || 0),
    };
  }

  async getOrderByIdOrInvoiceNumber(identifier: string) {
    let order: any = await this.orderModel
      .findOne({ _id: identifier })
      .lean()
      .exec();

    if (!order) {
      order = await this.orderModel
        .findOne({ invoiceNumber: identifier })
        .lean()
        .exec();
    }

    if (!order) {
      throw new NotFoundException(`Order with identifier ${identifier} not found`);
    }

    return { ...order, id: order._id };
  }

  async getAccountReceivableByInvoiceNumber(invoiceNumber: string) {
    const ar: any = await this.accountReceivableModel
      .findOne({ invoiceNumber, isMerged: { $ne: true } })
      .lean()
      .exec();

    if (!ar) {
      throw new NotFoundException(
        `Account receivable with invoiceNumber ${invoiceNumber} not found`,
      );
    }

    const orderIds: string[] =
      ar.isConsolidated && Array.isArray(ar.mergedOrderIds)
        ? ar.mergedOrderIds
        : ar.orderId
          ? [ar.orderId]
          : [];

    const orders: any[] = orderIds.length
      ? await this.orderModel
          .find({ _id: { $in: orderIds } })
          .lean()
          .exec()
      : [];

    const normalizedOrders = orders.map((o) => ({ ...o, id: o._id }));

    let customer: any = null;
    if (ar.customerId) {
      customer = await this.customerModel
        .findOne({ _id: ar.customerId })
        .select('name phone email')
        .lean()
        .exec();
      if (customer) customer = { ...customer, id: customer._id };
    }

    return {
      account: { ...ar, id: ar._id },
      orders: normalizedOrders,
      customer,
    };
  }

  /**
   * Lo que el POS necesita de un socio, credito incluido.
   *
   * Estos campos deciden si se le fia a alguien, y el POS los pedia a Firestore
   * porque la API no los devolvia.
   */
  private datosDeSocio(member: {
    accion: number;
    cedula: string;
    nombre: string;
    creditLimit?: number;
    creditUsed?: number;
    creditMonthsPaid?: number;
  }) {
    const creditLimit = member.creditLimit ?? 0;
    const creditUsed = member.creditUsed ?? 0;
    return {
      accion: member.accion,
      cedula: member.cedula,
      nombre: member.nombre,
      creditLimit,
      creditUsed,
      creditAvailable: Math.max(0, creditLimit - creditUsed),
      creditMonthsPaid: member.creditMonthsPaid ?? 0,
    };
  }

  async getMemberLookupByAction(action: string) {
    // El padron usa la accion con ceros a la izquierda ("00004"). Antes no se
    // normalizaba: pedir /members/4 daba 404 aunque el socio existiera.
    const member = await this.memberModel
      .findOne({ _id: accionNormalizada(action) })
      .lean()
      .exec();
    if (member) return this.datosDeSocio(member);

    // Fallback: customers con actionNumber, que se guarda sin relleno.
    const customer: any = await this.customerModel
      .findOne({ actionNumber: { $in: [action, accionNormalizada(action)] } })
      .select('id name email phone actionNumber isMember createdAt')
      .lean()
      .exec();

    if (!customer) {
      throw new NotFoundException(
        `Member with action number ${action} not found`,
      );
    }

    return { ...customer, id: customer._id };
  }

  async getMemberLookupByCedula(cedula: string) {
    const member = await this.memberModel.findOne({ cedula }).lean().exec();
    if (!member) {
      throw new NotFoundException(`Member with cedula ${cedula} not found`);
    }
    return this.datosDeSocio(member);
  }

  /**
   * Anota lo que un socio acaba de consumir a credito.
   *
   * Antes lo intentaba la web con un PATCH a una ruta suya que solo exportaba
   * GET: Next respondia 405 y la llamada era fire-and-forget, asi que el
   * consumo NUNCA se anotaba y el limite no se agotaba jamas. Los 1083 socios
   * del padron siguen en creditUsed: 0.
   *
   * Se escribe con un update condicionado al valor leido (Mongo aqui es
   * standalone, sin transacciones) para que dos cobros a la vez no se pisen, y
   * se topa en el limite: sin tope, un socio de $50 podria acabar con un
   * disponible negativo que ninguna pantalla sabe leer.
   */
  async registrarConsumoDeCredito(action: string, monto: number) {
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new BadRequestException('El monto consumido debe ser mayor que 0');
    }

    const id = accionNormalizada(action);

    for (let intento = 0; intento < 3; intento++) {
      const socio = await this.memberModel.findOne({ _id: id }).lean().exec();
      if (!socio) {
        throw new NotFoundException(
          `Member with action number ${action} not found`,
        );
      }

      const usado = socio.creditUsed ?? 0;
      const disponible = Math.max(0, (socio.creditLimit ?? 0) - usado);
      if (monto > disponible + 0.01) {
        throw new BadRequestException(
          `El socio #${id} tiene $${disponible.toFixed(2)} de credito disponible y se intentan cargar $${monto.toFixed(2)}`,
        );
      }

      const actualizado = await this.memberModel
        .findOneAndUpdate(
          { _id: id, creditUsed: usado === 0 ? { $in: [0, null] } : usado },
          { $inc: { creditUsed: monto } },
          { new: true },
        )
        .lean()
        .exec();

      if (actualizado) return this.datosDeSocio(actualizado);
    }

    throw new BadRequestException(
      `No se pudo anotar el consumo del socio #${id}: intentalo de nuevo`,
    );
  }
}

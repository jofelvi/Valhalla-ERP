import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { createInvoiceOnce, facturaDeLaOrden } from '../../common/invoice-once';
import { ConfigsService } from '../configs/configs.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User } from '../auth/schemas/user.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Product } from '../products/schemas/product.schema';
import { Customer } from '../customers/schemas/customer.schema';
import {
  construirConsultaDeFacturas,
  type FiltrosDeFacturas,
} from './filtros-de-facturas.util';
import { proyeccionPedida } from './vista-de-facturas.util';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectConnection() private connection: Connection,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Devuelve el siguiente numero de control fiscal correlativo.
   * Usa la collection 'counters' con findOneAndUpdate atomico ($inc) para
   * garantizar unicidad sin importar concurrencia.
   * Formato: NN-NNNNNNNN (default 8 digitos con padding 0).
   */
  async getNextControlNumber(): Promise<{
    controlNumber: string;
    seq: number;
  }> {
    const result = await this.connection
      .collection('counters')
      .findOneAndUpdate(
        { _id: 'invoice_control_number' as unknown as never },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
    const seq = (result?.seq as number) ?? 1;
    const controlNumber = `00-${String(seq).padStart(8, '0')}`;
    return { controlNumber, seq };
  }

  async create(createInvoiceDto: CreateInvoiceDto) {
    // Una orden, una factura (ver common/invoice-once.ts). Este endpoint no
    // tenia NINGUN control: la web POS y el APK facturaban por aca mientras
    // el API facturaba por su cuenta al verificar el Pago Movil, y nadie se
    // enteraba de lo que hacia el otro.
    const { invoice, yaExistia } = await createInvoiceOnce(this.invoiceModel, {
      ...createInvoiceDto,
      createdAt: new Date(),
    });
    if (yaExistia) {
      this.logger.warn(
        `Factura duplicada evitada: la orden ${createInvoiceDto.orderId} ya tenia factura`,
      );
    }
    return { ...invoice, id: String(invoice._id) };
  }

  /**
   * Facturas, filtradas y acotadas.
   *
   * Antes no recibia NI UN parametro y devolvia las 4.735 (5,2 MB crudos).
   * Ver `filtros-de-facturas.util.ts`: la pantalla de recibo se bajaba todo eso
   * para usar una sola factura.
   */
  async findAll(filtros?: FiltrosDeFacturas) {
    const { query, limit, skip } = construirConsultaDeFacturas(filtros);
    const proyeccion = proyeccionPedida(filtros?.vista);
    const invoices = await this.invoiceModel
      .find(query, proyeccion ?? undefined)
      .lean()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    if (invoices.length === limit) {
      // Mismo aviso que en ordenes: el truncamiento silencioso es exactamente
      // como se rompen los reportes.
      this.logger.warn(
        `[facturas] respuesta truncada en ${limit}. Filtros: ` +
          `${JSON.stringify(filtros ?? {})}. Si este consumidor necesita mas, ` +
          `tiene que mandar 'limit'.`,
      );
    }

    return invoices.map((invoice) => ({ ...invoice, id: invoice._id }));
  }

  async findById(id: string) {
    const invoice = await this.invoiceModel.findOne({ _id: id }).lean().exec();
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return { ...invoice, id: invoice._id };
  }

  async findByNumber(number: string) {
    const invoice = await this.invoiceModel
      .findOne({
        invoiceNumber: number,
      })
      .lean()
      .exec();
    if (!invoice) {
      throw new NotFoundException(`Invoice with number ${number} not found`);
    }
    return { ...invoice, id: invoice._id };
  }

  async findByOrderId(orderId: string) {
    const invoice = await this.invoiceModel
      .findOne(facturaDeLaOrden(orderId))
      .lean()
      .exec();
    if (!invoice) {
      throw new NotFoundException(`Invoice for order ${orderId} not found`);
    }
    return { ...invoice, id: invoice._id };
  }

  async findDetails(id: string) {
    const invoice = await this.invoiceModel.findOne({ _id: id }).lean().exec();
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    const invoiceObj = { ...invoice, id: invoice._id };

    let order: (OrderDocument & { id?: string }) | null = null;
    let customer: (Customer & { id?: string }) | null = null;
    let user: (User & { id?: string }) | null = null;
    interface EnrichedItem {
      product?: (Product & { id?: string }) | null;
    }
    let enrichedItems: EnrichedItem[] = [];
    let payments: (PaymentDocument & { id?: string })[] = [];

    if (invoice.orderId) {
      order = (await this.orderModel
        .findOne({ _id: invoice.orderId })
        .lean()
        .exec()) as unknown as (OrderDocument & { id?: string }) | null;

      if (order) {
        // Enrich items with product data
        interface OrderItem {
          productId: string;
          [key: string]: unknown;
        }
        const productIds = ((order.items as unknown as OrderItem[]) || [])
          .map((i) => i.productId)
          .filter(Boolean);
        const products = (await this.productModel
          .find({ _id: { $in: productIds } })
          .lean()
          .exec()) as unknown as (Product & { id?: string })[];
        const productMap = new Map(
          products.map((p) => [String(p._id), { ...p, id: p._id }]),
        );

        enrichedItems = ((order.items as unknown as OrderItem[]) || []).map(
          (item) => ({
            ...item,
            product: productMap.get(item.productId) || null,
          }),
        );

        // Fetch payments for this order
        const paymentDocs = await this.paymentModel
          .find({ orderId: invoice.orderId })
          .lean()
          .exec();
        payments = (
          paymentDocs as unknown as Array<{
            _id: string;
            [key: string]: unknown;
          }>
        ).map((p) => ({
          ...(p as unknown as PaymentDocument),
          id: p._id,
        })) as unknown as (PaymentDocument & { id?: string })[];

        // Fetch customer
        if (order.customerId) {
          try {
            customer = await this.customerModel
              .findOne({ _id: order.customerId })
              .lean()
              .exec();
            if (customer) customer = { ...customer, id: customer._id };
          } catch {
            /* ignore */
          }
        }

        // Fetch user who created the order
        if (order.userId) {
          try {
            user = await this.userModel
              .findOne({ _id: order.userId })
              .lean()
              .exec();
            if (user) user = { ...user, id: user._id };
          } catch {
            /* ignore */
          }
        }

        order = {
          ...(order as unknown as { _id?: string; [key: string]: unknown }),
          id: order._id,
        } as unknown as (OrderDocument & { id?: string }) | null;
      }
    } else if (invoice.customerId) {
      try {
        customer = await this.customerModel
          .findOne({ _id: invoice.customerId })
          .lean()
          .exec();
        if (customer) customer = { ...customer, id: customer._id };
      } catch {
        /* ignore */
      }
    }

    const totalPaid = payments.reduce(
      (sum: number, p: PaymentDocument) => sum + (p.amount || 0),
      0,
    );

    // Datos del emisor para la factura impresa: salen de `negocio`, nunca del código.
    const negocio = await this.configs.obtener('negocio');
    const emisor = {
      nombre: negocio.legalName || negocio.tradeName,
      rif: negocio.taxId,
      domicilio: negocio.address,
      telefono: negocio.phone,
    };

    return {
      invoice: invoiceObj,
      order,
      customer,
      user,
      enrichedItems,
      payments,
      totalPaid,
      emisor,
    };
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto) {
    const invoice = await this.invoiceModel
      .findOneAndUpdate(
        { _id: id },
        { ...updateInvoiceDto, updatedAt: new Date() },
        { new: true },
      )
      .lean()
      .exec();
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return { ...invoice, id: invoice._id };
  }

  async remove(id: string) {
    const invoice = await this.invoiceModel.findOne({ _id: id }).exec();
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    await this.invoiceModel.deleteOne({ _id: id });
    return { message: 'Invoice deleted successfully' };
  }
}

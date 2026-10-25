import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, PipelineStage, Connection } from 'mongoose';
import { CustomerNotifierService } from '../sms/customer-notifier.service';
import { buildCompraDirectaSms, buildCreditSms } from '../sms/sms-messages';
import {
  buildCompraDirectaEmail,
  buildCreditEmail,
} from '../sms/email-templates';
import { CustomerDebtService } from '../sms/customer-debt.service';
import {
  AccountReceivable,
  AccountReceivableDocument,
} from './schemas/account-receivable.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import {
  AccountsReceivableFilters,
  buildAccountsReceivableBaseFilter,
  buildAccountsReceivableFilter,
  condicionDeEstado,
  filtroDeTexto,
} from './accounts-receivable-filter.util';
import { SociosExcluidosService } from '../socios-excluidos/socios-excluidos.service';
import {
  Customer,
  CustomerDocument,
} from '../customers/schemas/customer.schema';
import { CreateAccountReceivableDto } from './dto/create-account-receivable.dto';
import { UpdateAccountReceivableDto } from './dto/update-account-receivable.dto';
import { MergeAccountsDto, UnmergeAccountDto } from './dto/merge-accounts.dto';
import { nombreVisible } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { paredEnZona } from '../../common/operacion/operacion.util';

/** Totales de un grupo de cuentas. `pendiente` = facturado − pagado. */
export interface TotalesDeBloque {
  cuentas: number;
  facturado: number;
  pagado: number;
  pendiente: number;
}

export interface ResumenCartera {
  /** Lo que de verdad hay por cobrar con el filtro activo. */
  cartera: TotalesDeBloque;
  /** Desglose por estado de las cuentas vivas, de mayor a menor pendiente. */
  porEstado: (TotalesDeBloque & { estado: string })[];
  /** Lo que se dejo fuera del total, para poder decirlo en pantalla. */
  apartado: {
    anuladas: TotalesDeBloque;
    unificadas: TotalesDeBloque;
    socios: TotalesDeBloque & { motivo: string };
  };
}

/** Una fila del `$group` de la agregacion del resumen. */
interface FilaDeSuma {
  _id?: string | null;
  cuentas: number;
  facturado: number;
  pagado: number;
}

interface FacetasDeResumen {
  cartera?: FilaDeSuma[];
  porEstado?: FilaDeSuma[];
  anuladas?: FilaDeSuma[];
  unificadas?: FilaDeSuma[];
  socios?: FilaDeSuma[];
}

@Injectable()
export class AccountsReceivableService {
  private readonly logger = new Logger(AccountsReceivableService.name);

  constructor(
    @InjectModel(AccountReceivable.name)
    private accountReceivableModel: Model<AccountReceivableDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
    @InjectModel(Customer.name)
    private customerModel: Model<CustomerDocument>,
    @InjectConnection() private connection: Connection,
    private readonly notifier: CustomerNotifierService,
    private readonly debtService: CustomerDebtService,
    private readonly configService: ConfigService,
    private readonly sociosExcluidos: SociosExcluidosService,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Aviso por SMS de que el consumo quedo a credito. Va aqui —y no en el flujo
   * del movil— porque TODA cuenta por cobrar nace de este metodo: la del POS
   * web, la del APK y la de aprobar una solicitud de credito. Enganchar en un
   * solo camino dejaria los otros sin aviso (mismo error que tenia la
   * propagacion del cobro a las ordenes).
   *
   * Fire-and-forget: un SMS caido no puede tumbar el registro de una deuda.
   */
  /**
   * Una cuenta que nace saldada NO es un credito: es una compra que se pago en
   * el acto. El formulario tiene «Monto Pagado», asi que es un caso normal.
   *
   * Sin esto se le mandaba el aviso de credito a quien acababa de pagar —«tu
   * consumo quedo pendiente de pago», con enlace para pagarlo—. Medido en
   * produccion el 25/09/2026: en 45 dias, 9 cuentas se saldaron en menos de una
   * hora, varias en 0, 1 y 3 minutos.
   */
  private static naceSaldada(cuenta: {
    status?: string;
    amount: number;
    paidAmount?: number;
  }): boolean {
    if (cuenta.amount <= 0) return true;
    if (cuenta.status === 'paid') return true;
    // El centavo de holgura es el mismo criterio con el que el resto del
    // modulo compara dinero.
    return (cuenta.paidAmount ?? 0) >= cuenta.amount - 0.01;
  }

  private async notifyCreditBySms(account: {
    _id: unknown;
    customerId?: string;
    customerName?: string;
    orderId?: string | null;
    amount: number;
    paidAmount?: number;
    status?: string;
    dueDate?: Date;
  }): Promise<void> {
    try {
      if (!account.customerId) return;
      const customer = await this.customerModel
        .findOne({ _id: account.customerId })
        .select('phone name email')
        .lean()
        .exec();
      if (!customer?.phone && !customer?.email) return;

      // El detalle vive en la orden, no en la cuenta: hay que traerlo.
      const order = account.orderId
        ? await this.orderModel
            .findOne({ _id: account.orderId })
            .select('items')
            .lean()
            .exec()
        : null;
      const items = (order?.items ?? []).map((it) => ({
        quantity: it.quantity,
        name: it.name ?? 'Producto',
        total: it.total,
      }));

      // Base pública de la app para los enlaces del SMS. Sin variable, el enlace queda vacío.
      const publicAppUrl =
        this.configService.get<string>('PUBLIC_APP_URL') ?? '';

      // Deuda total del cliente, ya incluyendo esta cuenta recien creada.
      const debt = await this.debtService.forCustomer(account.customerId);

      const esCompraDirecta = AccountsReceivableService.naceSaldada(account);
      const marca = nombreVisible(
        await this.configs.obtener('marca'),
        await this.configs.obtener('negocio'),
      );

      const body = esCompraDirecta
        ? buildCompraDirectaSms({
            customerName: account.customerName ?? customer.name,
            amount: account.amount,
            items,
            // La deuda que le queda DESPUES de esta compra: lo que ya debia de
            // antes. Restarla evita cobrarle dos veces lo mismo en el aviso.
            outstandingTotal: debt.total - account.amount,
            publicAppUrl,
            marca,
          })
        : buildCreditSms({
            customerName: account.customerName ?? customer.name,
            orderId: account.orderId ?? null,
            marca,
            accountReceivableId: String(account._id),
            amount: account.amount,
            dueDate: account.dueDate,
            items,
            outstandingTotal: debt.total,
            publicAppUrl,
          });

      // El correo importa aunque ya haya SMS: el notificador manda SMS solo si
      // hay telefono, y si no lo hay el correo es el UNICO aviso que recibe el
      // cliente. Por eso una compra directa tiene su propio correo en vez de
      // quedarse sin ninguno.
      const mail = esCompraDirecta
        ? buildCompraDirectaEmail({
            customerName: account.customerName ?? customer.name,
            amount: account.amount,
            items,
            outstandingTotal: debt.total - account.amount,
            publicAppUrl,
            marca,
          })
        : buildCreditEmail({
            customerName: account.customerName ?? customer.name,
            accountReceivableId: String(account._id),
            amount: account.amount,
            dueDate: account.dueDate,
            items,
            outstandingTotal: debt.total,
            publicAppUrl,
            marca,
          });

      const res = await this.notifier.notify({
        phone: customer.phone,
        email: customer.email,
        smsBody: body,
        emailSubject: mail.subject,
        emailHtml: mail.html,
        clientMessageId: `${esCompraDirecta ? 'compra' : 'credito'}-${String(account._id)}`,
        context: `cuenta ${String(account._id)}`,
      });
      if (!res.sent) {
        this.logger.warn(
          `Aviso de credito no enviado a ${customer.name ?? account.customerId}: ${res.reason}`,
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Aviso de credito por SMS fallo: ${msg}`);
    }
  }

  private static round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Genera el siguiente numero CONS- de forma atomica.
   * Formato: CONS-YYYYMMDD-HHMM-SSSS (con secuencia en lugar de segundos para
   * evitar duplicados en el mismo minuto). El contador garantiza unicidad incluso
   * con dos consolidaciones en el mismo minuto.
   */
  private async getNextConsolidationNumber(): Promise<{
    invoiceNumber: string;
    seq: number;
  }> {
    const op = await this.configs.obtener('operacion');
    const result = await this.connection
      .collection('counters')
      .findOneAndUpdate(
        { _id: 'consolidation_number' as unknown as never },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
    const seq = (result?.seq as number) ?? 1;

    // Hora de pared de la operación, no la del servidor.
    const {
      anio: yyyy,
      mes,
      dia,
      hora,
      minuto,
    } = paredEnZona(new Date(), op.timezone);
    const mm = String(mes).padStart(2, '0');
    const dd = String(dia).padStart(2, '0');
    const hh = String(hora).padStart(2, '0');
    const mi = String(minuto).padStart(2, '0');
    const ss = String(seq % 10000).padStart(4, '0');

    const invoiceNumber = `CONS-${yyyy}${mm}${dd}-${hh}${mi}-${ss}`;
    return { invoiceNumber, seq };
  }

  // El monto de una cuenta por cobrar es SIEMPRE la suma de los totales de sus
  // ordenes (fuente de verdad, ADR 6). Nunca se suman snapshots de otras cuentas:
  // esos se desincronizan cuando la orden se normaliza y el error se disfraza de
  // "servicio" en la factura. Devuelve el desglose para poder auditar/mostrar.
  private async sumOrderTotals(orderIds: string[]): Promise<{
    subtotal: number;
    serviceCharge: number;
    tax: number;
    tip: number;
    total: number;
    ordersFound: number;
    ordersExpected: number;
  }> {
    const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return {
        subtotal: 0,
        serviceCharge: 0,
        tax: 0,
        tip: 0,
        total: 0,
        ordersFound: 0,
        ordersExpected: 0,
      };
    }

    const orders = await this.orderModel
      .find({ _id: { $in: uniqueIds } })
      .select('_id subtotal serviceCharge tax tipAmount total')
      .lean()
      .exec();

    const r = AccountsReceivableService.round2;
    return {
      subtotal: r(orders.reduce((s, o) => s + (o.subtotal || 0), 0)),
      serviceCharge: r(orders.reduce((s, o) => s + (o.serviceCharge || 0), 0)),
      tax: r(orders.reduce((s, o) => s + (o.tax || 0), 0)),
      tip: r(orders.reduce((s, o) => s + (o.tipAmount || 0), 0)),
      total: r(orders.reduce((s, o) => s + (o.total || 0), 0)),
      ordersFound: orders.length,
      ordersExpected: uniqueIds.length,
    };
  }

  // Ordenes que respaldan una cuenta: en las consolidadas orderId es null y las
  // ordenes reales viven en mergedOrderIds.
  private static orderIdsOf(account: {
    orderId?: string | null;
    mergedOrderIds?: string[] | null;
  }): string[] {
    const ids = account.mergedOrderIds?.length
      ? account.mergedOrderIds
      : account.orderId
        ? [account.orderId]
        : [];
    return Array.from(new Set(ids.filter(Boolean)));
  }

  // Al saldar la cuenta, la orden pasa a pagada. Es obligatorio: la comision del
  // mesonero solo entra en nomina cuando order.paymentStatus === 'paid' (filtro
  // comisionPendiente en OrdersService + ComisionesService). Sin esto las ordenes
  // a credito quedan en 'pending' para siempre y el mesonero nunca cobra su
  // servicio aunque el cliente ya pago. Idempotente: solo toca las no pagadas.
  private async markOrdersPaid(account: {
    _id?: unknown;
    orderId?: string | null;
    mergedOrderIds?: string[] | null;
  }): Promise<void> {
    const orderIds = AccountsReceivableService.orderIdsOf(account);
    if (orderIds.length === 0) return;

    await this.orderModel.updateMany(
      { _id: { $in: orderIds }, paymentStatus: { $ne: 'paid' } },
      {
        $set: {
          paymentStatus: 'paid',
          status: 'PAID',
          updatedAt: new Date(),
        },
      },
    );
  }

  async create(createAccountReceivableDto: CreateAccountReceivableDto) {
    // El estado se guarda en minuscula ('pending', 'paid'), como lo filtra y lo
    // escribe el resto de la API. La caja del APK mandaba 'PENDING' y quedaban
    // cuentas con dos grafias segun el camino por el que se dio el credito.
    const account = await this.accountReceivableModel.create({
      ...createAccountReceivableDto,
      status: String(createAccountReceivableDto.status ?? 'pending').toLowerCase(),
    });
    const obj = account.toObject();
    // No se espera el SMS: la cuenta ya quedo registrada y el aviso es accesorio.
    void this.notifyCreditBySms({
      _id: obj._id,
      customerId: obj.customerId,
      customerName: obj.customerName,
      orderId: obj.orderId,
      amount: obj.amount,
      // Sin estos dos no se puede distinguir un credito de una compra pagada
      // en el acto, y a las dos les llegaba el mismo aviso de cobro.
      paidAmount: obj.paidAmount,
      status: obj.status,
      dueDate: obj.dueDate,
    });
    return { ...obj, id: String(obj._id) };
  }

  /**
   * Ids de los clientes que coinciden con el texto buscado por su NOMBRE o por
   * su N° de accion.
   *
   * La accion vive en `customers` y no en la cuenta, asi que no se puede
   * buscar con un solo `find` sobre la cartera. El nombre tambien se resuelve
   * aqui porque la cuenta guarda una copia (`customerName`) que puede estar
   * vieja: si el cliente se renombro, la copia no encuentra y el padron si.
   */
  private async clientesQueCoinciden(texto?: string): Promise<string[]> {
    // Mismo criterio que la lista: todas las palabras, sin que importe la
    // tilde, y los numeros comparados como numeros (`327` encuentra `00327`).
    const filtro = filtroDeTexto(texto, [
      'name',
      'memberAction',
      'phone',
      'identificationId',
    ]);
    if (!filtro) return [];
    const clientes = await this.customerModel
      .find(filtro)
      .select('_id')
      .limit(500)
      .lean()
      .exec();
    return clientes.map((c) => String(c._id));
  }

  async findAll(filters?: AccountsReceivableFilters) {
    const conTexto: AccountsReceivableFilters = {
      ...filters,
      customerIdsPorTexto: await this.clientesQueCoinciden(filters?.q),
    };
    const op = await this.configs.obtener('operacion');
    const accounts = await this.accountReceivableModel
      .find(buildAccountsReceivableFilter(conTexto, op))
      .lean()
      .exec();

    const allOrderIds = new Set<string>();
    for (const acc of accounts) {
      if (acc.mergedOrderIds?.length) {
        acc.mergedOrderIds.forEach((id) => id && allOrderIds.add(id));
      } else if (acc.orderId) {
        allOrderIds.add(acc.orderId);
      }
    }

    const orderItemsMap = new Map<
      string,
      { name: string; quantity: number; total: number }[]
    >();
    // orderId -> nombre del mesonero (para mostrar en la tabla sin N+1)
    const waiterByOrder = new Map<string, string>();
    if (allOrderIds.size > 0) {
      const orders = await this.orderModel
        .find({ _id: { $in: [...allOrderIds] } })
        .select('_id items waiterName')
        .lean()
        .exec();
      for (const order of orders) {
        orderItemsMap.set(
          String(order._id),
          (order.items || []).map((it) => ({
            name: it.name,
            quantity: it.quantity,
            total: it.total,
          })),
        );
        if (order.waiterName) {
          waiterByOrder.set(String(order._id), order.waiterName);
        }
      }
    }

    // Telefono y numero de accion del cliente (una sola consulta para todas
    // las cuentas). La accion es como el dueño identifica a un socio — 2.084 de
    // los 2.992 clientes la tienen — y no viajaba en la cuenta, asi que no se
    // podia buscar por ella en esta pantalla. Sale de la consulta que ya
    // estaba hecha para el telefono: cero viajes extra.
    const customerIds = Array.from(
      new Set(accounts.map((a) => a.customerId).filter(Boolean)),
    );
    const phoneByCustomer = new Map<string, string>();
    const actionByCustomer = new Map<string, string>();
    if (customerIds.length > 0) {
      const customers = await this.customerModel
        .find({ _id: { $in: customerIds } })
        .select('_id phone memberAction')
        .lean()
        .exec();
      for (const c of customers) {
        if (c.phone) phoneByCustomer.set(String(c._id), c.phone);
        if (c.memberAction) {
          actionByCustomer.set(String(c._id), String(c.memberAction));
        }
      }
    }

    return accounts.map((account) => {
      const oids = account.mergedOrderIds?.length
        ? account.mergedOrderIds.filter(Boolean)
        : account.orderId
          ? [account.orderId]
          : [];
      const orderItems = oids.flatMap((id) => orderItemsMap.get(id) || []);
      // Mesonero(s): distintos nombres de las ordenes de esta cuenta.
      const waiterName =
        Array.from(
          new Set(oids.map((id) => waiterByOrder.get(id)).filter(Boolean)),
        ).join(', ') || null;
      const customerPhone =
        phoneByCustomer.get(String(account.customerId)) ?? null;
      const customerMemberAction =
        actionByCustomer.get(String(account.customerId)) ?? null;
      return {
        ...account,
        id: account._id,
        orderItems,
        waiterName,
        customerPhone,
        customerMemberAction,
      };
    });
  }

  /**
   * Totales de la cartera, calculados en la base.
   *
   * Nace el 20/09/2026 porque las tarjetas de la pantalla se calculaban en el
   * navegador sobre las 1.067 cuentas bajadas, y **no aplicaban el mismo
   * criterio que la lista de abajo**: apartaban las unificadas pero NO las
   * anuladas. Resultado medido en produccion: la tarjeta "Pendiente" decia
   * $9.770,55 cuando lo real eran $8.392,82 — $1.377,73 de 37 cuentas anuladas
   * que la lista escondia y el total sumaba.
   *
   * Lo que se aparta no se oculta: viaja en `apartado` para poder mostrarlo.
   * Un numero que baja sin decir por que es peor que un numero malo.
   */
  async resumen(filters?: AccountsReceivableFilters): Promise<ResumenCartera> {
    const conTexto: AccountsReceivableFilters = {
      ...filters,
      customerIdsPorTexto: await this.clientesQueCoinciden(filters?.q),
    };
    const op = await this.configs.obtener('operacion');
    const base = buildAccountsReceivableBaseFilter(conTexto, op);

    const socios = await this.sociosExcluidos.resolver();
    const idsSocios = socios.habilitado ? socios.customerIds : [];

    // "Viva" = ni absorbida por una unificacion ni anulada. Es el MISMO
    // criterio con el que se arma la lista; ahi estaba el bug.
    const viva = { isMerged: { $ne: true }, status: { $ne: 'cancelled' } };

    // El estado de la cartera sale de `condicionDeEstado`, la misma funcion
    // que usa la lista. Estuvo escrito aqui a mano y se equivoco: juntaba dos
    // claves `status` en el mismo objeto y la segunda pisaba a la primera, asi
    // que las anuladas volvian a sumar. Se vio porque la cartera decia 184
    // cuentas y el desglose por estado sumaba 159.
    const estado = condicionDeEstado({ ...filters, soloVivas: true });

    const sumar: PipelineStage.Group = {
      $group: {
        _id: null,
        cuentas: { $sum: 1 },
        facturado: { $sum: { $ifNull: ['$amount', 0] } },
        pagado: { $sum: { $ifNull: ['$paidAmount', 0] } },
      },
    };

    const [salida] = await this.accountReceivableModel
      .aggregate<FacetasDeResumen>([
        { $match: base },
        {
          $facet: {
            // Lo que de verdad cuenta: vivas, del tab activo y sin socios.
            cartera: [
              {
                $match: {
                  isMerged: { $ne: true },
                  ...estado,
                  ...(idsSocios.length
                    ? { customerId: { $nin: idsSocios } }
                    : {}),
                },
              },
              sumar,
            ],
            porEstado: [
              {
                $match: {
                  ...viva,
                  ...(idsSocios.length
                    ? { customerId: { $nin: idsSocios } }
                    : {}),
                },
              },
              {
                $group: {
                  _id: '$status',
                  cuentas: { $sum: 1 },
                  facturado: { $sum: { $ifNull: ['$amount', 0] } },
                  pagado: { $sum: { $ifNull: ['$paidAmount', 0] } },
                },
              },
            ],
            anuladas: [
              { $match: { isMerged: { $ne: true }, status: 'cancelled' } },
              sumar,
            ],
            unificadas: [{ $match: { isMerged: true } }, sumar],
            socios: idsSocios.length
              ? [{ $match: { ...viva, customerId: { $in: idsSocios } } }, sumar]
              : [{ $match: { _id: null } }, sumar],
          },
        },
      ])
      .exec();

    const bloque = (filas?: FilaDeSuma[]): TotalesDeBloque => {
      const f = filas?.[0];
      const facturado = f?.facturado ?? 0;
      const pagado = f?.pagado ?? 0;
      // Se redondea UNA sola vez, al final. Restar dos numeros ya redondeados
      // inventa centavos: asi aparecio un centavo de mas en el panel.
      return {
        cuentas: f?.cuentas ?? 0,
        facturado: AccountsReceivableService.round2(facturado),
        pagado: AccountsReceivableService.round2(pagado),
        pendiente: AccountsReceivableService.round2(facturado - pagado),
      };
    };

    return {
      cartera: bloque(salida?.cartera),
      porEstado: (salida?.porEstado ?? [])
        .map((fila) => ({
          estado: String(fila._id ?? 'sin_estado'),
          ...bloque([fila]),
        }))
        .sort((a, b) => b.pendiente - a.pendiente),
      apartado: {
        anuladas: bloque(salida?.anuladas),
        unificadas: bloque(salida?.unificadas),
        socios: { ...bloque(salida?.socios), motivo: socios.motivo },
      },
    };
  }

  async findById(id: string) {
    const account = await this.accountReceivableModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!account) {
      throw new NotFoundException(
        `Cuenta por cobrar con id ${id} no encontrada`,
      );
    }
    return { ...account, id: account._id };
  }

  async update(
    id: string,
    updateAccountReceivableDto: UpdateAccountReceivableDto,
    actor?: { id?: string; email?: string },
  ) {
    // Auditoria: si el update toca el dinero (paidAmount) o el estado, se sella
    // quien lo hizo y cuando. El actor sale del JWT, nunca del body, para que
    // no se pueda falsear desde el cliente.
    const touchesMoney =
      updateAccountReceivableDto.paidAmount !== undefined ||
      updateAccountReceivableDto.status !== undefined;

    const payload: Record<string, unknown> = { ...updateAccountReceivableDto };
    if (touchesMoney) {
      payload.settledByUserId = actor?.id ?? 'desconocido';
      payload.settledByEmail = actor?.email ?? '';
      payload.settledAt = new Date();
      // Si el cliente no declara el origen, es una edicion manual de la ficha
      payload.settlementSource =
        updateAccountReceivableDto.settlementSource ?? 'MANUAL';
    }

    const account = await this.accountReceivableModel
      .findOneAndUpdate({ _id: id }, payload, { new: true })
      .lean()
      .exec();

    if (!account) {
      throw new NotFoundException(
        `Cuenta por cobrar con id ${id} no encontrada`,
      );
    }

    // Se dispara con el estado RESULTANTE (no con lo que mando el cliente): asi
    // cubre todas las vias de cobro — registrar pago, edicion manual de la ficha
    // y cobros de staff — que antes dejaban las ordenes en 'pending'.
    if (account.status === 'paid') {
      await this.markOrdersPaid(account);
    }

    return { ...account, id: account._id };
  }

  async mergeAccounts(
    mergeAccountsDto: MergeAccountsDto,
    actor?: { id?: string; email?: string; name?: string },
  ) {
    if (mergeAccountsDto.accountIds.length < 2) {
      throw new BadRequestException(
        'Se requieren al menos 2 cuentas para consolidar',
      );
    }

    const accounts = await this.accountReceivableModel
      .find({
        _id: { $in: mergeAccountsDto.accountIds },
      })
      .lean()
      .exec();

    if (accounts.length !== mergeAccountsDto.accountIds.length) {
      throw new NotFoundException('Una o más cuentas no encontradas');
    }

    // Aplanar: si alguna cuenta ya es consolidada, usar sus mergedAccountIds/mergedOrderIds
    // como originales. Asi el resultado final siempre tiene como hijos solo cuentas
    // individuales reales, nunca consolidadas anidadas.
    const flatAccountIds: string[] = [];
    const flatOrderIds: string[] = [];
    const intermediatesToDelete: string[] = [];

    for (const acc of accounts) {
      if (acc.isConsolidated && acc.mergedAccountIds?.length) {
        flatAccountIds.push(...acc.mergedAccountIds);
        if (acc.mergedOrderIds?.length) {
          flatOrderIds.push(...acc.mergedOrderIds);
        }
        intermediatesToDelete.push(String(acc._id));
      } else {
        flatAccountIds.push(String(acc._id));
        if (acc.orderId) {
          flatOrderIds.push(acc.orderId);
        }
      }
    }

    const uniqueAccountIds = Array.from(new Set(flatAccountIds));
    const uniqueOrderIds = Array.from(new Set(flatOrderIds));

    // Monto consolidado = suma de los totales de las ordenes reales (no de los
    // amount guardados de las cuentas hijas, que pueden estar desfasados si la
    // orden se normalizo despues). Fallback al metodo viejo solo si falta alguna
    // orden, para no perder deuda en un caso degenerado.
    const orderTotals = await this.sumOrderTotals(uniqueOrderIds);
    const allOrdersFound =
      orderTotals.ordersExpected > 0 &&
      orderTotals.ordersFound === orderTotals.ordersExpected;
    const totalAmount = allOrdersFound
      ? orderTotals.total
      : AccountsReceivableService.round2(
          accounts.reduce((sum, acc) => sum + acc.amount, 0),
        );
    const totalPaidAmount = AccountsReceivableService.round2(
      accounts.reduce((sum, acc) => sum + acc.paidAmount, 0),
    );
    const customerName = accounts[0].customerName;

    // Numero atomico: CONS-YYYYMMDD-HHMM-SSSS (secuencia en lugar de segundos
    // para evitar duplicados cuando dos consolidaciones ocurren en el mismo minuto).
    const { invoiceNumber, seq: consolidationSeq } =
      await this.getNextConsolidationNumber();

    const consolidatedAccount = await this.accountReceivableModel.create({
      customerId: accounts[0].customerId,
      customerName,
      invoiceNumber,
      amount: totalAmount,
      paidAmount: totalPaidAmount,
      dueDate: new Date(),
      status: 'pending',
      isConsolidated: true,
      mergedAccountIds: uniqueAccountIds,
      mergedOrderIds: uniqueOrderIds,
      consolidatedByUserId: actor?.id ?? 'desconocido',
      consolidatedByUserEmail: actor?.email ?? '',
      consolidatedByUserName: actor?.name ?? '',
      consolidatedAt: new Date(),
      consolidationSequence: consolidationSeq,
    });

    // Marcar todas las cuentas originales (aplanadas) como fusionadas hacia la nueva.
    await this.accountReceivableModel.updateMany(
      { _id: { $in: uniqueAccountIds } },
      {
        isMerged: true,
        mergedIntoId: consolidatedAccount._id.toString(),
      },
    );

    // Eliminar consolidadas intermedias — son redundantes ya que su contenido
    // migro a la nueva consolidada.
    if (intermediatesToDelete.length > 0) {
      await this.accountReceivableModel.deleteMany({
        _id: { $in: intermediatesToDelete },
      });
    }

    const obj = consolidatedAccount.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async unmergeAccounts(unmergeAccountDto: UnmergeAccountDto) {
    const consolidatedAccount = await this.accountReceivableModel
      .findOne({ _id: unmergeAccountDto.accountId })
      .lean()
      .exec();

    if (!consolidatedAccount) {
      throw new NotFoundException(
        `Cuenta consolidada con id ${unmergeAccountDto.accountId} no encontrada`,
      );
    }

    if (!consolidatedAccount.isConsolidated) {
      throw new BadRequestException('Esta cuenta no es una cuenta consolidada');
    }

    const mergedIds = consolidatedAccount.mergedAccountIds || [];

    await this.accountReceivableModel.updateMany(
      { _id: { $in: mergedIds } },
      {
        isMerged: false,
        mergedIntoId: null,
      },
    );

    await this.accountReceivableModel.deleteOne({
      _id: consolidatedAccount._id,
    });

    return { message: 'Consolidación revertida exitosamente' };
  }

  // Recalcula el monto de una cuenta (consolidada o individual) desde sus
  // ordenes. Reparacion deliberada: exige que TODAS las ordenes existan para no
  // bajar la deuda por una orden borrada. Devuelve el antes/despues para auditar.
  async recomputeAmount(id: string) {
    const account = await this.accountReceivableModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!account) {
      throw new NotFoundException(
        `Cuenta por cobrar con id ${id} no encontrada`,
      );
    }

    const orderIds = account.mergedOrderIds?.length
      ? account.mergedOrderIds.filter(Boolean)
      : account.orderId
        ? [account.orderId]
        : [];

    if (orderIds.length === 0) {
      throw new BadRequestException(
        'La cuenta no tiene ordenes asociadas para recalcular',
      );
    }

    const totals = await this.sumOrderTotals(orderIds);
    if (totals.ordersFound !== totals.ordersExpected) {
      throw new BadRequestException(
        `No se puede recalcular: faltan ${
          totals.ordersExpected - totals.ordersFound
        } de ${totals.ordersExpected} ordenes`,
      );
    }

    const previousAmount = account.amount;
    const updated = await this.accountReceivableModel
      .findOneAndUpdate({ _id: id }, { amount: totals.total }, { new: true })
      .lean()
      .exec();

    return {
      ...updated,
      id: updated?._id,
      previousAmount,
      amount: totals.total,
      breakdown: {
        subtotal: totals.subtotal,
        serviceCharge: totals.serviceCharge,
        tax: totals.tax,
        tip: totals.tip,
        total: totals.total,
      },
    };
  }

  /**
   * Anula una cuenta. Si es una CONSOLIDADA, libera antes a sus hijas.
   *
   * Sin esto las hijas quedaban marcadas "ya estoy dentro de una consolidada"
   * apuntando a una madre anulada que ya no cobra nada: la deuda desaparecia
   * de la pagina de cuentas por cobrar, de la nomina y de los avisos, aunque
   * la orden siguiera sin pagar. Se detectaron 12 casos asi en produccion.
   */
  async softDelete(id: string) {
    const account = await this.accountReceivableModel
      .findOneAndUpdate({ _id: id }, { status: 'cancelled' }, { new: true })
      .lean()
      .exec();

    if (!account) {
      throw new NotFoundException(
        `Cuenta por cobrar con id ${id} no encontrada`,
      );
    }

    if (account.isConsolidated) {
      const released = await this.releaseChildren(account);
      if (released > 0) {
        this.logger.log(
          `Consolidada ${account.invoiceNumber} anulada: ${released} cuenta(s) liberadas para que su deuda siga visible`,
        );
      }
    }

    return { ...account, id: account._id };
  }

  /**
   * Devuelve las hijas de una consolidada al estado de cuenta independiente.
   *
   * Se buscan por DOS vias porque en los datos viejos (feb-may 2026, etapa
   * Firebase) `mergedIntoId` guardo el documento entero de la madre en vez de
   * su id: buscar solo por ese campo dejaria fuera a esas cuentas.
   */
  private async releaseChildren(account: {
    _id: unknown;
    mergedAccountIds?: string[] | null;
  }): Promise<number> {
    const parentId = String(account._id);
    const ids = (account.mergedAccountIds ?? []).filter(Boolean);

    const result = await this.accountReceivableModel.updateMany(
      {
        $or: [
          ...(ids.length ? [{ _id: { $in: ids } }] : []),
          { mergedIntoId: parentId },
        ],
        isMerged: true,
      },
      { isMerged: false, mergedIntoId: null },
    );

    return result.modifiedCount ?? 0;
  }
}

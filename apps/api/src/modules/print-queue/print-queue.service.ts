import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PrintJob,
  PrintJobDocument,
  PrintJobStatus,
  PrintJobType,
  PrintStation,
} from './schemas/print-job.schema';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { UpdatePrintJobStatusDto } from './dto/update-print-job-status.dto';
import { ReportIncidentDto } from './dto/report-incident.dto';
import { PrintGateway } from '../websockets/gateways/print.gateway';
import { PrintAlertsService } from './print-alerts.service';
import {
  OrdersService,
  FichaItemView,
  FichaView,
} from '../orders/orders.service';
import { verifyFichaToken } from '../orders/ficha-token.util';
import {
  idsDeIngredientesQuitados,
  nombrarIngredientesQuitados,
} from './ingredientes-quitados.util';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { ConfigsService } from '../configs/configs.service';
import { moduloActivo } from '../../common/modulos/modulo-activo';
import { diaMesAnio, horaMinuto } from '../../common/operacion/operacion.util';
import { completarCabeceraTicket } from './ticket-cabecera.util';

// Estaciones con control estricto: cada una entrega escaneando SU ficha.
// Debe coincidir con CONTROLLED_STATIONS de orders.service.
const ESTACIONES_CON_FICHA: readonly string[] = [
  PrintStation.BAR,
  PrintStation.KITCHEN,
  PrintStation.PIZZA,
];

// Ventana de dedupe: si ya se creó una ficha para la orden hace menos de esto,
// no se crea otra. Cubre el cruce cliente-nuevo (encola su ficha) + garantía
// del servidor (repone ficha al ver la comanda): ambos pasan por create().
const FICHA_DEDUPE_MS = 60_000;

// Item de ficha tal como lo espera el print-service (buildFicha).
interface ItemFichaImpresa {
  productName: string;
  pendingQty: number;
  variants: { name: string; pendingQty: number }[];
}

// Un job que se queda en 'processing' no lo reintenta nadie: el print-service
// solo pide los 'pending'. Al 16/08/2026 habia 6 trabados, el mas viejo desde
// hacia 36 horas. Pasado este tiempo ya esta fuera de la ventana imprimible
// (el listener descarta lo que pase de 10 min), asi que se cierra como fallido
// para que dispare la alerta y quede constancia.
const PROCESSING_TRABADO_MS = 10 * 60 * 1000;
const REVISION_TRABADOS_MS = 5 * 60 * 1000;

@Injectable()
export class PrintQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrintQueueService.name);
  private revisorTrabados?: ReturnType<typeof setInterval>;

  constructor(
    @InjectModel(PrintJob.name) private printJobModel: Model<PrintJobDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly printGateway: PrintGateway,
    private readonly printAlerts: PrintAlertsService,
    private readonly ordersService: OrdersService,
    private readonly configs: ConfigsService,
  ) {}

  onModuleInit(): void {
    this.revisorTrabados = setInterval(() => {
      void this.cerrarTrabados();
    }, REVISION_TRABADOS_MS);
    // unref: este intervalo no debe impedir que el proceso termine.
    this.revisorTrabados.unref?.();
  }

  onModuleDestroy(): void {
    if (this.revisorTrabados) clearInterval(this.revisorTrabados);
  }

  /**
   * Cierra los jobs que quedaron colgados en 'processing'.
   *
   * NO se reencolan a 'pending' a proposito: si el ticket si salio y lo que
   * fallo fue el PATCH de confirmacion, reencolarlo imprimiria dos veces; y si
   * no salio, ya paso la ventana de 10 min y saldria una comanda vieja de una
   * mesa que se fue. Se cierran como fallidos para que quede el rastro y suene
   * la alerta.
   */
  private async cerrarTrabados(): Promise<void> {
    const limite = new Date(Date.now() - PROCESSING_TRABADO_MS);
    try {
      const trabados = await this.printJobModel
        .find({ status: PrintJobStatus.PROCESSING, updatedAt: { $lt: limite } })
        .lean()
        .exec();
      if (trabados.length === 0) return;

      const ids = trabados.map((j) => j._id);
      await this.printJobModel
        .updateMany(
          { _id: { $in: ids } },
          {
            status: PrintJobStatus.FAILED,
            errorMessage:
              'Trabado en processing mas de 10 min: el print-service nunca confirmo si salio',
          },
        )
        .exec();

      this.logger.warn(
        `[PrintQueue] ${trabados.length} job(s) cerrados por quedar trabados en processing: ${ids.join(', ')}`,
      );
      this.printAlerts.notifyFailure(
        trabados[0],
        `${trabados.length} trabajo(s) quedaron trabados en processing y se cerraron como fallidos`,
      );
    } catch (error) {
      this.logger.error(
        `[PrintQueue] fallo revisando trabados: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Registra un incidente de la PC de la caja y dispara la alerta.
   * Lo llaman el watchdog (purgas, impresora irrecuperable) y el print-service
   * (desvios a la impresora de respaldo, tickets sin salida).
   */
  reportIncident(incidente: ReportIncidentDto): { registrado: true } {
    this.logger.warn(
      `[PrintQueue] incidente '${incidente.tipo}' en ${incidente.impresora}` +
        (incidente.destino ? ` -> desviado a ${incidente.destino}` : '') +
        (incidente.motivo ? ` | ${incidente.motivo}` : '') +
        (incidente.trabajos?.length
          ? ` | ${incidente.trabajos.length} ticket(s) botados`
          : ''),
    );
    this.printAlerts.notifyIncident(incidente);
    return { registrado: true };
  }

  async create(entrada: CreatePrintJobDto) {
    const createPrintJobDto = await this.completarTicket(entrada);
    // Fichas de barra (QR de entrega): con el módulo `barTokens` apagado no se reserva ni imprime ninguna.
    if (
      createPrintJobDto.type === PrintJobType.FICHA &&
      !(await moduloActivo(this.configs, 'barTokens'))
    ) {
      return null;
    }
    // Una ficha que llega sin estacion trae mezclados los items de barra,
    // cocina y pizza, y termina saliendo por UNA sola impresora. Se parte aqui
    // (en el servidor) y no en la app: asi funciona con las APKs ya instaladas,
    // que tardan semanas en actualizarse en los telefonos del personal.
    if (createPrintJobDto.type === PrintJobType.FICHA) {
      const r = await this.crearFichasPorEstacion(createPrintJobDto);
      // `manejado` = el token era valido y este camino decidio que salga (o que
      // NO salga, si otra llamada ya creo ese papel hace segundos). Solo se
      // cae al ticket sin partir cuando la ficha no se pudo interpretar.
      if (r.manejado) return r.trabajo ?? null;
      return this.crearTrabajo(createPrintJobDto);
    }

    const creado = await this.crearTrabajo(createPrintJobDto);

    // Garantia server-side: toda comanda con items de estaciones controladas
    // sale acompañada de su ficha con QR, la haya encolado el cliente o no.
    // Cubre los caminos que las APKs viejas no cubren (p. ej. agregar items a
    // una orden existente encola comanda pero no ficha). En segundo plano:
    // no retrasa la respuesta de la comanda y un fallo aqui nunca la tumba.
    if (createPrintJobDto.type === PrintJobType.COMANDA) {
      this.reponerFichaParaComanda(createPrintJobDto).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`No se pudo reponer la ficha de la comanda: ${msg}`);
      });
    }
    return creado;
  }

  /**
   * Completa la cabecera de un ticket (receipt, reprint, precuenta) con la configuración del
   * negocio. Lo que el cliente ya manda no se toca. Si no hay payload, sale igual.
   */
  private async completarTicket(
    dto: CreatePrintJobDto,
  ): Promise<CreatePrintJobDto> {
    const esTicket =
      dto.type === PrintJobType.RECEIPT ||
      dto.type === PrintJobType.REPRINT ||
      dto.type === PrintJobType.PRECUENTA;
    if (!esTicket || !dto.payload) return dto;

    const [negocio, marca, tarifas, operacion] = await Promise.all([
      this.configs.obtener('negocio'),
      this.configs.obtener('marca'),
      this.configs.obtener('tarifas'),
      this.configs.obtener('operacion'),
    ]);
    return {
      ...dto,
      payload: completarCabeceraTicket(
        dto.payload,
        { negocio, marca, tarifas, operacion },
        new Date(),
      ),
    };
  }

  /** Fichas ya reservadas por orden+estacion, con el momento de la reserva. */
  private readonly fichasEnVuelo = new Map<string, number>();

  /** Suelta las reservas que ya salieron de la ventana, para no crecer sin fin. */
  private limpiarFichasEnVuelo(ahora: number): void {
    for (const [k, t] of this.fichasEnVuelo) {
      if (ahora - t > FICHA_DEDUPE_MS) this.fichasEnVuelo.delete(k);
    }
  }

  /**
   * Crea la ficha de una estacion SOLO si no hay otra reciente para esa misma
   * orden y estacion. Devuelve null si ya existia.
   *
   * El chequeo previo con una consulta aparte no alcanzaba: la app encola su
   * ficha y el servidor repone la suya en el mismo segundo, los dos consultan
   * antes de que el otro escriba, y los dos crean. El 28/08 la barra recibio
   * seis papeles identicos de una orden. Aqui la comprobacion y la insercion
   * son UNA sola operacion atomica de Mongo.
   */
  private async crearFichaSiNoExiste(
    orderId: string,
    estacion: string,
    dto: Record<string, unknown>,
  ) {
    const ahora = Date.now();
    const desde = new Date(ahora - FICHA_DEDUPE_MS);

    // Candado en memoria. Es lo unico que frena de verdad la carrera: el
    // upsert de Mongo solo garantiza unicidad si hay un indice unico, y aqui
    // no lo hay (una orden SI puede recibir otra ficha de barra mas tarde, al
    // agregarle bebidas). Node es monohilo, asi que reservar la clave ANTES
    // del primer await deja fuera a la llamada gemela.
    const clave = `${orderId}::${estacion}`;
    const reservado = this.fichasEnVuelo.get(clave);
    if (reservado && ahora - reservado < FICHA_DEDUPE_MS) return null;
    this.fichasEnVuelo.set(clave, ahora);
    this.limpiarFichasEnVuelo(ahora);

    // Respaldo en base de datos: cubre el reinicio del proceso, donde el
    // candado en memoria se pierde.
    const previo = await this.printJobModel
      .findOne({
        type: PrintJobType.FICHA,
        orderId,
        station: estacion,
        createdAt: { $gte: desde },
      })
      .lean()
      .exec();

    if (previo) return null;

    // Se reutiliza el camino de siempre: crea, serializa y avisa por WebSocket.
    return this.crearTrabajo(dto);
  }

  private async crearTrabajo(dto: CreatePrintJobDto | Record<string, unknown>) {
    const conNombres = await this.traducirIngredientesQuitados(dto);
    const printJob = await this.printJobModel.create(conNombres);
    const obj = printJob.toObject();
    const serialized = { ...obj, id: String(obj._id) };
    // Notifica a los print-services conectados por WebSocket
    this.printGateway.emitNewJob(serialized);
    return serialized;
  }

  /**
   * Los ingredientes quitados viajan como IDS de producto (asi los guarda la
   * app: `ProductCustomizationModal` mete `ingredient.id`). La pantalla del
   * POS los traduce antes de mostrarlos, pero el armador de la comanda los
   * copia tal cual, y el ticket salia con `*** SIN YEDEMRXYS1BXUUN7NW5G ***`.
   *
   * Se traduce aqui, en el servidor, por la misma razon por la que aqui se
   * parten las fichas por estacion: funciona con las APKs ya instaladas, que
   * tardan semanas en actualizarse en los telefonos del personal.
   *
   * Si la consulta al catalogo falla, se imprime lo que vino: un id en el
   * papel es feo, pero perder el aviso de "sin cebolla" es un plato mal hecho.
   */
  private async traducirIngredientesQuitados(
    dto: CreatePrintJobDto | Record<string, unknown>,
  ): Promise<CreatePrintJobDto | Record<string, unknown>> {
    const payload = (dto as { payload?: Record<string, unknown> }).payload;
    const items = payload?.items;
    if (!Array.isArray(items)) return dto;

    const ids = idsDeIngredientesQuitados(items);
    if (ids.length === 0) return dto;

    try {
      const productos = await this.productModel
        .find({ _id: { $in: ids } }, { name: 1 })
        .lean()
        .exec();
      const nombrePorId = new Map<string, string>(
        productos.map((p) => [String(p._id), String(p.name ?? '')]),
      );
      return {
        ...dto,
        payload: {
          ...payload,
          items: nombrarIngredientesQuitados(items, nombrePorId),
        },
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `[comanda] no se pudieron resolver los nombres de ingredientes quitados (${ids.length} ids): ${msg}`,
      );
      return dto;
    }
  }

  // Ficha creada para esta orden hace menos de FICHA_DEDUPE_MS, o null.
  private async fichaRecienteParaOrden(orderId: string) {
    return this.printJobModel
      .findOne({
        type: PrintJobType.FICHA,
        orderId,
        createdAt: { $gte: new Date(Date.now() - FICHA_DEDUPE_MS) },
      })
      .lean()
      .exec();
  }

  // Nucleo compartido: agrupa los items de la ficha por estacion controlada y
  // crea UN trabajo por estacion, cada uno con su QR y solo sus productos.
  // Devuelve los trabajos creados o null si la orden no tiene items de
  // estaciones controladas (nada que escanear).
  private async crearFichasDesdeVista(
    ficha: FichaView,
    basePayload: Record<string, unknown>,
    dtoBase: Partial<CreatePrintJobDto>,
    // Estaciones a imprimir. `null` = todas las que tengan pendientes (es lo
    // que necesita la ficha que encola el cliente al crear la orden). Con una
    // lista, solo esas: sirve para no reimprimirle a una estacion algo que ya
    // tiene en la mano. Ver reponerFichaParaComanda.
    soloEstaciones: readonly string[] | null = null,
    // Nombres de producto que trae ESTA comanda. Con la lista, el ticket
    // muestra solo lo recien pedido; sin ella (ficha del cliente al crear la
    // orden) muestra todo lo pendiente.
    soloProductos: readonly string[] | null = null,
  ) {
    const normalizar = (t: string) =>
      t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
    const pedidosAhora = soloProductos
      ? new Set(soloProductos.map(normalizar))
      : null;
    const porEstacion = new Map<string, ItemFichaImpresa[]>();
    for (const it of ficha.items as FichaItemView[]) {
      const estacion = String(it.station ?? PrintStation.BAR).toUpperCase();
      if (!ESTACIONES_CON_FICHA.includes(estacion)) continue;
      if (soloEstaciones && !soloEstaciones.includes(estacion)) continue;
      const lista = porEstacion.get(estacion) ?? [];
      lista.push({
        productName: it.productName,
        pendingQty: it.pendingQty,
        variants: (it.composition ?? []).map((v) => ({
          name: v.variantName,
          pendingQty: v.pendingQty,
        })),
      });
      porEstacion.set(estacion, lista);
    }

    // Se deja solo lo que vino en la comanda. Si por alguna diferencia de
    // nombre no coincide nada, se manda la estacion completa: mas vale un
    // ticket con algo de mas que una estacion sin papel.
    if (pedidosAhora) {
      for (const [estacion, lista] of porEstacion) {
        const recien = lista.filter((it) =>
          pedidosAhora.has(normalizar(it.productName)),
        );
        if (recien.length) porEstacion.set(estacion, recien);
      }
    }

    if (porEstacion.size === 0) return null;

    const creados: Record<string, unknown>[] = [];
    const repetidas: string[] = [];
    for (const [estacion, itemsEstacion] of porEstacion) {
      const total = itemsEstacion.reduce((s, it) => s + it.pendingQty, 0);
      const trabajo = await this.crearFichaSiNoExiste(ficha.orderId, estacion, {
        ...dtoBase,
        type: PrintJobType.FICHA,
        orderId: ficha.orderId,
        station: estacion as PrintStation,
        payload: {
          ...basePayload,
          qrData: ficha.fichaToken,
          station: estacion,
          items: itemsEstacion,
          totalPending: total,
        },
      });
      if (trabajo) creados.push(trabajo);
      else repetidas.push(estacion);
    }

    if (repetidas.length) {
      this.logger.log(
        `Ficha de ${ficha.orderId}: ${repetidas.join(', ')} ya tenia una reciente, no se duplica el papel`,
      );
    }
    if (!creados.length) return null;

    this.logger.log(
      `Ficha de la orden ${ficha.orderId} partida en ${creados.length} estacion(es): ${creados.map((c) => String((c as { station?: string }).station)).join(', ')}`,
    );
    return creados;
  }

  // Camino del cliente: llega un job 'ficha' con el token en payload.qrData.
  // Devuelve el primer trabajo creado (para no cambiarle la forma a la
  // respuesta que ya consumen los clientes) o null si no se pudo partir, en
  // cuyo caso el llamador crea el trabajo unico de siempre.
  private async crearFichasPorEstacion(
    dto: CreatePrintJobDto,
  ): Promise<{ manejado: boolean; trabajo?: Record<string, unknown> | null }> {
    const payload = dto.payload;
    const token = typeof payload?.qrData === 'string' ? payload.qrData : null;
    if (!payload || !token) return { manejado: false };

    const secreto = process.env.FICHA_SECRET || 'dev-ficha-secret-change-me';
    const partes = verifyFichaToken(token, secreto);
    if (!partes) {
      this.logger.warn('Ficha con token invalido: se imprime sin partir');
      return { manejado: false };
    }

    // Si el servidor ya repuso la ficha al ver la comanda (o llego otra copia
    // hace segundos), no duplicar el papel en la estacion.
    const reciente = await this.fichaRecienteParaOrden(partes.orderId);
    if (reciente) {
      this.logger.log(
        `Ficha de ${partes.orderId} ya creada hace <${FICHA_DEDUPE_MS / 1000}s: no se duplica`,
      );
      return {
        manejado: true,
        trabajo: { ...reciente, id: String(reciente._id) },
      };
    }

    let ficha: FichaView;
    try {
      ficha = await this.ordersService.getFichaByOrderId(partes.orderId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(`No se pudo leer la ficha ${partes.orderId}: ${msg}`);
      return { manejado: false };
    }

    const creados = await this.crearFichasDesdeVista(ficha, payload, dto);
    // Token valido: aunque no se haya creado nada (ya existia el papel o no
    // queda pendiente), NO se imprime el ticket sin partir.
    return { manejado: true, trabajo: creados ? creados[0] : null };
  }

  // Camino del servidor: llega una comanda y se repone su ficha si el cliente
  // no la encolo. Resuelve la orden por dto.orderId o, como los clientes
  // actuales no lo mandan, por el sufijo payload.orderNumber (ultimos 8 chars
  // del _id). Con dedupe para no duplicar cuando el cliente SI la encola.
  private async reponerFichaParaComanda(dto: CreatePrintJobDto): Promise<void> {
    if (!(await moduloActivo(this.configs, 'barTokens'))) return;
    const payload = dto.payload ?? {};
    const items = Array.isArray(payload.items)
      ? (payload.items as Array<{ station?: string | null }>)
      : [];
    // Estaciones que vienen EN ESTA comanda. Solo a ellas se les imprime
    // ficha: si el mesonero agrega una hamburguesa a una orden que ya tenia un
    // refresco sin entregar, la barra recibia un segundo ticket con el mismo
    // refresco y terminaba con dos papeles para una sola bebida. El QR es de
    // la ORDEN, asi que la ficha que la barra ya tiene sigue mostrando todo lo
    // pendiente al escanearla: no pierde nada por no recibir el duplicado.
    const estacionesDeLaComanda = [
      ...new Set(
        items
          .map((i) => String(i?.station ?? '').toUpperCase())
          .filter((e) => ESTACIONES_CON_FICHA.includes(e)),
      ),
    ];
    // Nombres de lo que trae esta comanda: el ticket sale con eso y no con
    // todo lo que la estacion tenga pendiente. Antes, al agregar una bebida a
    // una mesa que ya tenia otra sin entregar, la barra recibia un papel con
    // las dos y parecian dos pedidos distintos.
    const productosDeLaComanda = items
      .map((i) => String((i as { name?: string }).name ?? ''))
      .filter(Boolean);
    if (estacionesDeLaComanda.length === 0) return;

    let orderId = dto.orderId ?? null;
    if (!orderId) {
      const sufijo =
        typeof payload.orderNumber === 'string' ? payload.orderNumber : '';
      orderId = await this.ordersService.findRecentOrderIdBySuffix(sufijo);
    }
    if (!orderId) {
      this.logger.warn(
        `Comanda sin orden resoluble (orderNumber=${String(payload.orderNumber ?? '?')}): no se repone la ficha`,
      );
      return;
    }

    const reciente = await this.fichaRecienteParaOrden(orderId);
    if (reciente) return; // el cliente (u otra comanda) ya la encolo

    let ficha: FichaView;
    try {
      ficha = await this.ordersService.getFichaByOrderId(orderId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(`No se pudo leer la ficha de ${orderId}: ${msg}`);
      return;
    }

    // Fecha/hora en la zona de la operacion (configs/operacion): el VPS corre
    // en otra zona horaria y el ticket sale con la hora del local.
    const ahora = new Date();
    const operacion = await this.configs.obtener('operacion');
    const basePayload: Record<string, unknown> = {
      orderNumber: ficha.orderNumber,
      date: diaMesAnio(ahora, operacion.timezone),
      time: horaMinuto(ahora, operacion.timezone),
      table: ficha.tableName ?? ficha.sector ?? undefined,
      waiter: ficha.waiterName ?? undefined,
    };
    const creados = await this.crearFichasDesdeVista(
      ficha,
      basePayload,
      {
        userId: dto.userId,
        waiterId: dto.waiterId,
        waiterName: dto.waiterName,
        tableId: dto.tableId,
        tableName: dto.tableName,
        sector: dto.sector,
      },
      estacionesDeLaComanda,
      productosDeLaComanda.length ? productosDeLaComanda : null,
    );
    if (creados) {
      this.logger.log(
        `Ficha repuesta para la orden ${orderId} en ${estacionesDeLaComanda.join(', ')} ` +
          `(solo las estaciones de esta comanda, para no duplicarle el ticket a las demas)`,
      );
    }
  }

  async findAll() {
    const printJobs = await this.printJobModel.find().lean().exec();
    return printJobs.map((job) => ({ ...job, id: job._id }));
  }

  async findPending() {
    const printJobs = await this.printJobModel
      .find({ status: PrintJobStatus.PENDING })
      .lean()
      .exec();
    return printJobs.map((job) => ({ ...job, id: job._id }));
  }

  async findById(id: string) {
    const printJob = await this.printJobModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!printJob) {
      throw new NotFoundException(`Print job with id ${id} not found`);
    }
    return { ...printJob, id: printJob._id };
  }

  async updateStatus(id: string, updateDto: UpdatePrintJobStatusDto) {
    const printJob = await this.printJobModel
      .findOneAndUpdate({ _id: id }, updateDto, { new: true })
      .lean()
      .exec();

    if (!printJob) {
      throw new NotFoundException(`Print job with id ${id} not found`);
    }

    const serialized = { ...printJob, id: printJob._id };
    this.printGateway.emitStatusChanged(serialized);

    if (updateDto.status === PrintJobStatus.FAILED) {
      this.printAlerts.notifyFailure(printJob, updateDto.errorMessage);
    }

    return serialized;
  }
}

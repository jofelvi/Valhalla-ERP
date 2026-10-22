import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrintLog, PrintLogDocument } from './schemas/print-log.schema';
import { CreatePrintLogDto } from './dto/create-print-log.dto';
import { paginar } from '../../common/paginacion.util';

/**
 * Es un log de diagnostico: se mira lo ultimo, no el historico. 200 cubre
 * varios dias de servicio; el techo esta para que ni pidiendolo a mano se
 * pueda arrastrar la coleccion entera.
 */
export const TOPE_DE_PRINT_LOGS = { defecto: 200, duro: 1000 };

@Injectable()
export class PrintLogsService {
  constructor(
    @InjectModel(PrintLog.name) private printLogModel: Model<PrintLogDocument>,
  ) {}

  async create(createPrintLogDto: CreatePrintLogDto) {
    const printLog = await this.printLogModel.create(createPrintLogDto);
    const obj = printLog.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findByOrderId(orderId: string) {
    const printLogs = await this.printLogModel
      .find({ orderId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return printLogs.map((log) => ({ ...log, id: log._id }));
  }

  /**
   * El log de intentos de impresion, acotado.
   *
   * Medido en PRE el 22/09/2026: **1.588 filas, 1.593.579 bytes, 2,2 s** sin
   * un solo parametro. El 23% de ese peso es el campo `items` —las lineas de
   * la comanda, repetidas en cada intento— y otro 7% el `requestHash`.
   *
   * Nadie en la web pide esto sin filtro: la unica pantalla que lo lee es el
   * detalle de orden, y pasa `orderId`. O sea que el 1,59 MB solo sale si
   * alguien llama al endpoint a mano. Se acota igual: un log de diagnostico
   * que crece sin techo es una bomba de tiempo, no un caso hipotetico — es
   * exactamente como `/api/orders` llego a los 2,3 MB.
   */
  async findAll(limit?: string, page?: string) {
    const paginacion = paginar(limit, page, TOPE_DE_PRINT_LOGS);
    const printLogs = await this.printLogModel
      .find()
      .sort({ createdAt: -1 })
      .skip(paginacion.skip)
      .limit(paginacion.limit)
      .lean()
      .exec();
    return printLogs.map((log) => ({ ...log, id: log._id }));
  }

  async findById(id: string) {
    const printLog = await this.printLogModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!printLog) {
      throw new NotFoundException(`Print log with id ${id} not found`);
    }
    return { ...printLog, id: printLog._id };
  }
}

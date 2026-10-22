import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigsService } from '../configs/configs.service';
import { Order } from '../orders/schemas/order.schema';
import { Product } from '../products/schemas/product.schema';
import {
  calcularBonoPizzero,
  PATRON_EXCLUIDOS_POR_DEFECTO,
  ResultadoBono,
  TARIFAS_POR_DEFECTO,
  TarifasBono,
} from './pizza-bonus.helper';

/**
 * Bono del pizzero de un rango de fechas.
 *
 * Existe para que la pantalla de nómina pueda PRECARGARLO en vez de que el
 * dueño lo copie a mano del correo del lunes: copiar a mano es cómo se termina
 * pagando un número distinto al que se le avisó al pizzero.
 *
 * Las tarifas siguen viniendo de Mongo (`configs/pizza_bonus`) para poder
 * cambiarlas sin redeploy, igual que el cron.
 */
@Injectable()
export class PizzaBonusService {
  private readonly logger = new Logger(PizzaBonusService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly configs: ConfigsService,
  ) {}

  /** Tarifas y exclusiones vigentes (`configs/pizza_bonus`), con defaults. */
  private async cargarConfig(): Promise<{
    tarifas: TarifasBono;
    excluidos: RegExp;
    habilitado: boolean;
  }> {
    // Sin config no se cae: se usan los defaults, que son los mismos del cron.
    return this.configs.obtenerCrudo('pizza_bonus', (doc) => {
      const rates = (doc?.rates ?? {}) as Partial<TarifasBono>;
      const patron =
        typeof doc?.excludePattern === 'string' ? doc.excludePattern : null;
      let excluidos = PATRON_EXCLUIDOS_POR_DEFECTO;
      try {
        if (patron) excluidos = new RegExp(patron, 'i');
      } catch {
        // Patrón inválido en Mongo: se usa el de por defecto.
      }
      return {
        tarifas: { ...TARIFAS_POR_DEFECTO, ...rates },
        excluidos,
        habilitado: doc?.enabled !== false,
      };
    });
  }

  async calcular(
    desde: Date,
    hasta: Date,
  ): Promise<ResultadoBono & { habilitado: boolean }> {
    const { tarifas, excluidos, habilitado } = await this.cargarConfig();

    const productos = await this.productModel
      .find({ station: 'PIZZA' }, { name: 1 })
      .lean()
      .exec();

    const ordenes = await this.orderModel
      .find(
        {
          createdAt: { $gte: desde, $lt: hasta },
          status: { $ne: 'cancelled' },
          isDeleted: { $ne: true },
        },
        { items: 1 },
      )
      .lean()
      .exec();

    const resultado = calcularBonoPizzero(
      ordenes as Array<{ items?: Array<Record<string, unknown>> }>,
      productos.map((p) => ({ id: String(p._id), name: String(p.name ?? '') })),
      tarifas,
      excluidos,
    );

    return { ...resultado, habilitado };
  }
}

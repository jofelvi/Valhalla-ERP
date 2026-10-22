import { ConfigsService } from '../configs/configs.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import {
  MarginAlert,
  MarginAlertDocument,
} from './schemas/margin-alert.schema';
import {
  AlertaMargen,
  CambioDeCosto,
  OmitidoDeCosto,
  ProductoCosteable,
  calcularPropagacion,
  evaluarMargen,
} from './cost-propagation.util';

/** Umbral por defecto: por debajo de esto el margen se considera bajo. */
export const MARGEN_MINIMO_POR_DEFECTO = 30;

export interface ResultadoPropagacion {
  /** Productos cuyo costo cambió por este movimiento. */
  cambios: CambioDeCosto[];
  /** Los que quedaron con margen bajo, nulo o negativo. */
  alertas: AlertaMargen[];
}

export interface OpcionesRecalculo {
  /** Calcula y devuelve el plan SIN guardar nada (ni costos ni alertas). */
  dryRun?: boolean;
  /** Aplica también los cambios sospechosos (por defecto se retienen). */
  forzar?: boolean;
}

export interface ResultadoRecalculo extends ResultadoPropagacion {
  dryRun: boolean;
  /** Cambios sospechosos que NO se aplicaron: hay que mirar el dato primero. */
  retenidos: CambioDeCosto[];
  /** Platos que no se pudieron costear y por qué (antes, silencio). */
  omitidos: OmitidoDeCosto[];
}

/**
 * COSTO Y MARGEN EN VIVO.
 *
 * Cuando sube el precio de un insumo (una compra, o un cambio a mano en la
 * ficha), sube el costo de todo lo que lo lleva — y si el precio de venta no se
 * mueve, el margen se come solo. Hasta ahora eso no lo veía nadie: el costo de
 * un preparado solo se recalculaba al guardar su receta, y el recálculo masivo
 * vivía en el navegador disparado por un cambio de PRECIO, no de costo.
 *
 * Este servicio hace las dos cosas juntas y del lado del servidor, para que dé
 * igual si la compra entró por la web o por el teléfono.
 */
@Injectable()
export class CostPropagationService {
  private readonly logger = new Logger('CostoYMargen');

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(MarginAlert.name)
    private readonly alertModel: Model<MarginAlertDocument>,
    private readonly configs: ConfigsService,
  ) {}

  /** Umbral del negocio, editable en `configs/margen_minimo` sin desplegar. */
  async umbralMargen(): Promise<number> {
    return this.configs.obtenerCrudo('margen_minimo', (doc) => {
      const v = Number(doc?.valor);
      return Number.isFinite(v) && v > 0 ? v : MARGEN_MINIMO_POR_DEFECTO;
    });
  }

  /**
   * Recalcula el costo de todo lo que usa estos insumos y revisa sus márgenes.
   *
   * Nunca lanza: un fallo aquí no puede tumbar la compra que lo disparó — el
   * dinero y el stock ya se movieron y son lo importante.
   */
  async propagarCosto(
    insumoIds: string[],
    causa: 'compra' | 'precio' | 'receta' | 'revision' = 'compra',
  ): Promise<ResultadoPropagacion> {
    const vacio: ResultadoPropagacion = { cambios: [], alertas: [] };
    if (!insumoIds.length) return vacio;

    try {
      // El catálogo entero: las recetas encadenan (harina → masa → pizza) y
      // acotar la consulta a "los que usan el insumo" perdería el segundo nivel.
      const productos = (await this.productModel
        .find({ isActive: { $ne: false } })
        .lean()
        .exec()) as unknown as ProductoCosteable[];
      const catalogo = new Map(productos.map((p) => [String(p._id), p]));

      const cambios = calcularPropagacion(insumoIds.map(String), catalogo);
      for (const c of cambios) {
        await this.productModel
          .updateOne(
            { _id: c.productId },
            { $set: { cost: c.costoNuevo, costUpdatedAt: new Date() } },
          )
          .exec();
      }
      if (cambios.length) {
        this.logger.log(
          `${cambios.length} producto(s) recalculados por ${causa}: ` +
            cambios
              .slice(0, 5)
              .map((c) => `${c.name} ${c.costoAnterior}→${c.costoNuevo}`)
              .join(', '),
        );
      }

      // Se revisan los recalculados Y los propios insumos comprados: un insumo
      // que también se vende (una lata) puede quedar por debajo del costo.
      const aRevisar = new Set<string>([
        ...cambios.map((c) => c.productId),
        ...insumoIds.map(String),
      ]);
      const alertas = await this.revisarMargenes(
        Array.from(aRevisar)
          .map((id) => catalogo.get(id))
          .filter((p): p is ProductoCosteable => !!p),
        causa,
        insumoIds[0],
      );

      return { cambios, alertas };
    } catch (err) {
      this.logger.error(
        `fallo propagando costo (${causa}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return vacio;
    }
  }

  /**
   * Levanta o resuelve la alerta de margen de cada producto.
   *
   * Solo los vendibles: el ketchup no tiene margen que vigilar. Y solo los que
   * tienen precio y costo cargados — sin costo no se sabe el margen, y avisar
   * por eso taparía las alertas de verdad.
   */
  async revisarMargenes(
    productos: ProductoCosteable[],
    causa: AlertaMargen extends never ? never : string,
    insumoId?: string,
  ): Promise<AlertaMargen[]> {
    const umbral = await this.umbralMargen();
    const insumo = insumoId
      ? await this.productModel.findOne({ _id: insumoId }, { name: 1 }).lean()
      : null;

    const alertas: AlertaMargen[] = [];
    for (const p of productos) {
      if (p.isForSale === false) continue;
      const alerta = evaluarMargen(p, umbral);

      if (!alerta) {
        // Volvió a estar sano: se cierra la alerta si estaba abierta.
        await this.alertModel
          .updateOne(
            { productId: String(p._id), resueltaEn: null },
            { $set: { resueltaEn: new Date() } },
          )
          .exec();
        continue;
      }

      alertas.push(alerta);
      await this.alertModel
        .updateOne(
          { productId: alerta.productId },
          {
            $set: {
              ...alerta,
              causa,
              insumoId: insumoId ?? undefined,
              insumoName: insumo?.name ?? undefined,
              resueltaEn: null,
            },
            $setOnInsert: { desde: new Date() },
          },
          { upsert: true },
        )
        .exec();
    }

    if (alertas.length) {
      this.logger.warn(
        `MARGEN EN RIESGO (${causa}): ` +
          alertas
            .map((a) => `${a.name} ${a.marginPct}% [${a.nivel}]`)
            .join(' · '),
      );
    }
    return alertas;
  }

  /** Alertas abiertas, de la más grave a la menos. Para el panel y la campana. */
  async listarAbiertas(): Promise<AlertaMargen[]> {
    const orden = { NEGATIVO: 0, NULO: 1, BAJO: 2 } as Record<string, number>;
    const docs = await this.alertModel.find({ resueltaEn: null }).lean().exec();
    return (docs as unknown as AlertaMargen[]).sort(
      (a, b) =>
        (orden[a.nivel] ?? 9) - (orden[b.nivel] ?? 9) ||
        a.marginPct - b.marginPct,
    );
  }

  /**
   * Recalcula el costo de TODOS los preparados y revisa los márgenes.
   *
   * Es la foto inicial al desplegar y el "Recalcular costos" de la web. Se
   * llama recalcular y recalcula: la primera versión solo revisaba márgenes
   * contra los costos guardados, así que un costo viejo se quedaba viejo y la
   * pantalla decía "listo" sin haber tocado nada (lo cazó la batería E2E el
   * 04/09).
   *
   * El frente de la propagación son todos los productos que aparecen como
   * ingrediente de alguien: desde ahí la cascada sube sola por los
   * semielaborados hasta los platos.
   */
  async recalcularTodo(
    opciones: OpcionesRecalculo = {},
  ): Promise<ResultadoRecalculo> {
    const dryRun = opciones.dryRun === true;
    const productos = (await this.productModel
      .find({ isActive: { $ne: false } })
      .lean()
      .exec()) as unknown as ProductoCosteable[];
    const catalogo = new Map(productos.map((p) => [String(p._id), p]));

    const insumos = new Set<string>();
    for (const p of productos) {
      for (const ing of p.ingredients ?? []) {
        if (ing?.productId) insumos.add(String(ing.productId));
      }
    }

    // Un costo no baja a la mitad ni se triplica de un día para otro: si el
    // cálculo lo dice, el dato del insumo está mal. Se retiene y se muestra.
    const retenidos: CambioDeCosto[] = [];
    const omitidos: OmitidoDeCosto[] = [];
    const cambios = calcularPropagacion(Array.from(insumos), catalogo, 5, {
      retenerSospechosos: opciones.forzar !== true,
      retenidos,
      omitidos,
    });

    if (!dryRun) {
      for (const c of cambios) {
        await this.productModel
          .updateOne(
            { _id: c.productId },
            { $set: { cost: c.costoNuevo, costUpdatedAt: new Date() } },
          )
          .exec();
      }
    }

    // Se revisan TODOS los vendibles, no solo los que cambiaron: es un repaso
    // completo, y también cierra alertas de productos que ya se arreglaron.
    // En la vista previa no se toca ninguna alerta.
    const vendibles = productos.filter((p) => p.isForSale !== false);
    const alertas = dryRun
      ? []
      : await this.revisarMargenes(vendibles, 'revision');
    this.logger.log(
      `repaso ${dryRun ? '(vista previa) ' : ''}completo: ${cambios.length} costo(s) actualizados, ` +
        `${retenidos.length} retenidos por sospechosos, ${omitidos.length} sin poder costear, ` +
        `${alertas.length} con margen en riesgo`,
    );
    return { cambios, alertas, dryRun, retenidos, omitidos };
  }
}

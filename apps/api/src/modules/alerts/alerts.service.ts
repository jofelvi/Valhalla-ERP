import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  MarginAlert,
  MarginAlertDocument,
} from '../products/schemas/margin-alert.schema';
import { MarginAlertsService } from '../products/margin-alerts.service';
import { AlertaMargen } from '../products/margin-alerts.util';

export type NivelAlerta = 'grave' | 'aviso';

export interface Alerta {
  tipo: 'margen' | 'sin-naturaleza';
  nivel: NivelAlerta;
  titulo: string;
  detalle: string;
  /** A dónde lleva al tocarla. */
  ruta: string;
  cantidad: number;
}

/**
 * Respuesta del endpoint GET /api/alerts.
 *
 * Agrupa alertas por categoría: márgenes en riesgo, productos sin naturaleza,
 * productos agotados (si son baratos).
 */
export interface AlertasResumen {
  margenes: AlertaMargen[];
  pendientes: Array<{
    productId: string;
    name: string;
  }>;
  agotados: unknown[];
}

/**
 * Respuesta legacy para la campana (compatibilidad).
 *
 * Se mantiene para el antiguo formato de campana.
 */
export interface ResumenAlertas {
  /** Productos afectados en total (25 con margen + 101 sin naturaleza = 126). */
  total: number;
  /** Cuántos de los avisos cuestan dinero AHORA (se vende bajo costo). */
  graves: number;
  /** El contador de la campana es `alertas.length`, no `total`. */
  alertas: Alerta[];
}

/**
 * Lo que el dueño debería enterarse HOY, junto.
 *
 * La campana del header llevaba un punto rojo fijo, encendido siempre: decía
 * "hay algo" tanto cuando lo había como cuando no, así que dejó de significar
 * nada. Aquí se junta lo que de verdad cuesta dinero si no se mira:
 *
 *  - productos que se venden por debajo del margen mínimo,
 *  - productos que se venden y NO descuentan nada (nadie decidió qué son).
 */
@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(MarginAlert.name)
    private readonly marginAlertModel: Model<MarginAlertDocument>,
    private readonly marginAlerts: MarginAlertsService,
  ) {}

  /**
   * Resumen estructurado: márgenes + pendientes + agotados.
   *
   * Devuelve alertas categorizadas por tipo.
   */
  async resumen(): Promise<AlertasResumen> {
    const margenes = await this.marginAlerts.listarAbiertas();
    const pendientes = await this.productModel
      .find({
        naturalezaPendiente: true,
        isActive: { $ne: false },
        isForSale: { $ne: false },
      })
      .select(['_id', 'name'])
      .lean()
      .exec();

    return {
      margenes,
      pendientes: (
        pendientes as unknown as Array<{ _id: string; name: string }>
      ).map((p) => ({
        productId: String(p._id),
        name: p.name,
      })),
      agotados: [], // Task 3: agotados se agregan si es barato
    };
  }

  /**
   * Resumen clásico para compatibilidad (campana con formato antiguo).
   *
   * @deprecated Usar `resumen()` en su lugar.
   */
  async resumenLegacy(): Promise<ResumenAlertas> {
    const data = await this.resumen();

    const alertas: Alerta[] = [];

    // ── Márgenes ──
    if (data.margenes.length > 0) {
      const pierden = data.margenes.filter((m) => m.nivel !== 'BAJO');
      alertas.push({
        tipo: 'margen',
        nivel: pierden.length > 0 ? 'grave' : 'aviso',
        titulo:
          pierden.length > 0
            ? `${pierden.length} producto(s) se venden perdiendo plata`
            : `${data.margenes.length} producto(s) con margen bajo`,
        detalle: data.margenes
          .slice(0, 3)
          .map((m) => `${m.name} ${m.marginPct}%`)
          .join(' · '),
        ruta: '/private/products',
        cantidad: data.margenes.length,
      });
    }

    // ── Naturaleza sin decidir ──
    if (data.pendientes.length > 0) {
      alertas.push({
        tipo: 'sin-naturaleza',
        nivel: 'aviso',
        titulo: `${data.pendientes.length} producto(s) se venden sin descontar nada`,
        detalle: 'Falta decir si son insumo, preparado o servicio.',
        ruta: '/private/recipes',
        cantidad: data.pendientes.length,
      });
    }

    return {
      total: alertas.reduce((s, a) => s + a.cantidad, 0),
      graves: alertas.filter((a) => a.nivel === 'grave').length,
      alertas,
    };
  }
}

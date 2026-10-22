import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  WeeklyReport,
  WeeklyReportDocument,
  WeeklyKpis,
  TopVendidoItem,
  LossItem,
} from './schemas/weekly-report.schema';
import {
  InventoryMovement,
  InventoryMovementDocument,
} from './schemas/inventory-movement.schema';
import { Purchase, PurchaseDocument } from './schemas/purchase.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { DeepseekService } from './deepseek.service';
import { weekStartOf } from './units';
import { ConfigsService } from '../configs/configs.service';
import { diaMesAnio, paredEnZona } from '../../common/operacion/operacion.util';
import { OperacionConfig } from '@odin6/types';

/** Hora (0-23, zona del negocio) a partir de la cual se genera el informe del cierre semanal. */
const HORA_CIERRE_INFORME = 23;
import {
  computeTheoreticalUnitCost,
  ProductForRecipeCost,
} from './recipe-cost.helper';
import {
  computeSalesKpi,
  computeProfitabilityKpi,
  computeFoodCostKpi,
  computeLossesKpi,
  computePurchasesKpi,
  computeCoverageKpi,
  assembleWeeklyKpis,
  OrderForKpis,
  MovementForKpis,
  PurchaseForKpis,
  ProductForKpis,
} from './weekly-report-kpis';

/**
 * Interfaz unificada para productos usados en cálculo de KPIs:
 * combina campos de ProductForKpis (para cobertura) y ProductForRecipeCost (para costo).
 */
type ProductForWeeklyReportKpis = ProductForKpis & ProductForRecipeCost;

@Injectable()
export class WeeklyReportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('InventarioKpis');
  private cronInterval: ReturnType<typeof setInterval> | null = null;
  private generationInProgress = new Map<
    number,
    Promise<WeeklyReportDocument>
  >();

  constructor(
    @InjectModel(WeeklyReport.name)
    private reportModel: Model<WeeklyReportDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
    @InjectModel(InventoryMovement.name)
    private movementModel: Model<InventoryMovementDocument>,
    @InjectModel(Purchase.name)
    private purchaseModel: Model<PurchaseDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    private readonly deepseek: DeepseekService,
    private readonly configService: ConfigService,
    private readonly configs: ConfigsService,
  ) {}

  onModuleInit() {
    this.logger.log('Iniciando cron de informe semanal (cada 10 min)');
    this.cronInterval = setInterval(
      () => this.checkAndGenerateIfNeeded(),
      10 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.cronInterval) {
      clearInterval(this.cronInterval);
      this.logger.log('Cron de informe semanal detenido');
    }
  }

  /**
   * Verifica si es domingo ≥ 23:00 VET y genera informe si no existe
   */
  private async checkAndGenerateIfNeeded(): Promise<void> {
    const now = new Date();
    const op = await this.configs.obtener('operacion');
    const vet = paredEnZona(now, op.timezone);
    const diaSemana = new Date(
      Date.UTC(vet.anio, vet.mes - 1, vet.dia),
    ).getUTCDay();
    // Último día de la semana de negocio (si la semana empieza en lunes, es el domingo).
    const ultimoDia = (op.weekStartsOn + 6) % 7;

    if (diaSemana !== ultimoDia || vet.hora < HORA_CIERRE_INFORME) {
      return; // Aún no es el cierre de la semana (último día ≥ 23:00 en la zona del negocio)
    }

    const weekStart = weekStartOf(now, op);
    const existing = await this.reportModel.findOne({ weekStart }).lean();

    if (!existing) {
      this.logger.log(
        `Generando informe de semana ${weekStart.toISOString().split('T')[0]}`,
      );
      try {
        await this.generate(weekStart);
      } catch (err) {
        this.logger.error(
          `Error en generación automática: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Genera o actualiza informe de KPIs para una semana
   * Guard de concurrencia: si ya hay una generación en curso para la misma semana,
   * devuelve esa misma promesa en lugar de generar en paralelo.
   */
  async generate(weekStart: Date): Promise<WeeklyReportDocument> {
    const weekStartTime = weekStart.getTime();

    // Si ya hay una generación en curso para esta semana, devolverla
    if (this.generationInProgress.has(weekStartTime)) {
      return this.generationInProgress.get(weekStartTime)!;
    }

    // Crear promesa de generación
    const generationPromise = this._doGenerate(weekStart);

    // Guardar en el map de generaciones en curso
    this.generationInProgress.set(weekStartTime, generationPromise);

    // Limpiar entrada cuando finalice (éxito o error)
    generationPromise.finally(() => {
      this.generationInProgress.delete(weekStartTime);
    });

    return generationPromise;
  }

  /**
   * Lógica interna de generación de informe (sin guard de concurrencia)
   */
  private async _doGenerate(weekStart: Date): Promise<WeeklyReportDocument> {
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    // 1. Obtener órdenes pagadas de la semana
    const orders = (await this.orderModel
      .find({
        paymentStatus: 'paid',
        createdAt: { $gte: weekStart, $lt: weekEnd },
        isDeleted: { $ne: true },
      })
      .lean()) as unknown as OrderForKpis[];

    // 2. Semana anterior
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 3600 * 1000);
    const prevWeekEnd = weekStart;
    const prevWeekOrders = (await this.orderModel
      .find({
        paymentStatus: 'paid',
        createdAt: { $gte: prevWeekStart, $lt: prevWeekEnd },
        isDeleted: { $ne: true },
      })
      .lean()) as unknown as OrderForKpis[];
    const prevWeekTotal = prevWeekOrders.reduce((sum, o) => sum + o.total, 0);

    // 3. Cargar todos los productos
    const productIds = new Set<string>();
    for (const order of orders) {
      for (const item of order.items ?? []) {
        productIds.add(item.productId);
      }
    }
    const products = (await this.productModel
      .find({ _id: { $in: Array.from(productIds) } })
      .lean()) as unknown as ProductForWeeklyReportKpis[];
    const productById = new Map(products.map((p) => [String(p._id), p]));

    // 4. Cargar ingredientes de productos
    const ingredientIds = new Set<string>();
    for (const product of products) {
      for (const ing of product.ingredients ?? []) {
        ingredientIds.add(ing.productId);
      }
    }
    if (ingredientIds.size > 0) {
      const ingredients = (await this.productModel
        .find({ _id: { $in: Array.from(ingredientIds) } })
        .lean()) as unknown as ProductForWeeklyReportKpis[];
      for (const ing of ingredients) {
        productById.set(String(ing._id), ing);
      }
    }

    // 5. Calcular costo de recetas por producto
    const costByProductAndQty = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items ?? []) {
        if (item.cancelledAt) continue;

        const product = productById.get(item.productId);
        if (product) {
          const cost = computeTheoreticalUnitCost(
            product as ProductForRecipeCost,
            item.quantity,
            productById as Map<string, ProductForRecipeCost>,
            this.logger,
          );
          if (cost !== null) {
            const key = item.productId;
            costByProductAndQty.set(
              key,
              (costByProductAndQty.get(key) ?? 0) + cost,
            );
          }
        }
      }
    }

    // 6. Movimientos de inventario
    const movements = (await this.movementModel
      .find({
        createdAt: { $gte: weekStart, $lt: weekEnd },
      })
      .lean()) as unknown as MovementForKpis[];

    const consumoVentaMovements = movements.filter(
      (m) => m.type === 'CONSUMO_VENTA',
    );
    const mermaMovements = movements.filter(
      (m) => m.type === 'MERMA_DECLARADA',
    );
    const conteoMovements = movements.filter((m) => m.type === 'CONTEO_AJUSTE');

    // 7. Compras
    const purchases = (await this.purchaseModel
      .find({
        createdAt: { $gte: weekStart, $lt: weekEnd },
      })
      .lean()) as unknown as PurchaseForKpis[];

    const comprasUsd = purchases.reduce((sum, p) => sum + p.total, 0);

    // 8. Calcular KPIs
    const ventasUsd = orders.reduce((sum, o) => sum + o.total, 0);

    const salesKpi = computeSalesKpi(orders, prevWeekTotal);
    const profitabilityKpi = computeProfitabilityKpi(
      orders,
      costByProductAndQty,
    );
    const foodCostKpi = computeFoodCostKpi(consumoVentaMovements, ventasUsd);
    const lossesKpi = computeLossesKpi(
      mermaMovements,
      conteoMovements,
      comprasUsd,
    );
    const purchasesKpi = computePurchasesKpi(purchases);
    const coverageKpi = computeCoverageKpi(orders, productById);

    const kpis = assembleWeeklyKpis(
      salesKpi,
      profitabilityKpi,
      foodCostKpi,
      lossesKpi,
      purchasesKpi,
      coverageKpi,
    );

    // 9. Generar narrativa por IA
    const systemPrompt =
      'Eres el analista de un restaurante venezolano. Con los KPIs en JSON redacta: resumen ejecutivo (5-8 líneas) y 3-5 recomendaciones accionables concretas. Tono directo, montos en USD.';
    const userPrompt = JSON.stringify(kpis, null, 2);

    const aiResult = await this.deepseek.complete(systemPrompt, userPrompt);

    // 10. Upsert en BD
    const report = await this.reportModel.findOneAndUpdate(
      { weekStart },
      {
        weekStart,
        weekEnd,
        kpis,
        aiSummary: aiResult.text ?? undefined,
        aiError: aiResult.error ?? null,
        aiModel: 'deepseek-chat',
        generatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    return report;
  }

  /**
   * Obtiene el informe de la semana actual
   */
  async getCurrent(): Promise<WeeklyReportDocument | null> {
    const op = await this.configs.obtener('operacion');
    const weekStart = weekStartOf(new Date(), op);
    return this.reportModel
      .findOne({ weekStart })
      .lean()
      .exec() as Promise<WeeklyReportDocument | null>;
  }

  /**
   * Obtiene informe por ID
   */
  async getById(id: string): Promise<WeeklyReportDocument | null> {
    return this.reportModel
      .findById(id)
      .lean()
      .exec() as Promise<WeeklyReportDocument | null>;
  }

  /**
   * Lista últimos N informes
   */
  async list(limit = 10): Promise<WeeklyReportDocument[]> {
    return this.reportModel
      .find()
      .sort({ weekStart: -1 })
      .limit(limit)
      .lean()
      .exec() as Promise<WeeklyReportDocument[]>;
  }

  /**
   * Reintenta generar narrativa IA para un informe existente
   */
  async retryAi(id: string): Promise<WeeklyReportDocument> {
    const report = await this.reportModel.findById(id);
    if (!report) {
      throw new Error(`Informe ${id} no encontrado`);
    }

    const systemPrompt =
      'Eres el analista de un restaurante venezolano. Con los KPIs en JSON redacta: resumen ejecutivo (5-8 líneas) y 3-5 recomendaciones accionables concretas. Tono directo, montos en USD.';
    const userPrompt = JSON.stringify(report.kpis, null, 2);

    const aiResult = await this.deepseek.complete(systemPrompt, userPrompt);

    const updated = await this.reportModel.findByIdAndUpdate(
      id,
      {
        aiSummary: aiResult.text ?? undefined,
        aiError: aiResult.error ?? null,
      },
      { new: true },
    );

    return updated as WeeklyReportDocument;
  }

  /**
   * Envía informe por WhatsApp
   */
  async sendWhatsapp(id: string): Promise<{ sent: boolean; error?: string }> {
    const report = await this.reportModel.findById(id);
    if (!report) {
      return { sent: false, error: `Informe ${id} no encontrado` };
    }

    const whatsappTo = this.configService.get<string>(
      'INVENTORY_REPORT_WHATSAPP_TO',
    );
    if (!whatsappTo) {
      return {
        sent: false,
        error: 'INVENTORY_REPORT_WHATSAPP_TO no configurada',
      };
    }

    const whatsappServiceUrl =
      this.configService.get<string>('WHATSAPP_SERVICE_URL') ??
      'http://127.0.0.1:6000';
    const whatsappApiKey =
      this.configService.get<string>('WHATSAPP_API_KEY') ?? '';

    // Armar texto plano (~3500 chars max)
    const op = await this.configs.obtener('operacion');
    const text = this._buildWhatsappText(report, 3500, op);

    try {
      const response = await fetch(
        `${whatsappServiceUrl}/api/v1/messages/text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${whatsappApiKey}`,
          },
          body: JSON.stringify({ to: whatsappTo, text }),
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return {
          sent: false,
          error: `WhatsApp respondió ${response.status}: ${detail}`,
        };
      }

      // Marcar como enviado
      await this.reportModel.findByIdAndUpdate(id, {
        sentToWhatsapp: true,
        whatsappError: undefined,
      });

      this.logger.log(`Informe ${id} enviado por WhatsApp a ${whatsappTo}`);
      return { sent: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { sent: false, error: errMsg };
    }
  }

  /**
   * Arma el texto de WhatsApp con los KPIs
   */
  private _buildWhatsappText(
    report: WeeklyReportDocument,
    maxChars: number,
    op: OperacionConfig,
  ): string {
    const kpis = report.kpis;
    const weekStart = diaMesAnio(report.weekStart, op.timezone);

    let text = `*Informe Semanal — ${weekStart}*\n\n`;

    // Ventas
    text += `💰 *VENTAS*\n`;
    text += `Total: $${kpis.ventas.totalUsd}\n`;
    text += `Órdenes: ${kpis.ventas.ordenes}\n`;
    text += `Ticket Promedio: $${kpis.ventas.ticketPromedio}\n`;
    if (kpis.ventas.vsSemanaAnterior.deltaPct !== null) {
      const delta = kpis.ventas.vsSemanaAnterior.deltaPct;
      const arrow = delta >= 0 ? '📈' : '📉';
      text += `vs Semana Anterior: ${arrow} ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%\n`;
    }
    text += '\n';

    // Food Cost
    text += `🍽️ *FOOD COST*\n`;
    text += `Consumo: $${kpis.foodCost.consumoUsd}\n`;
    if (kpis.foodCost.foodCostPct !== null) {
      text += `Porcentaje: ${kpis.foodCost.foodCostPct.toFixed(1)}%\n`;
    }
    text += '\n';

    // Merma
    text += `📉 *MERMA*\n`;
    text += `Declarada: $${kpis.merma.declaradaUsd}\n`;
    text += `Faltante: $${kpis.merma.faltanteUsd}\n`;
    text += `Total: $${kpis.merma.totalUsd}\n`;
    if (kpis.merma.pctSobreCompras !== null) {
      text += `% Compras: ${kpis.merma.pctSobreCompras.toFixed(1)}%\n`;
    }
    text += '\n';

    // Top 3 Vendidos
    text += `🏆 *TOP 3 VENDIDOS*\n`;
    for (
      let i = 0;
      i < Math.min(3, kpis.rentabilidad.topVendidos.length);
      i++
    ) {
      const item = kpis.rentabilidad.topVendidos[i];
      text += `${i + 1}. ${item.name}: ${item.unidades} unds, $${item.ingreso}`;
      if (item.margenPct !== null) {
        text += ` (margen ${item.margenPct.toFixed(1)}%)`;
      }
      text += '\n';
    }
    text += '\n';

    // Resumen IA si existe
    if (report.aiSummary) {
      text += `📊 *ANÁLISIS IA*\n`;
      text += report.aiSummary.substring(0, 800) + '...\n\n';
    }

    text += `🔗 Ver informe completo en la app`;

    // Truncar si excede
    if (text.length > maxChars) {
      text = text.substring(0, maxChars - 3) + '...';
    }

    return text;
  }
}

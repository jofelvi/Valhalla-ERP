import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { OrderDocument } from '../orders/schemas/order.schema';

// ─── Tipos para resultados de agregación ─────────────────────────────

/** Resultado de venta diaria en el rango de 7 días */
export interface DailySalesResult {
  date: string;
  total: number;
  count: number;
  subtotal: number;
  tax: number;
}

/** Resultado de ventas acumuladas en un intervalo */
export interface IntervalSalesResult {
  total: number;
  count: number;
  subtotal: number;
  tax: number;
  avgOrderValue: number;
}

/** Resultado de productos más vendidos */
export interface TopProductResult {
  _id: string;
  name: string;
  quantity: number;
  total: number;
  count: number;
}

/** Resultado de meseros con más ventas */
export interface TopWaiterResult {
  _id: string;
  waiterName: string;
  orderCount: number;
  totalSales: number;
  totalServiceCharge: number;
  avgOrderValue: number;
}

// ─── Alias de compatibilidad con el APK ──────────────────────────────
//
// El Panel del APK (`AdminDashboardScreen`) normaliza la respuesta con `?? 0`
// sobre nombres que esta API nunca mandó — `totalSales`, `orderCount`,
// `averageOrderValue`, `revenue`, `id`, `name` — así que TODAS las tarjetas
// mostraban 0 mientras la API servía $416,58 y 26 órdenes ese mismo día. Sin un
// solo error, en ninguna de las dos puntas (medido en producción el 20/09/2026).
//
// El APK ya lee los nombres buenos, pero los teléfonos tardan semanas en
// actualizarse: estos alias hacen que los que YA están instalados vuelvan a
// mostrar números con solo desplegar la API. Se pueden retirar cuando ningún
// teléfono en uso lleve un APK anterior a la 1.3.05.

/** Ventas de un intervalo, con los alias que lee el APK */
export interface IntervalSalesResponse extends IntervalSalesResult {
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
}

/** Producto más vendido, con los alias que lee el APK */
export interface TopProductResponse extends TopProductResult {
  id: string;
  revenue: number;
}

/** Mesonero con más ventas, con los alias que lee el APK */
export interface TopWaiterResponse extends TopWaiterResult {
  id: string;
  name: string;
  commission: number;
}

export const conAliasDeVentas = (
  r: IntervalSalesResult,
): IntervalSalesResponse => ({
  ...r,
  totalSales: r.total,
  orderCount: r.count,
  averageOrderValue: r.avgOrderValue,
});

export const conAliasDeProducto = (
  r: TopProductResult,
): TopProductResponse => ({
  ...r,
  id: r._id,
  revenue: r.total,
});

export const conAliasDeMesonero = (r: TopWaiterResult): TopWaiterResponse => ({
  ...r,
  id: r._id,
  name: r.waiterName,
  commission: r.totalServiceCharge,
});

/** Estructura interna de match para queries de MongoDB */
interface MongoDateRange {
  $gte?: Date;
  $lte?: Date;
}

interface OrderMatchFilter {
  createdAt?: MongoDateRange;
  waiterId?: { $exists: boolean; $ne: null };
}

/** Resultado intermediario del group stage para ventas diarias */
interface DailyGroupResult {
  _id: string;
  total: number;
  count: number;
  subtotal: number;
  tax: number;
}

/** Resultado intermediario del group stage para ventas por intervalo */
interface IntervalGroupResult {
  _id: null;
  total: number;
  count: number;
  subtotal: number;
  tax: number;
  avgOrderValue: number;
}

/** Resultado intermediario del group stage para productos top */
interface TopProductGroupResult {
  _id: string;
  name: string;
  quantity: number;
  total: number;
  count: number;
}

/** Resultado intermediario del group stage para meseros top */
interface TopWaiterGroupResult {
  _id: string;
  waiterName: string;
  orderCount: number;
  totalSales: number;
  totalServiceCharge: number;
  avgOrderValue: number;
}

@Injectable()
export class AnalyticsService {
  constructor(@InjectModel('Order') private orderModel: Model<OrderDocument>) {}

  async getWeeklySales(): Promise<DailySalesResult[]> {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 7);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          createdAt: {
            $gte: sevenDaysAgo,
            $lte: today,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          total: { $sum: '$total' },
          count: { $sum: 1 },
          subtotal: { $sum: '$subtotal' },
          tax: { $sum: '$tax' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ];

    const results = await this.orderModel
      .aggregate<DailyGroupResult>(pipeline)
      .exec();
    return results.map((r) => ({
      date: r._id,
      total: r.total,
      count: r.count,
      subtotal: r.subtotal,
      tax: r.tax,
    }));
  }

  async getSalesByInterval(
    interval: 'today' | 'week' | 'month' = 'today',
  ): Promise<IntervalSalesResponse> {
    let startDate: Date;

    if (interval === 'today') {
      startDate = startOfDay(new Date());
    } else if (interval === 'week') {
      startDate = subDays(new Date(), 7);
    } else {
      startDate = subDays(new Date(), 30);
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          createdAt: {
            $gte: startDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 },
          subtotal: { $sum: '$subtotal' },
          tax: { $sum: '$tax' },
          avgOrderValue: { $avg: '$total' },
        },
      },
    ];

    const results = await this.orderModel
      .aggregate<IntervalGroupResult>(pipeline)
      .exec();
    return conAliasDeVentas(
      results[0] || {
        total: 0,
        count: 0,
        subtotal: 0,
        tax: 0,
        avgOrderValue: 0,
      },
    );
  }

  async getTopProducts(from?: Date, to?: Date): Promise<TopProductResponse[]> {
    const match: OrderMatchFilter = {};

    if (from) {
      match.createdAt = { $gte: from };
    }
    if (to) {
      if (match.createdAt) {
        match.createdAt.$lte = to;
      } else {
        match.createdAt = { $lte: to };
      }
    }

    const pipeline: PipelineStage[] = [
      {
        $match: match,
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          total: { $sum: '$items.total' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { total: -1 },
      },
      {
        $limit: 10,
      },
    ];

    const filas = await this.orderModel
      .aggregate<TopProductGroupResult>(pipeline)
      .exec();
    return filas.map(conAliasDeProducto);
  }

  async getTopWaiters(from?: Date, to?: Date): Promise<TopWaiterResponse[]> {
    const match: OrderMatchFilter = {
      waiterId: { $exists: true, $ne: null },
    };

    if (from) {
      match.createdAt = { $gte: from };
    }
    if (to) {
      if (match.createdAt) {
        match.createdAt.$lte = to;
      } else {
        match.createdAt = { $lte: to };
      }
    }

    const pipeline: PipelineStage[] = [
      {
        $match: match,
      },
      {
        $group: {
          _id: '$waiterId',
          waiterName: { $first: '$waiterName' },
          orderCount: { $sum: 1 },
          totalSales: { $sum: '$total' },
          totalServiceCharge: { $sum: '$serviceCharge' },
          avgOrderValue: { $avg: '$total' },
        },
      },
      {
        $sort: { totalSales: -1 },
      },
      {
        $limit: 10,
      },
    ];

    const filas = await this.orderModel
      .aggregate<TopWaiterGroupResult>(pipeline)
      .exec();
    return filas.map(conAliasDeMesonero);
  }
}

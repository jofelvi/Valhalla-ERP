import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PriceHistory,
  PriceHistoryDocument,
} from './schemas/price-history.schema';
import { roundUnitCost } from './units';

export interface BestPlaceHint {
  productId: string;
  bestPlaceId: string;
  bestCost: number;
  lastCost: number;
  lastPlaceId: string;
  savingPct: number;
}

@Injectable()
export class PriceHistoryService {
  constructor(
    @InjectModel(PriceHistory.name)
    private model: Model<PriceHistoryDocument>,
  ) {}

  async record(input: {
    productId: string;
    unitCost: number;
    placeId: string;
    purchaseId: string;
    date: Date;
  }): Promise<void> {
    await this.model.create({
      ...input,
      unitCost: roundUnitCost(input.unitCost),
    });
  }

  async lastCost(
    productId: string,
  ): Promise<{ unitCost: number; placeId: string; date: Date } | null> {
    const doc = await this.model
      .findOne({ productId })
      .sort({ date: -1 })
      .lean();
    return doc
      ? { unitCost: doc.unitCost, placeId: doc.placeId, date: doc.date }
      : null;
  }

  async listByProduct(productId: string, limit = 50) {
    return this.model
      .find({ productId })
      .sort({ date: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Obtiene el último costo para múltiples productos en una sola query.
   * Retorna Map<productId, {unitCost, placeId, date}> para productos que tienen histórico.
   */
  async lastCostBatch(
    productIds: string[],
  ): Promise<Map<string, { unitCost: number; placeId: string; date: Date }>> {
    if (productIds.length === 0) {
      return new Map();
    }

    // Una sola query: traer todos, ordenar por fecha descendente
    const allPoints = await this.model
      .find({ productId: { $in: productIds } })
      .sort({ date: -1 })
      .lean();

    // Agrupar por productId, quedarse con el primero (más reciente)
    const result = new Map<
      string,
      { unitCost: number; placeId: string; date: Date }
    >();
    for (const point of allPoints) {
      if (!result.has(point.productId)) {
        result.set(point.productId, {
          unitCost: point.unitCost,
          placeId: point.placeId,
          date: point.date,
        });
      }
    }

    return result;
  }

  /** Último costo por lugar; hint solo si hay ≥2 lugares y el mejor no es el último usado. */
  async bestPlaces(productIds: string[]): Promise<BestPlaceHint[]> {
    const hints: BestPlaceHint[] = [];

    // Query única para todos los productos
    const allPoints = await this.model
      .find({ productId: { $in: productIds } })
      .sort({ date: -1 })
      .lean();

    // Agrupar por productId, respetando orden desc y limitando a 50 por producto
    const pointsByProduct = new Map<
      string,
      Array<{ unitCost: number; placeId: string; date: Date }>
    >();
    for (const point of allPoints) {
      if (!pointsByProduct.has(point.productId)) {
        pointsByProduct.set(point.productId, []);
      }
      const productPoints = pointsByProduct.get(point.productId)!;
      if (productPoints.length < 50) {
        productPoints.push(point);
      }
    }

    for (const productId of productIds) {
      const points = pointsByProduct.get(productId);
      if (!points || points.length === 0) continue;

      const latestByPlace = new Map<string, { unitCost: number; date: Date }>();
      for (const p of points) {
        if (!latestByPlace.has(p.placeId)) {
          latestByPlace.set(p.placeId, {
            unitCost: p.unitCost,
            date: p.date,
          });
        }
      }

      if (latestByPlace.size < 2) continue;

      const last = points[0];

      // Validación: saltar si unitCost es <= 0 (evita división por cero)
      if (last.unitCost <= 0) continue;

      let bestPlaceId = last.placeId;
      let bestCost = last.unitCost;

      for (const [placeId, v] of latestByPlace) {
        if (v.unitCost < bestCost) {
          bestCost = v.unitCost;
          bestPlaceId = placeId;
        }
      }

      if (bestPlaceId === last.placeId) continue;

      hints.push({
        productId,
        bestPlaceId,
        bestCost,
        lastCost: last.unitCost,
        lastPlaceId: last.placeId,
        savingPct:
          Math.round(((last.unitCost - bestCost) / last.unitCost) * 100 * 10) /
          10,
      });
    }
    return hints;
  }
}

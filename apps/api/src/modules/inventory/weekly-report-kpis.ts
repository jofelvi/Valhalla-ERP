import {
  WeeklyKpis,
  TopVendidoItem,
  PriceVariationItem,
  LossItem,
} from './schemas/weekly-report.schema';

/**
 * Interfaz lean de orden para cálculo de KPIs
 */
export interface OrderForKpis {
  _id: string;
  total: number;
  createdAt: Date;
  items: Array<{
    productId: string;
    name?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    cancelledAt?: Date;
  }>;
}

/**
 * Interfaz lean de movimiento de inventario
 */
export interface MovementForKpis {
  productId: string;
  type: string;
  qty: number;
  unitCost: number;
  createdAt: Date;
}

/**
 * Interfaz lean de compra
 */
export interface PurchaseForKpis {
  _id: string;
  total: number;
  createdAt: Date;
  items?: Array<{
    productId: string;
    name: string;
  }>;
  alerts?: Array<{
    productId: string;
    name: string;
    variationPct: number;
    prevCost: number;
    newCost: number;
  }>;
}

/**
 * Interfaz lean de producto
 */
export interface ProductForKpis {
  _id: string;
  name: string;
  isForInventory?: boolean;
  ingredients?: Array<{
    productId: string;
    quantity: number;
    unit: string;
    wastePercentage?: number;
  }> | null;
}

/**
 * Calcula KPI de ventas de la semana
 */
export function computeSalesKpi(
  orders: OrderForKpis[],
  prevWeekTotal: number,
): WeeklyKpis['ventas'] {
  const totalUsd = orders.reduce((sum, o) => sum + o.total, 0);
  const ordenes = orders.length;
  const ticketPromedio = ordenes > 0 ? totalUsd / ordenes : 0;

  return {
    totalUsd: Math.round(totalUsd * 100) / 100,
    ordenes,
    ticketPromedio: Math.round(ticketPromedio * 100) / 100,
    vsSemanaAnterior: {
      totalUsd: Math.round(prevWeekTotal * 100) / 100,
      deltaPct:
        prevWeekTotal > 0
          ? ((totalUsd - prevWeekTotal) / prevWeekTotal) * 100
          : null,
    },
  };
}

/**
 * Calcula KPI de rentabilidad: top 10 vendidos con márgenes
 */
export function computeProfitabilityKpi(
  orders: OrderForKpis[],
  costByProductAndQty: Map<string, number>,
): WeeklyKpis['rentabilidad'] {
  const salesByProduct = new Map<
    string,
    { name: string; unidades: number; ingreso: number }
  >();

  for (const order of orders) {
    for (const item of order.items ?? []) {
      if (item.cancelledAt) continue;

      const key = item.productId;
      const current = salesByProduct.get(key) || {
        name: item.name || 'Sin nombre',
        unidades: 0,
        ingreso: 0,
      };

      current.unidades += item.quantity;
      current.ingreso += item.total;
      salesByProduct.set(key, current);
    }
  }

  const topVendidos: TopVendidoItem[] = Array.from(salesByProduct.entries())
    .map(([productId, { name, unidades, ingreso }]) => {
      const costoReceta = costByProductAndQty.get(productId) ?? null;
      const margenUsd = costoReceta !== null ? ingreso - costoReceta : null;
      const margenPct =
        costoReceta !== null && ingreso > 0
          ? (margenUsd! / ingreso) * 100
          : null;

      return {
        productId,
        name,
        unidades,
        ingreso: Math.round(ingreso * 100) / 100,
        costoReceta:
          costoReceta !== null ? Math.round(costoReceta * 100) / 100 : null,
        margenUsd:
          margenUsd !== null ? Math.round(margenUsd * 100) / 100 : null,
        margenPct:
          margenPct !== null ? Math.round(margenPct * 100) / 100 : null,
      };
    })
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, 10);

  const gananciaBrutaTeorica = topVendidos.reduce(
    (sum, item) => sum + (item.margenUsd ?? 0),
    0,
  );

  return {
    topVendidos,
    gananciaBrutaTeorica: Math.round(gananciaBrutaTeorica * 100) / 100,
  };
}

/**
 * Calcula KPI de food cost
 */
export function computeFoodCostKpi(
  consumoVentaMovements: MovementForKpis[],
  ventasUsd: number,
): WeeklyKpis['foodCost'] {
  const consumoUsd = Math.abs(
    consumoVentaMovements.reduce((sum, m) => sum + m.qty * m.unitCost, 0),
  );

  return {
    consumoUsd: Math.round(consumoUsd * 100) / 100,
    ventasUsd: Math.round(ventasUsd * 100) / 100,
    foodCostPct:
      ventasUsd > 0 ? Math.round((consumoUsd / ventasUsd) * 10000) / 100 : null,
  };
}

/**
 * Calcula KPI de merma
 */
export function computeLossesKpi(
  mermaMovements: MovementForKpis[],
  conteoMovements: MovementForKpis[],
  comprasUsd: number,
): WeeklyKpis['merma'] {
  const declaradaUsd = Math.abs(
    mermaMovements.reduce((sum, m) => sum + m.qty * m.unitCost, 0),
  );

  const faltanteMovements = conteoMovements.filter((m) => m.qty < 0);
  const sobranteMovements = conteoMovements.filter((m) => m.qty > 0);

  const faltanteUsd = Math.abs(
    faltanteMovements.reduce((sum, m) => sum + m.qty * m.unitCost, 0),
  );

  const sobranteUsd = sobranteMovements.reduce(
    (sum, m) => sum + m.qty * m.unitCost,
    0,
  );

  const totalUsd = declaradaUsd + faltanteUsd;

  // Top 5 insumos por pérdida (merma + faltante)
  const lossMap = new Map<string, { diffUsd: number }>();

  for (const m of [...mermaMovements, ...faltanteMovements]) {
    const key = m.productId;
    const current = lossMap.get(key) || { diffUsd: 0 };
    current.diffUsd += Math.abs(m.qty * m.unitCost);
    lossMap.set(key, current);
  }

  const topInsumos: LossItem[] = Array.from(lossMap.entries())
    .map(([productId, { diffUsd }]) => ({
      productId,
      name: '', // Se completa luego si es necesario
      diffUsd: Math.round(diffUsd * 100) / 100,
    }))
    .sort((a, b) => b.diffUsd - a.diffUsd)
    .slice(0, 5);

  return {
    declaradaUsd: Math.round(declaradaUsd * 100) / 100,
    faltanteUsd: Math.round(faltanteUsd * 100) / 100,
    sobranteUsd: Math.round(sobranteUsd * 100) / 100,
    totalUsd: Math.round(totalUsd * 100) / 100,
    pctSobreCompras:
      comprasUsd > 0 ? Math.round((totalUsd / comprasUsd) * 10000) / 100 : null,
    topInsumos,
  };
}

/**
 * Calcula KPI de compras
 */
export function computePurchasesKpi(
  purchases: PurchaseForKpis[],
): WeeklyKpis['compras'] {
  const totalUsd = purchases.reduce((sum, p) => sum + p.total, 0);
  const totalCompras = purchases.length;

  const topVariaciones: PriceVariationItem[] = purchases
    .flatMap((p) => p.alerts ?? [])
    .sort((a, b) => Math.abs(b.variationPct) - Math.abs(a.variationPct))
    .slice(0, 5);

  return {
    totalUsd: Math.round(totalUsd * 100) / 100,
    totalCompras,
    topVariaciones,
  };
}

/**
 * Calcula KPI de cobertura (items con receta en catálogo)
 */
export function computeCoverageKpi(
  orders: OrderForKpis[],
  productById: Map<string, ProductForKpis>,
): WeeklyKpis['cobertura'] {
  let ventasTotal = 0;
  let ventasConReceta = 0;

  for (const order of orders) {
    for (const item of order.items ?? []) {
      if (item.cancelledAt) continue;

      ventasTotal += item.quantity;

      const product = productById.get(item.productId);
      if (product && (product.ingredients?.length || product.isForInventory)) {
        ventasConReceta += item.quantity;
      }
    }
  }

  const pct =
    ventasTotal > 0
      ? Math.round((ventasConReceta / ventasTotal) * 10000) / 100
      : 0;

  return {
    ventasConReceta,
    ventasTotal,
    pct,
  };
}

/**
 * Ensambla todos los KPIs en una estructura WeeklyKpis
 */
export function assembleWeeklyKpis(
  salesKpi: WeeklyKpis['ventas'],
  profitabilityKpi: WeeklyKpis['rentabilidad'],
  foodCostKpi: WeeklyKpis['foodCost'],
  lossesKpi: WeeklyKpis['merma'],
  purchasesKpi: WeeklyKpis['compras'],
  coverageKpi: WeeklyKpis['cobertura'],
): WeeklyKpis {
  return {
    ventas: salesKpi,
    rentabilidad: profitabilityKpi,
    foodCost: foodCostKpi,
    merma: lossesKpi,
    compras: purchasesKpi,
    cobertura: coverageKpi,
  };
}

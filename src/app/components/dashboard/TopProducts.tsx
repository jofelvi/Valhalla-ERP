'use client';

import { useState } from 'react';
import { Order } from '@odin6/types';
import { Product } from '@odin6/types';
import { aFecha } from '@/shared/utils/dateHelpers';
import { SalesIntervalEnum } from '@/shared';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { getIntervalDateRange } from './intervalUtils';
import { UtensilsCrossed, Wine } from 'lucide-react';

// Categorías de bebidas (IDs de Firestore)
const DRINK_CATEGORY_IDS = new Set([
  '3SnU7SJqMztCCMKGyYrr', // Bebidas y Alcohol
  'TXkA52zVnSuUkU6pxH0U', // Refrescos y Jugos
  'aJc1h0PbZMM4uDbZDUzs', // Batidos
  'bebidas', // Tragos
  'eEQzeNlX4ltis3xYtSX1', // Jugos
  'l7bph5eKCKCxNEB0Zld6', // Cervezas
  'tGaXqj3snu0WsaNCJ6Bg', // Aguas y Sodas
]);

interface ProductRank {
  name: string;
  productId: string;
  quantity: number;
  revenue: number;
}

type CategoryFilter = 'all' | 'food' | 'drinks';

interface TopProductsProps {
  orders: Order[];
  products: Product[];
  mode: 'top' | 'bottom';
  interval: SalesIntervalEnum;
  limit?: number;
}

function filterOrdersByInterval(
  orders: Order[],
  interval: SalesIntervalEnum,
): Order[] {
  const { start, end } = getIntervalDateRange(interval);

  return orders.filter((o) => {
    if (o.paymentStatus !== 'paid' || !o.createdAt) return false;
    const date = aFecha(o.createdAt);
    return date >= start && date <= end;
  });
}

function rankProducts(orders: Order[]): ProductRank[] {
  const map = new Map<string, ProductRank>();

  for (const order of orders) {
    for (const item of order.items) {
      const key = item.productId || item.name;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.total;
      } else {
        map.set(key, {
          name: item.name,
          productId: item.productId,
          quantity: item.quantity,
          revenue: item.total,
        });
      }
    }
  }

  return Array.from(map.values());
}

export default function TopProducts({
  orders,
  products,
  mode,
  interval,
  limit = 10,
}: TopProductsProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all');

  // Mapeo productId → categoryId
  const productCategoryMap = new Map<string, string>();
  for (const p of products) {
    productCategoryMap.set(p.id, p.categoryId);
  }

  const filtered = filterOrdersByInterval(orders, interval);
  const ranked = rankProducts(filtered);

  // Filtrar por comidas o bebidas
  const filteredByCategory =
    filter === 'all'
      ? ranked
      : ranked.filter((item) => {
          const catId = productCategoryMap.get(item.productId);
          if (!catId) return filter === 'food'; // Sin categoría = comida
          const isDrink = DRINK_CATEGORY_IDS.has(catId);
          return filter === 'drinks' ? isDrink : !isDrink;
        });

  const sorted =
    mode === 'top'
      ? filteredByCategory
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, limit)
      : filteredByCategory
          .sort((a, b) => a.quantity - b.quantity)
          .slice(0, limit);

  const maxQty =
    sorted.length > 0
      ? mode === 'top'
        ? sorted[0].quantity
        : sorted[sorted.length - 1].quantity
      : 1;
  const isTop = mode === 'top';

  const tabs: {
    value: CategoryFilter;
    label: string;
    icon: typeof UtensilsCrossed;
  }[] = [
    { value: 'all', label: 'Todos', icon: UtensilsCrossed },
    { value: 'food', label: 'Comidas', icon: UtensilsCrossed },
    { value: 'drinks', label: 'Bebidas', icon: Wine },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-elevated rounded-lg p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all ${
              filter === tab.value
                ? isTop
                  ? 'bg-gradient-to-r from-brand to-brand-light text-on-brand shadow-sm'
                  : 'bg-gradient-to-r from-red-400 to-rose-500 text-on-brand shadow-sm'
                : 'text-brand hover:bg-surface'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {sorted.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-brand text-sm">Sin datos en este período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((product, index) => {
            const barWidth = isTop
              ? (product.quantity / maxQty) * 100
              : ((maxQty + 1 - product.quantity) / maxQty) * 100;

            return (
              <div key={product.productId || product.name} className="group">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-on-brand shrink-0 ${
                      isTop
                        ? index === 0
                          ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                          : index === 1
                            ? 'bg-gradient-to-br from-gray-300 to-gray-500'
                            : index === 2
                              ? 'bg-gradient-to-br from-orange-400 to-orange-600'
                              : 'bg-gradient-to-br from-brand-light to-brand'
                        : 'bg-gradient-to-br from-red-400 to-rose-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-content truncate pr-2">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-brand">
                          {formatearUsdConMiles(product.revenue)}
                        </span>
                        <span
                          className={`text-sm font-bold ${isTop ? 'text-brand' : 'text-danger'}`}
                        >
                          {product.quantity}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isTop
                            ? 'bg-gradient-to-r from-brand-light to-brand'
                            : 'bg-gradient-to-r from-red-300 to-rose-400'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

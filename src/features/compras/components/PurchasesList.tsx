'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Purchase } from '@odin6/types';
import { formatearUsd } from '@/shared/utils/dinero';
import { AlertCircle, Loader2 } from 'lucide-react';

export function PurchasesList() {
  const {
    data: purchases = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['purchases', 'list'],
    queryFn: () => api.get<Purchase[]>('/api/inventory/purchases?limit=50'),
  });

  const sortedPurchases = useMemo(
    () =>
      [...purchases].sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      }),
    [purchases],
  );

  if (error) {
    return (
      <div className="p-6 bg-danger/10 border border-danger rounded-lg flex gap-3">
        <AlertCircle className="h-5 w-5 text-danger flex-shrink-0" />
        <div className="text-sm text-danger">Error al cargar compras</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-line rounded-lg">
        <p className="text-dim">No hay compras registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-content">
        Historial de Compras
      </h3>

      <div className="grid gap-2">
        {sortedPurchases.map((purchase) => (
          <div
            key={purchase.id}
            className="border border-line rounded-lg p-4 hover:bg-elevated/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-content truncate">
                  {purchase.placeName}
                </div>
                <div className="text-sm text-dim">
                  {purchase.date
                    ? new Date(purchase.date).toLocaleDateString('es-VE')
                    : 'Sin fecha'}
                </div>
                <div className="text-xs text-dim mt-1">
                  {purchase.items.length} artículo
                  {purchase.items.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-lg font-semibold text-brand">
                  {formatearUsd(purchase.total)} {purchase.currency}
                </div>
                {purchase.alerts && purchase.alerts.length > 0 && (
                  <div className="text-xs text-warn mt-2 bg-warn/10 px-2 py-1 rounded">
                    {purchase.alerts.length} alerta
                    {purchase.alerts.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Items Preview */}
            {purchase.items.length > 0 && (
              <div className="mt-3 pt-3 border-t border-line text-xs text-dim space-y-1">
                {purchase.items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate">{item.productName}</span>
                    <span className="flex-shrink-0 ml-2">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
                {purchase.items.length > 3 && (
                  <div className="text-dim italic">
                    +{purchase.items.length - 3} más
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

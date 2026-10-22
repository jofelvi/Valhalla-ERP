'use client';
import { ClipboardList } from 'lucide-react';
import { Budget } from '@odin6/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { formatearUsd, formatearUsdConMiles } from '@/shared/utils/dinero';

interface BudgetItemsCardProps {
  budget: Budget;
}

export function BudgetItemsCard({ budget }: BudgetItemsCardProps) {
  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50 hover:shadow-xl hover:-translate-y-0">
      <CardHeader className="border-b border-accent/20/50 pb-4">
        <CardTitle className="text-content flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-brand" />
          Productos ({budget.items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-accent/20 bg-surface/50">
                <th className="text-left px-4 py-3 font-semibold text-accent">
                  Producto
                </th>
                <th className="text-center px-4 py-3 font-semibold text-accent w-20">
                  Cant.
                </th>
                <th className="text-right px-4 py-3 font-semibold text-accent w-28">
                  Precio Unit.
                </th>
                <th className="text-right px-4 py-3 font-semibold text-accent w-28">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {budget.items.map((item, index) => (
                <tr
                  key={`${item.productId}-${index}`}
                  className="border-b border-line hover:bg-surface/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-content">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-dim mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-dim">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right text-dim">
                    {formatearUsd(item.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-content">
                    {formatearUsd(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals breakdown */}
        <div className="border-t border-accent/20 px-4 py-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-dim">Subtotal</span>
            <span className="font-medium text-content">
              {formatearUsd(budget.subtotal)}
            </span>
          </div>

          {budget.serviceCharge > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-dim">Cargo por Servicio (10%)</span>
              <span className="font-medium text-content">
                {formatearUsd(budget.serviceCharge)}
              </span>
            </div>
          )}

          {budget.discount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-dim">
                Descuento
                {budget.discountType === 'percentage'
                  ? ` (${budget.discountValue}%)`
                  : ''}
              </span>
              <span className="font-medium text-danger">
                -{formatearUsd(budget.discount)}
              </span>
            </div>
          )}

          <div className="border-t border-accent/20 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-content">Total</span>
              <span className="text-lg font-bold text-content">
                {formatearUsdConMiles(budget.total)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

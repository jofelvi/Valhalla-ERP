'use client';
import React from 'react';
import { formatCurrency } from '@/shared/utils/currencyHelpers';

interface StatsCardsProps {
  filteredCount: number;
  pendingCount: number;
  inProgressCount: number;
  totalVentas: number;
  totalCobrado: number;
  totalCreditos: number;
  cancelledCount: number;
  cancelledTotal: number;
}

export const OrdersStatsCards: React.FC<StatsCardsProps> = ({
  filteredCount,
  pendingCount,
  inProgressCount,
  totalVentas,
  totalCobrado,
  totalCreditos,
  cancelledCount,
  cancelledTotal,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-3">
      <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-line/50">
        <p className="text-xs text-dim">Ordenes</p>
        <p className="text-xl font-bold text-content">{filteredCount}</p>
        <div className="flex gap-2 mt-1 text-[10px]">
          <span className="text-accent">{pendingCount} pend.</span>
          <span className="text-brand">{inProgressCount} prog.</span>
        </div>
      </div>

      <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-line/50">
        <p className="text-xs text-dim">Total Ventas</p>
        <p className="text-xl font-bold text-content">
          {formatCurrency(totalVentas)}
        </p>
        <p className="text-[10px] text-dim mt-1">Ordenes pagadas</p>
      </div>

      <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-ok/30">
        <p className="text-xs text-ok font-medium">Cobrado</p>
        <p className="text-xl font-bold text-ok">
          {formatCurrency(totalCobrado)}
        </p>
        <p className="text-[10px] text-ok/70 mt-1">Dinero recibido</p>
      </div>

      <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-accent/30">
        <p className="text-xs text-accent font-medium">Creditos</p>
        <p className="text-xl font-bold text-accent">
          {formatCurrency(totalCreditos)}
        </p>
        <p className="text-[10px] text-accent/70 mt-1">Pendiente por cobrar</p>
      </div>

      <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-danger/30">
        <p className="text-xs text-danger font-medium">Canceladas</p>
        <p className="text-xl font-bold text-danger">{cancelledCount}</p>
        <p className="text-[10px] text-danger/70 mt-1">
          {formatCurrency(cancelledTotal)}
        </p>
      </div>
    </div>
  );
};

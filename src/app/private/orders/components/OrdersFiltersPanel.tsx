'use client';
import React from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { OrderStatusEnum, DateFilterEnum } from '@/shared';
import { Panel } from '@/components/shared/panel/Panel';
import { CampoDeBusqueda } from '@/components/shared/busqueda/CampoDeBusqueda';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';
import { getStatusLabel } from './OrderStatusHelpers';

interface OrdersFiltersPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateFilter: DateFilterEnum;
  onDateFilterChange: (value: DateFilterEnum) => void;
  customDate: string;
  onCustomDateChange: (value: string) => void;
  statusFilter: OrderStatusEnum | 'ALL';
  onStatusFilterChange: (value: OrderStatusEnum | 'ALL') => void;
}

export const OrdersFiltersPanel: React.FC<OrdersFiltersPanelProps> = ({
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  customDate,
  onCustomDateChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  return (
    <Panel className="p-3 mb-3">
      <div className="space-y-2.5">
        {/* Búsqueda + Período */}
        <div className="flex flex-col sm:flex-row gap-2">
          <CampoDeBusqueda
            className="flex-1"
            valor={searchTerm}
            onCambio={onSearchChange}
            placeholder="Buscar orden, mesa, cliente, producto..."
            Icono={FiSearch}
            IconoLimpiar={FiX}
          />
          <div className="flex gap-2 shrink-0">
            <SelectCustom
              id="dateFilter"
              value={dateFilter}
              onChange={(val) => onDateFilterChange(val as DateFilterEnum)}
              options={[
                { value: DateFilterEnum.TODAY, label: 'Hoy' },
                { value: DateFilterEnum.YESTERDAY, label: 'Ayer' },
                { value: DateFilterEnum.LAST_WEEK, label: 'Ultima semana' },
                {
                  value: DateFilterEnum.LAST_TWO_WEEKS,
                  label: '2 semanas',
                },
                { value: DateFilterEnum.THIS_MONTH, label: 'Este mes' },
                { value: DateFilterEnum.LAST_MONTH, label: 'Mes anterior' },
                { value: DateFilterEnum.CUSTOM, label: 'Fecha especifica' },
              ]}
              selectClassName="h-[34px] min-w-[140px]"
            />
            {dateFilter === DateFilterEnum.CUSTOM && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => onCustomDateChange(e.target.value)}
                className="h-[34px] px-3 text-sm border border-line rounded-xl bg-surface/90 text-content focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
            )}
          </div>
        </div>

        {/* Estado pills - scroll horizontal en mobile */}
        <div className="flex gap-1 items-center overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
          {(['ALL', ...Object.values(OrderStatusEnum)] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => onStatusFilterChange(status)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === status
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'bg-page text-dim hover:bg-elevated border border-line'
                }`}
              >
                {status === 'ALL'
                  ? 'Todas'
                  : getStatusLabel(status as OrderStatusEnum)}
              </button>
            ),
          )}
        </div>
      </div>
    </Panel>
  );
};

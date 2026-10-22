'use client';
import { useRef } from 'react';
import Link from 'next/link';
import { Employee } from '@odin6/types';
import { CheckCircle2, Upload, AlertCircle, Minus, Plus } from 'lucide-react';
import { PRIVATE_ROUTES } from '@/shared';
import { formatUSD, formatBs } from '../utils/formatters';
import { ConsumosSection, ConsumosSectionProps } from './ConsumosSection';

interface PayrollRowCompactProps {
  employee: Employee;
  isWaiter: boolean;
  daysWorked: number;
  onDaysChange: (days: number) => void;
  dailyRate: number;
  isWaiterEditable: boolean;
  onWaiterRateChange?: (rate: number) => void;
  waiterRate?: number;
  earnings: number;
  commissions: number;
  tips: number;
  waiterOrdersLength: number;
  consumos: ConsumosSectionProps;
  finalNetUSD: number;
  bcvRate: number;
  adjustmentsCount: number;
  externalARCount: number;
  proofPreview: string | null;
  onProofSelect: (file: File) => void;
  onProofRemove: () => void;
  onPayClick: () => void;
  isProcessing: boolean;
  error: string | null;
  diasAsistencia: number | null | undefined;
  semanaAsistencia?: string;
}

export function PayrollRowCompact({
  employee,
  isWaiter,
  daysWorked,
  onDaysChange,
  dailyRate,
  isWaiterEditable,
  onWaiterRateChange,
  waiterRate,
  earnings,
  commissions,
  tips,
  waiterOrdersLength,
  consumos,
  finalNetUSD,
  bcvRate,
  adjustmentsCount,
  externalARCount,
  proofPreview,
  onProofSelect,
  onProofRemove,
  onPayClick,
  isProcessing,
  error,
  diasAsistencia,
  semanaAsistencia,
}: PayrollRowCompactProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullName = `${employee.firstName} ${employee.lastName}`;

  return (
    <tr className="border-b border-line/30 hover:bg-elevated/30 transition-colors align-top">
      {/* Employee */}
      <td className="px-4 py-3">
        <p className="font-medium text-sm text-content">{fullName}</p>
        <p className="text-xs text-dim">
          {employee.position}
          {isWaiter && (
            <span className="ml-1 text-[10px] text-accent">· mesonero</span>
          )}
        </p>
      </td>

      {/* Department */}
      <td className="px-4 py-3 text-sm text-dim">{employee.department}</td>

      {/* Days & Rate */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDaysChange(Math.max(0, daysWorked - 1))}
            className="w-6 h-6 rounded bg-elevated text-content hover:bg-line flex items-center justify-center"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-6 text-center text-sm font-semibold">
            {daysWorked}
          </span>
          <button
            type="button"
            onClick={() => onDaysChange(Math.min(7, daysWorked + 1))}
            className="w-6 h-6 rounded bg-elevated text-content hover:bg-line flex items-center justify-center"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-1 text-[11px] text-dim flex items-center gap-1">
          {isWaiterEditable ? (
            <>
              <span>×</span>
              <span>$</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={waiterRate || 0}
                onChange={(e) =>
                  onWaiterRateChange?.(parseFloat(e.target.value) || 0)
                }
                className="w-14 input-field !py-0.5 !px-1 text-[11px]"
                title="Monto por día"
              />
              <span>/día</span>
            </>
          ) : (
            <span>× {formatUSD(dailyRate)}/día</span>
          )}
        </div>
        <p className="mt-1 text-xs font-medium text-content">
          = {formatUSD(earnings)}
        </p>
        {diasAsistencia === null ? (
          <p
            className="mt-1 text-[11px] text-amber-500"
            title="Sin usuario enlazado"
          >
            Sin usuario enlazado ⚠
          </p>
        ) : typeof diasAsistencia === 'number' ? (
          <p
            className="mt-1 text-[11px] text-dim"
            title="Días que marcó entrada"
          >
            {diasAsistencia === 0
              ? `No fichó ${semanaAsistencia ?? 'la semana pasada'}`
              : `Fichó ${diasAsistencia} día(s) ${semanaAsistencia ?? ''}`}
            {diasAsistencia !== daysWorked && diasAsistencia > 0 ? ' ⚠' : ''}
          </p>
        ) : null}
      </td>

      {/* Commission / Tips */}
      <td className="px-4 py-3 text-xs">
        {isWaiter ? (
          <div className="space-y-0.5">
            <p className="text-content">
              Comisión:{' '}
              <span className="font-medium text-ok">
                +{formatUSD(commissions)}
              </span>
            </p>
            <p className="text-content">
              Propina:{' '}
              <span className="font-medium text-ok">+{formatUSD(tips)}</span>
            </p>
            <Link
              href={PRIVATE_ROUTES.PAYROLL_WAITER_ORDERS(employee.id)}
              className="text-[10px] text-accent underline underline-offset-2 hover:text-accent/80 transition-colors"
              title="Ver detalle de órdenes"
            >
              {waiterOrdersLength} orden(es) — ver detalle
            </Link>
          </div>
        ) : (
          <span className="text-dim">—</span>
        )}
      </td>

      {/* Consumos */}
      <td className="px-4 py-3">
        {!employee.customerId ? (
          <span className="text-xs text-dim">Sin cuenta</span>
        ) : consumos.pendingAR.length === 0 ? (
          <span className="text-xs text-ok">Sin deudas</span>
        ) : (
          <ConsumosSection {...consumos} />
        )}
      </td>

      {/* Net USD */}
      <td className="px-4 py-3">
        <p className="text-sm font-bold text-content">
          {formatUSD(finalNetUSD)}
        </p>
        <p className="text-[10px] text-ok">{formatBs(finalNetUSD, bcvRate)}</p>
        {(adjustmentsCount > 0 || externalARCount > 0) && (
          <p className="text-[10px] text-accent">
            {adjustmentsCount + externalARCount} ajuste(s)
          </p>
        )}
      </td>

      {/* Proof */}
      <td className="px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onProofSelect(file);
            e.target.value = '';
          }}
          className="hidden"
        />
        {proofPreview ? (
          <button onClick={onProofRemove} className="text-xs text-ok underline">
            ✓ Adjunto
          </button>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs text-dim hover:text-content transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Adjuntar
          </button>
        )}
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        <div className="space-y-1">
          <button
            onClick={onPayClick}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ok text-on-brand text-xs font-medium hover:bg-ok/90 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Pagar
          </button>
          {error && (
            <p className="text-[10px] text-danger flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error.slice(0, 40)}
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}

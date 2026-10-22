'use client';
import Modal from '@/components/shared/modal';
import { useState } from 'react';
import { Budget } from '@odin6/types';
import { useAcceptBudget } from '@/hooks/useBudgets';
import { useToast } from '@/components/hooks/useToast';
import { Button } from '@/components/shared/button/Button';
import { XIcon, CheckCircle2Icon } from 'lucide-react';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import { formatearUsd } from '@/shared/utils/dinero';

const METODOS = [
  { value: 'CASH_USD', label: 'Efectivo USD' },
  { value: 'CASH_BS', label: 'Efectivo Bs' },
  { value: 'CARD', label: 'Punto de Venta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
];

interface Props {
  budget: Budget;
  onClose: () => void;
}

export default function AcceptBudgetModal({ budget, onClose }: Props) {
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState('CASH_USD');
  const [abonoReference, setAbonoReference] = useState('');
  const acceptBudget = useAcceptBudget();
  const toast = useToast();

  const abono = parseFloat(abonoAmount) || 0;
  const saldo = Math.max(0, budget.total - abono);
  const isValid = abono >= 0 && abono <= budget.total && abonoMethod;

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      const result = await acceptBudget.mutateAsync({
        id: budget.id,
        data: {
          abonoAmount: abono,
          abonoMethod,
          abonoReference: abonoReference || undefined,
        },
      });
      toast.success({
        title: 'Evento aceptado',
        description: `Cuenta por cobrar ${result.evtNumber} creada. Saldo pendiente: ${formatearUsd(saldo)}`,
      });
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al aceptar el presupuesto';
      toast.error({ title: 'Error', description: msg });
    }
  };

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/60"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-line"
    >
      <div className="flex items-center justify-between p-5 border-b border-line">
        <div className="flex items-center gap-2">
          <CheckCircle2Icon className="h-5 w-5 text-ok" />
          <h2 className="font-semibold text-content text-lg">
            Marcar como Aceptado
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-dim hover:text-content transition-colors"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-elevated/50 rounded-xl p-3 text-sm">
          <p className="font-medium text-content">{budget.eventName}</p>
          <p className="text-dim">{budget.customerName}</p>
          <p className="text-dim">
            {budget.eventDate
              ? new Date(budget.eventDate).toLocaleDateString('es-VE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })
              : '—'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-content mb-1">
            Monto del abono (USD)
          </label>
          <input
            type="number"
            min="0"
            max={budget.total}
            step="0.01"
            value={abonoAmount}
            onChange={(e) => setAbonoAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-content focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {abono > budget.total && (
            <p className="text-danger text-xs mt-1">
              El abono no puede superar el total.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-content mb-1">
            Método de pago del abono
          </label>
          <select
            value={abonoMethod}
            onChange={(e) => setAbonoMethod(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-content focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {METODOS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-content mb-1">
            Referencia <span className="text-dim">(opcional)</span>
          </label>
          <input
            type="text"
            value={abonoReference}
            onChange={(e) => setAbonoReference(e.target.value)}
            placeholder="Número de transacción, voucher..."
            className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-content focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <div className="bg-ok/10 border border-ok/20 rounded-xl p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-dim">Total presupuesto</span>
            <span className="font-medium text-content">
              {formatearUsd(budget.total)}
            </span>
          </div>
          <FilaDeResumen
            etiqueta="Abono"
            classNameEtiqueta="text-dim"
            valor={<>- {formatearUsd(abono)}</>}
            classNameValor="font-medium text-ok"
          />
          <div className="flex justify-between border-t border-ok/20 pt-1">
            <span className="font-semibold text-content">
              Saldo pendiente (EVT)
            </span>
            <span className="font-bold text-content">
              {formatearUsd(saldo)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 p-5 border-t border-line">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          className="flex-1 bg-ok hover:bg-ok/90 text-on-brand"
          onClick={handleSubmit}
          disabled={!isValid || acceptBudget.isPending}
        >
          {acceptBudget.isPending ? 'Procesando...' : 'Confirmar'}
        </Button>
      </div>
    </Modal>
  );
}

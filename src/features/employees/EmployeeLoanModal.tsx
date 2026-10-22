'use client';
import Modal from '@/components/shared/modal';
import { useEffect, useState } from 'react';
import { Employee } from '@odin6/types';
import {
  useEmployeeLoans,
  useCreateEmployeeLoan,
  useUpdateEmployeeLoan,
} from '@/hooks/useEmployeeLoans';
import {
  HandCoins,
  XIcon,
  Loader2,
  Plus,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatearUsd, formatearBs } from '@/shared/utils/dinero';

interface EmployeeLoanModalProps {
  employee: Employee;
  onClose: () => void;
}

export default function EmployeeLoanModal({
  employee,
  onClose,
}: EmployeeLoanModalProps) {
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const { data: loans = [], isLoading } = useEmployeeLoans({
    employeeId: employee.id,
  });
  const createLoan = useCreateEmployeeLoan();
  const updateLoan = useUpdateEmployeeLoan();

  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [bcvRate, setBcvRate] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    fetch('/api/bcv-rate')
      .then((r) => r.json())
      .then((d: { success?: boolean; rate?: number }) => {
        if (d.success && d.rate) setBcvRate(d.rate);
      })
      .catch(() => {});
  }, []);

  const amountNum = parseFloat(amount);
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;

  const handleCreate = async () => {
    if (!validAmount || !concept.trim()) return;
    setError(null);
    try {
      await createLoan.mutateAsync({
        employeeId: employee.id,
        amount: Math.round(amountNum * 100) / 100,
        concept: concept.trim(),
        ...(bcvRate > 0 ? { bcvRateAtLoan: bcvRate } : {}),
      });
      setAmount('');
      setConcept('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al registrar el préstamo',
      );
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('¿Anular este préstamo? No se descontará en nómina.'))
      return;
    await updateLoan.mutateAsync({ id, data: { status: 'cancelled' } });
  };

  const pending = loans.filter(
    (l) => l.status === 'pending' || l.status === 'partial',
  );
  const pendingTotal = pending.reduce(
    (s, l) => s + (l.amount - (l.paidAmount ?? 0)),
    0,
  );

  if (typeof document === 'undefined') return null;
  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/60"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-line max-h-[90vh] flex flex-col"
    >
      <div className="flex items-center justify-between p-5 border-b border-line">
        <div>
          <h2 className="font-semibold text-content flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-accent" />
            Préstamos
          </h2>
          <p className="text-xs text-dim">{fullName}</p>
        </div>
        <button onClick={onClose} className="text-dim hover:text-content">
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto">
        {/* Nuevo préstamo */}
        <div className="bg-elevated/40 rounded-xl p-3.5 space-y-2.5">
          <p className="text-xs font-semibold text-content">
            Registrar préstamo (USD)
          </p>
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Concepto (ej: adelanto, préstamo personal)"
            className="input-field !py-2 !px-2.5 text-sm w-full"
          />
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim text-sm">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Monto"
                className="input-field !py-2 !pl-6 !pr-2.5 text-sm w-full"
              />
            </div>
            <button
              onClick={() => void handleCreate()}
              disabled={!validAmount || !concept.trim() || createLoan.isPending}
              className="px-4 py-2 rounded-xl bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
            >
              {createLoan.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Registrar
            </button>
          </div>
          {validAmount && bcvRate > 0 && (
            <p className="text-xs text-ok">
              Equivale a {formatearBs(amountNum * bcvRate)}{' '}
              <span className="text-dim">(tasa BCV {bcvRate.toFixed(2)})</span>
            </p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <p className="text-[11px] text-dim">
            El préstamo aparecerá automáticamente como deducción al pagar la
            nómina de {employee.firstName}.
          </p>
        </div>

        {/* Lista de préstamos */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : loans.length === 0 ? (
          <p className="text-sm text-dim text-center py-4">
            Sin préstamos registrados
          </p>
        ) : (
          <div className="space-y-1.5">
            {pending.length > 0 && (
              <div className="flex justify-between text-xs font-medium px-1">
                <span className="text-dim">
                  Saldo pendiente ({pending.length})
                </span>
                <span className="text-danger">
                  {formatearUsd(pendingTotal)}
                  {bcvRate > 0 && (
                    <span className="text-dim font-normal ml-1">
                      ({formatearBs(pendingTotal * bcvRate)})
                    </span>
                  )}
                </span>
              </div>
            )}
            {loans.map((loan) => {
              const saldo = loan.amount - (loan.paidAmount ?? 0);
              const hasHistory = (loan.paymentHistory?.length ?? 0) > 0;
              const isExpanded = expandedHistoryId === loan.id;

              return (
                <div
                  key={loan.id}
                  className={`rounded-lg border p-2.5 space-y-1.5 ${
                    loan.status === 'pending'
                      ? 'border-accent/30 bg-accent/5'
                      : loan.status === 'partial'
                        ? 'border-brand/30 bg-brand/5'
                        : 'border-line/50 bg-elevated/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-content font-medium truncate">
                        {loan.concept}
                      </p>
                      <p className="text-[10px] text-dim">
                        {new Date(loan.createdAt).toLocaleDateString('es-VE')}
                        {loan.status === 'partial' && (
                          <span className="text-brand ml-1.5">
                            Parcialmente abonado
                          </span>
                        )}
                        {loan.status === 'deducted' && (
                          <span className="text-ok ml-1.5 inline-flex items-center gap-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            saldado
                            {loan.deductedAt &&
                              ` el ${new Date(loan.deductedAt).toLocaleDateString('es-VE')}`}
                          </span>
                        )}
                        {loan.status === 'cancelled' && (
                          <span className="text-dim ml-1.5">anulado</span>
                        )}
                      </p>
                    </div>
                    {loan.status === 'pending' && (
                      <button
                        onClick={() => void handleCancel(loan.id)}
                        className="text-dim hover:text-danger flex-shrink-0"
                        title="Anular préstamo"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Desglose: original, abonado, saldo */}
                  <div className="grid grid-cols-3 gap-2 bg-surface/50 rounded-lg p-1.5">
                    <div>
                      <p className="text-[10px] text-dim uppercase tracking-wider">
                        Original
                      </p>
                      <p className="text-xs font-semibold text-content">
                        {formatearUsd(loan.amount)}
                      </p>
                    </div>
                    {(loan.paidAmount ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] text-dim uppercase tracking-wider">
                          Abonado
                        </p>
                        <p className="text-xs font-semibold text-ok">
                          {formatearUsd(loan.paidAmount ?? 0)}
                        </p>
                      </div>
                    )}
                    {saldo > 0 && (
                      <div>
                        <p className="text-[10px] text-dim uppercase tracking-wider">
                          Saldo
                        </p>
                        <p className="text-xs font-semibold text-danger">
                          {formatearUsd(saldo)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Histórico de abonos (acordeón) */}
                  {hasHistory && (
                    <button
                      onClick={() =>
                        setExpandedHistoryId(isExpanded ? null : loan.id)
                      }
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-content hover:bg-black/10 rounded transition-colors"
                    >
                      <span className="font-medium">
                        Histórico de abonos ({loan.paymentHistory?.length ?? 0})
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                    </button>
                  )}

                  {/* Desglose del histórico */}
                  {isExpanded && hasHistory && (
                    <div className="space-y-1 border-t border-line/30 pt-1.5">
                      {loan.paymentHistory?.map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 px-2 py-1 text-[11px] bg-black/5 rounded"
                        >
                          <span className="text-dim">
                            {entry.date
                              ? new Date(entry.date).toLocaleDateString('es-VE')
                              : 'Fecha no registrada'}
                          </span>
                          <span className="font-semibold text-ok flex-shrink-0">
                            +{formatearUsd(entry.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-line">
        <button
          onClick={onClose}
          className="w-full px-3 py-2 rounded-xl border border-line text-sm font-medium text-content hover:bg-elevated transition-colors"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

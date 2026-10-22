'use client';
import Modal from '@/components/shared/modal';
import { XIcon, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { PayrollAdjustment } from '@odin6/types';
import { AccountReceivable } from '@odin6/types';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import { formatUSD, formatBs } from '../utils/formatters';
import { ProofSection } from './ProofSection';
import { LoansSection } from './LoansSection';
import { AdjustmentsSection } from './AdjustmentsSection';
import { ExternalARSection } from './ExternalARSection';

interface ConfirmModalState {
  daysWorked: number;
  dailyRate: number;
  earnings: number;
  commissions: number;
  tips: number;
  consumosSeleccionados: Array<{ id: string; concepto: string; monto: number }>;
  finalNetUSD: number;
  grossUSD: number;
  adjustments: PayrollAdjustment[];
  effectiveAdjustments: PayrollAdjustment[];
  draftAdjustment: PayrollAdjustment | null;
  selectedLoans: Array<{
    id: string;
    concept: string;
    amount: number;
    paidAmount?: number;
  }>;
  loanAbonoMap: Map<string, number>;
  externalAR: AccountReceivable[];
  externalPendingOf: (ar: AccountReceivable) => number;
  externalTotal: number;
  pendingLoans: Array<{
    id: string;
    concept: string;
    amount: number;
    paidAmount?: number;
    createdAt: string | Date;
  }>;
  proofFile: File | null;
  proofPreview: string | null;
}

interface PayrollConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  state: ConfirmModalState;
  bcvRate: number;
  adjType: 'ADDITION' | 'DEDUCTION';
  onAdjTypeChange: (type: 'ADDITION' | 'DEDUCTION') => void;
  adjConcept: string;
  onAdjConceptChange: (concept: string) => void;
  adjAmount: string;
  onAdjAmountChange: (amount: string) => void;
  adjCurrency: 'USD' | 'BS';
  onAdjCurrencyChange: (currency: 'USD' | 'BS') => void;
  draftUsd: number;
  draftMissingConcept: boolean;
  onAddAdjustment: () => void;
  onRemoveAdjustment: (index: number) => void;
  isAddAdjDisabled: boolean;
  loanAbonoMap: Map<string, number>;
  onLoanAbonoChange: (loanId: string, amount: number) => void;
  externalARState: {
    showLinkAR: boolean;
    onShowLinkARChange: (show: boolean) => void;
    arSearch: string;
    onArSearchChange: (search: string) => void;
    externalCandidates: AccountReceivable[];
    onLinkAR: (ar: AccountReceivable) => void;
    onUnlinkAR: (id: string) => void;
    externalItems: Record<string, string[]>;
  };
  proofFile: File | null;
  proofPreview: string | null;
  onProofAccept: (file: File) => void;
  onProofRemove: () => void;
  isProcessing: boolean;
  onConfirmPay: () => void;
}

export function PayrollConfirmModal({
  isOpen,
  onClose,
  employeeName,
  state,
  bcvRate,
  adjType,
  onAdjTypeChange,
  adjConcept,
  onAdjConceptChange,
  adjAmount,
  onAdjAmountChange,
  adjCurrency,
  onAdjCurrencyChange,
  draftUsd,
  draftMissingConcept,
  onAddAdjustment,
  onRemoveAdjustment,
  isAddAdjDisabled,
  loanAbonoMap,
  onLoanAbonoChange,
  externalARState,
  proofFile,
  proofPreview,
  onProofAccept,
  onProofRemove,
  isProcessing,
  onConfirmPay,
}: PayrollConfirmModalProps) {
  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

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
        <h2 className="font-semibold text-content">Confirmar pago</h2>
        <button onClick={onClose} className="text-dim hover:text-content">
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 space-y-3 overflow-y-auto">
        <p className="text-sm text-content font-medium">{employeeName}</p>

        {/* Summary box */}
        <div className="bg-elevated/50 rounded-xl p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-dim">
              {state.daysWorked} día(s) × {formatUSD(state.dailyRate)}
            </span>
            <span className="font-medium">{formatUSD(state.earnings)}</span>
          </div>
          {state.commissions > 0 && (
            <div className="flex justify-between">
              <span className="text-dim">Comisiones</span>
              <span className="font-medium">
                +{formatUSD(state.commissions)}
              </span>
            </div>
          )}
          {state.tips > 0 && (
            <FilaDeResumen
              etiqueta="Propinas"
              classNameEtiqueta="text-dim"
              valor={<>+{formatUSD(state.tips)}</>}
              classNameValor="font-medium"
            />
          )}
          {state.consumosSeleccionados.map((c) => (
            <div
              key={`consumo-${c.id}`}
              className="flex justify-between items-center gap-2"
            >
              <span className="text-dim truncate">Consumo: {c.concepto}</span>
              <span className="text-danger font-medium flex-shrink-0">
                -{formatUSD(c.monto)}
              </span>
            </div>
          ))}
          {state.selectedLoans.map((loan) => {
            const abono = loanAbonoMap.get(loan.id) ?? 0;
            const esParcial = abono < loan.amount - (loan.paidAmount ?? 0);
            return (
              <div
                key={`loan-${loan.id}`}
                className="flex justify-between items-center gap-2"
              >
                <span className="text-dim truncate">
                  {esParcial ? 'Abono préstamo' : 'Préstamo'}: {loan.concept}
                </span>
                <span className="text-danger font-medium flex-shrink-0">
                  -{formatUSD(abono)}
                </span>
              </div>
            );
          })}
          {state.adjustments.map((adj, i) => (
            <div
              key={`adj-${i}`}
              className="flex justify-between items-center gap-2"
            >
              <span className="text-dim truncate">
                {adj.concept}
                {adj.currency === 'BS' && (
                  <span className="text-[10px] ml-1">
                    (Bs {adj.amount.toLocaleString('es-VE')})
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <span
                  className={
                    adj.type === 'ADDITION'
                      ? 'text-ok font-medium'
                      : 'text-danger font-medium'
                  }
                >
                  {adj.type === 'ADDITION' ? '+' : '-'}
                  {formatUSD(adj.amountUsd)}
                </span>
                <button
                  onClick={() =>
                    onRemoveAdjustment(state.adjustments.indexOf(adj))
                  }
                  className="text-dim hover:text-danger"
                  title="Quitar ajuste"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            </div>
          ))}
          {state.draftAdjustment && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-dim truncate italic">
                {state.draftAdjustment.concept || 'Ajuste (sin concepto)'}
                {state.draftAdjustment.currency === 'BS' && (
                  <span className="text-[10px] ml-1">
                    (Bs {state.draftAdjustment.amount.toLocaleString('es-VE')})
                  </span>
                )}
              </span>
              <span
                className={
                  state.draftAdjustment.type === 'ADDITION'
                    ? 'text-ok font-medium flex-shrink-0'
                    : 'text-danger font-medium flex-shrink-0'
                }
              >
                {state.draftAdjustment.type === 'ADDITION' ? '+' : '-'}
                {formatUSD(draftUsd)}
              </span>
            </div>
          )}
          {state.externalTotal > 0 && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-dim">
                Cuentas asumidas ({state.externalAR.length})
              </span>
              <span className="text-danger font-medium flex-shrink-0">
                -{formatUSD(state.externalTotal)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-1.5">
            <span className="font-semibold text-content">Neto a pagar</span>
            <span className="font-bold text-content">
              {formatUSD(state.finalNetUSD)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-dim">En Bs</span>
            <span className="font-bold text-ok">
              {formatBs(state.finalNetUSD, bcvRate)}
            </span>
          </div>
        </div>

        {state.finalNetUSD < 0 && (
          <p className="text-xs text-danger flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Las deducciones superan el pago. Ajusta los montos.
          </p>
        )}

        {/* Loans section */}
        <LoansSection
          pendingLoans={state.pendingLoans}
          loanAbonoMap={loanAbonoMap}
          onLoanAbonChange={onLoanAbonoChange}
          bcvRate={bcvRate}
          formatUSD={formatUSD}
          formatBs={formatBs}
        />

        {/* Adjustments section */}
        <AdjustmentsSection
          adjType={adjType}
          onAdjTypeChange={onAdjTypeChange}
          adjConcept={adjConcept}
          onAdjConceptChange={onAdjConceptChange}
          adjAmount={adjAmount}
          onAdjAmountChange={onAdjAmountChange}
          adjCurrency={adjCurrency}
          onAdjCurrencyChange={onAdjCurrencyChange}
          draftUsd={draftUsd}
          draftMissingConcept={draftMissingConcept}
          bcvRate={bcvRate}
          onAddAdjustment={onAddAdjustment}
          isAddDisabled={isAddAdjDisabled}
        />

        {/* External AR section */}
        <ExternalARSection
          externalAR={state.externalAR}
          externalItems={externalARState.externalItems}
          showLinkAR={externalARState.showLinkAR}
          onShowLinkARChange={externalARState.onShowLinkARChange}
          arSearch={externalARState.arSearch}
          onArSearchChange={externalARState.onArSearchChange}
          externalCandidates={externalARState.externalCandidates}
          onLinkAR={externalARState.onLinkAR}
          onUnlinkAR={externalARState.onUnlinkAR}
          externalPendingOf={state.externalPendingOf}
          externalTotal={state.externalTotal}
        />

        {/* Proof section */}
        <ProofSection
          proofFile={proofFile}
          proofPreview={proofPreview}
          showConfirm={isOpen}
          onProofAccept={onProofAccept}
          onProofRemove={onProofRemove}
        />
      </div>

      {/* Footer */}
      <div className="flex gap-3 p-5 border-t border-line">
        <button
          onClick={onClose}
          className="flex-1 px-3 py-2 rounded-xl border border-line text-sm font-medium text-content hover:bg-elevated transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirmPay}
          disabled={
            isProcessing || state.finalNetUSD < 0 || draftMissingConcept
          }
          className="flex-1 px-3 py-2 rounded-xl bg-ok text-on-brand text-sm font-medium hover:bg-ok/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>Confirmar pago</>
          )}
        </button>
      </div>
    </Modal>
  );
}

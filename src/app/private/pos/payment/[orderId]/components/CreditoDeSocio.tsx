'use client';

import { Award } from 'lucide-react';
import { Card } from '@/components/shared/card/card';

export interface MemberCreditInfo {
  associateNumber: string;
  nombre: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditMonthsPaid: number;
}

interface CreditoDeSocioProps {
  memberCredit: MemberCreditInfo | null;
  isLoading: boolean;
  associateNumber: string | null | undefined;
  eligibleAmount: number;
  appliedAmount: number;
  onApply: () => void;
  onRemove: () => void;
}

/** Panel de crédito de socio: cupo, monto elegible y aplicar/quitar crédito. */
export function CreditoDeSocio({
  memberCredit,
  isLoading,
  associateNumber,
  eligibleAmount,
  appliedAmount,
  onApply,
  onRemove,
}: CreditoDeSocioProps) {
  if (!(memberCredit || (associateNumber && isLoading))) return null;

  return (
    <Card className="p-3 bg-surface/90 backdrop-blur-sm border-accent">
      <div className="flex items-center gap-2 mb-2">
        <Award className="h-4 w-4 text-accent" />
        <h3 className="text-xs font-semibold text-accent">
          Crédito Socio #{associateNumber}
        </h3>
      </div>

      {isLoading && <p className="text-xs text-dim">Cargando crédito...</p>}

      {memberCredit && !isLoading && (
        <>
          <div className="text-xs text-dim mb-2">
            {memberCredit.nombre} · {memberCredit.creditMonthsPaid} mes(es) al
            día
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
            <div className="bg-accent/10 rounded-lg p-2 text-center border border-accent/20">
              <div className="font-bold text-accent">
                ${memberCredit.creditLimit.toFixed(2)}
              </div>
              <div className="text-accent">Límite</div>
            </div>
            <div className="bg-ok/15 rounded-lg p-2 text-center border border-ok/20">
              <div className="font-bold text-ok">
                ${memberCredit.creditAvailable.toFixed(2)}
              </div>
              <div className="text-ok">Disponible</div>
            </div>
          </div>

          {eligibleAmount > 0 && appliedAmount === 0 && (
            <div className="mb-2 p-2 bg-elevated rounded-lg border border-brand/20 text-xs text-brand">
              Monto elegible:{' '}
              <span className="font-bold">${eligibleAmount.toFixed(2)}</span>
            </div>
          )}

          {appliedAmount > 0 && (
            <div className="mb-2 p-2 bg-ok/15 rounded-lg border border-ok/20 text-xs text-ok flex items-center justify-between">
              <span>Crédito aplicado:</span>
              <span className="font-bold">-${appliedAmount.toFixed(2)}</span>
            </div>
          )}

          {memberCredit.creditAvailable <= 0 ? (
            <p className="text-xs text-danger text-center">
              Sin crédito disponible
            </p>
          ) : eligibleAmount <= 0 ? (
            <p className="text-xs text-dim text-center">
              No hay ítems elegibles
            </p>
          ) : appliedAmount === 0 ? (
            <button
              onClick={onApply}
              className="w-full py-1.5 bg-accent/100 hover:bg-accent text-on-brand rounded-lg text-xs font-semibold transition-all"
            >
              Aplicar ${eligibleAmount.toFixed(2)} de crédito
            </button>
          ) : (
            <button
              onClick={onRemove}
              className="w-full py-1.5 bg-elevated hover:bg-elevated text-dim rounded-lg text-xs font-medium transition-all"
            >
              Quitar crédito aplicado
            </button>
          )}
        </>
      )}
    </Card>
  );
}

'use client';

import { Card } from '@/components/shared/card/card';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import {
  calculateChangeBs as calcularVueltoBs,
  calculateChangeUsd as calcularVueltoUsd,
  hayVuelto,
  faltaPorPagarBs,
} from '@/features/pos/cobro';

interface ResumenYVueltoProps {
  totalPagado: number;
  totalPagadoBs: number;
  previousPaymentsTotal: number;
  remainingToPay: number;
  remainingInBs: number;
  bcvRate: number;
  pagoCompleto: boolean;
}

/** Resumen de lo pagado en la sesión, con vuelto o faltante (USD y Bs). */
export function ResumenYVuelto({
  totalPagado,
  totalPagadoBs,
  previousPaymentsTotal,
  remainingToPay,
  remainingInBs,
  bcvRate,
  pagoCompleto,
}: ResumenYVueltoProps) {
  if (totalPagado <= 0) return null;

  const changeBs =
    bcvRate > 0
      ? calcularVueltoBs(totalPagadoBs, remainingToPay, bcvRate)
      : (totalPagado - remainingToPay) * (bcvRate || 1);
  const changeUsd = calcularVueltoUsd(changeBs, bcvRate);
  const faltaBs = faltaPorPagarBs(remainingInBs, totalPagadoBs);

  return (
    <Card className="p-2 bg-surface/90 backdrop-blur-sm border-line">
      <div className="space-y-1">
        <FilaDeResumen
          className="items-center"
          classNameEtiqueta="text-xs font-medium text-dim"
          classNameValor="font-bold text-sm text-brand"
          etiqueta="Pagado (esta sesión):"
          valor={<>${totalPagado.toFixed(2)}</>}
        />
        {previousPaymentsTotal > 0 && (
          <FilaDeResumen
            className="items-center text-xs text-dim"
            etiqueta="+ Pagos anteriores:"
            valor={<>${previousPaymentsTotal.toFixed(2)}</>}
          />
        )}
        {hayVuelto(changeBs) && (
          <div className="border-t pt-1">
            <FilaDeResumen
              className="text-xs"
              classNameEtiqueta="text-dim"
              classNameValor="font-semibold text-ok"
              etiqueta="Cambio $:"
              valor={<>${changeUsd.toFixed(2)}</>}
            />
            <FilaDeResumen
              className="text-xs"
              classNameEtiqueta="text-dim"
              classNameValor="font-semibold text-ok"
              etiqueta="Cambio Bs:"
              valor={<>Bs. {changeBs.toFixed(2)}</>}
            />
          </div>
        )}
        {!pagoCompleto && (
          <div className="border-t pt-1">
            <FilaDeResumen
              className="text-accent"
              classNameEtiqueta="text-xs font-medium"
              classNameValor="font-bold text-xs"
              etiqueta="Falta USD:"
              valor={<>${(remainingToPay - totalPagado).toFixed(2)}</>}
            />
            <FilaDeResumen
              className="text-accent"
              classNameEtiqueta="text-xs font-medium"
              classNameValor="font-bold text-xs"
              etiqueta="Falta Bs:"
              valor={<>Bs. {faltaBs > 0 ? faltaBs.toFixed(2) : '0.00'}</>}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

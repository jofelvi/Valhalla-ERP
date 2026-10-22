'use client';

import { AlertCircle } from 'lucide-react';
import { Card } from '@/components/shared/card/card';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import { PaymentMethodEnum, PaymentStatusEnum } from '@/shared';
import { Order } from '@/modelTypes/order';

interface CobroDelMesoneroProps {
  order: Order | undefined;
  bcvRate: number;
}

const methodLabel = (m: PaymentMethodEnum) =>
  m === PaymentMethodEnum.CASH_BS
    ? 'Efec. Bs'
    : m === PaymentMethodEnum.CASH_USD
      ? 'Efec. $'
      : m === PaymentMethodEnum.PAGO_MOVIL
        ? 'P. Móvil'
        : m === PaymentMethodEnum.CARD
          ? 'Tarjeta'
          : m === PaymentMethodEnum.TRANSFER
            ? 'Transf.'
            : String(m);

/**
 * Detalle (solo lectura) del cobro que registró el mesonero, visible cuando la
 * orden está PENDING_VERIFICATION. Usa pendingPayments, o los campos directos
 * de la orden como fallback (APK vieja / DTO legacy).
 */
export function CobroDelMesonero({ order, bcvRate }: CobroDelMesoneroProps) {
  if (
    !order ||
    order.paymentStatus !== PaymentStatusEnum.PENDING_VERIFICATION
  ) {
    return null;
  }

  // Tasa efectiva: la que el mesonero usó al cobrar, o si no existe (DTO legacy
  // stripeó el campo), la tasa actual del cajero.
  const effectiveBcv = order.bcvRate ?? bcvRate;

  const pendingList =
    order.pendingPayments && order.pendingPayments.length > 0
      ? order.pendingPayments
      : order.paymentMethod
        ? [
            {
              method: order.paymentMethod,
              amount: order.total,
              amountBs:
                order.paymentAmountBs ??
                (effectiveBcv > 0 ? order.total * effectiveBcv : 0),
              reference: order.paymentReference ?? null,
              pagoMovilPhone: order.pagoMovilPhone ?? null,
              pagoMovilCedula: order.pagoMovilCedula ?? null,
              pagoMovilBanco: order.pagoMovilBanco ?? null,
              proofUrls: order.paymentProofUrls ?? null,
            },
          ]
        : [];

  if (pendingList.length === 0) return null;

  return (
    <Card className="p-3 bg-accent/15 backdrop-blur-sm border-accent/20">
      <h3 className="mb-2 text-xs font-semibold text-accent flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5" />
        Cobro registrado por el mesonero
        {order.waiterName ? ` · ${order.waiterName}` : ''}
      </h3>

      <div className="space-y-2">
        {pendingList.map((pp, idx) => {
          const isPagoMovil = pp.method === PaymentMethodEnum.PAGO_MOVIL;
          const hasPagoMovilData =
            isPagoMovil &&
            (pp.pagoMovilPhone || pp.pagoMovilCedula || pp.pagoMovilBanco);
          const proofs = pp.proofUrls ?? [];

          // Resolver montos en ambas monedas con los datos que haya.
          // pp.amount es USD; pp.amountBs es Bs. Si uno es 0 y hay tasa,
          // derivarlo del otro.
          const amountUsd =
            pp.amount && pp.amount > 0
              ? pp.amount
              : effectiveBcv > 0
                ? pp.amountBs / effectiveBcv
                : 0;
          const amountBs =
            pp.amountBs && pp.amountBs > 0
              ? pp.amountBs
              : effectiveBcv > 0
                ? (pp.amount ?? 0) * effectiveBcv
                : 0;

          return (
            <div
              key={idx}
              className="p-2 bg-surface/60 rounded-lg border border-accent/20 space-y-1.5"
            >
              {/* Header: método + monto */}
              <div className="flex items-center justify-between text-xs">
                <span className="px-1.5 py-0.5 bg-accent/15 text-accent rounded font-medium">
                  {methodLabel(pp.method)}
                </span>
                <div className="text-right">
                  <div className="font-bold text-accent">
                    ${amountUsd.toFixed(2)}
                  </div>
                  {amountBs > 0 ? (
                    <div className="text-[10px] text-dim">
                      Bs. {amountBs.toFixed(2)}
                      {!order.bcvRate ? ' · tasa actual' : ''}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Referencia */}
              {pp.reference && (
                <FilaDeResumen
                  className="text-[11px] text-dim"
                  classNameValor="font-mono text-on-brand"
                  etiqueta="Referencia:"
                  valor={<>{pp.reference}</>}
                />
              )}

              {/* Datos Pago Móvil */}
              {hasPagoMovilData && (
                <div className="pt-1.5 border-t border-accent/10 space-y-0.5 text-[11px]">
                  {pp.pagoMovilBanco && (
                    <FilaDeResumen
                      classNameEtiqueta="text-dim"
                      classNameValor="text-on-brand"
                      etiqueta="Banco:"
                      valor={<>{pp.pagoMovilBanco}</>}
                    />
                  )}
                  {pp.pagoMovilPhone && (
                    <FilaDeResumen
                      classNameEtiqueta="text-dim"
                      classNameValor="text-on-brand font-mono"
                      etiqueta="Teléfono:"
                      valor={<>{pp.pagoMovilPhone}</>}
                    />
                  )}
                  {pp.pagoMovilCedula && (
                    <FilaDeResumen
                      classNameEtiqueta="text-dim"
                      classNameValor="text-on-brand font-mono"
                      etiqueta="Cédula:"
                      valor={<>{pp.pagoMovilCedula}</>}
                    />
                  )}
                </div>
              )}

              {/* Comprobantes */}
              {proofs.length > 0 && (
                <div className="pt-1.5 border-t border-accent/10">
                  <div className="text-[11px] text-dim mb-1">
                    Comprobante{proofs.length > 1 ? 's' : ''}:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {proofs.map((url, pIdx) => (
                      <a
                        key={pIdx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-16 h-16 rounded overflow-hidden border border-accent/30 hover:border-accent transition-colors"
                        title="Ver comprobante"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Comprobante ${pIdx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {order.bcvRate && (
        <p className="text-[10px] text-accent mt-2">
          Tasa del mesonero: {order.bcvRate.toFixed(2)} Bs/$
        </p>
      )}
    </Card>
  );
}

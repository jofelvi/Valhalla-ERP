'use client';

import {
  Banknote,
  Calculator,
  CreditCard,
  DollarSign,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/shared/card/card';
import { Input } from '@/components/shared/input/input';
import { PaymentMethodEnum } from '@/shared';
import { PagoMovil } from '@/modelTypes/pagoMovil';

export interface CardPaymentEntry {
  amount: string;
  reference: string;
}

interface MetodosDePagoProps {
  selectedMethods: PaymentMethodEnum[];
  onToggleMethod: (method: PaymentMethodEnum) => void;
  paymentAmounts: Record<PaymentMethodEnum, string>;
  onAmountChange: (method: PaymentMethodEnum, value: string) => void;
  verifiedPagoMoviles: PagoMovil[];
  onOpenPagoMovil: () => void;
  cardPayments: CardPaymentEntry[];
  onUpdateCard: (
    index: number,
    field: keyof CardPaymentEntry,
    value: string,
  ) => void;
  onRemoveCard: (index: number) => void;
  onAddCard: () => void;
}

const TOGGLES: Array<{
  method: PaymentMethodEnum;
  icon: typeof Banknote;
  label: string;
}> = [
  { method: PaymentMethodEnum.CASH_BS, icon: Banknote, label: 'Efec. Bs' },
  { method: PaymentMethodEnum.CASH_USD, icon: DollarSign, label: 'Efec. $' },
  { method: PaymentMethodEnum.PAGO_MOVIL, icon: Smartphone, label: 'P. Móvil' },
  { method: PaymentMethodEnum.CARD, icon: CreditCard, label: 'Tarjeta' },
  { method: PaymentMethodEnum.TRANSFER, icon: Calculator, label: 'Transf.' },
];

/** Selector de métodos de pago (grid de toggles + inputs por método). */
export function MetodosDePago({
  selectedMethods,
  onToggleMethod,
  paymentAmounts,
  onAmountChange,
  verifiedPagoMoviles,
  onOpenPagoMovil,
  cardPayments,
  onUpdateCard,
  onRemoveCard,
  onAddCard,
}: MetodosDePagoProps) {
  return (
    <Card className="p-3 bg-surface/90 backdrop-blur-sm border-line">
      <h3 className="mb-2 text-xs font-semibold text-dim">Métodos de Pago</h3>

      {/* Grid 3x2 de botones toggle */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {TOGGLES.map(({ method, icon: Icon, label }) => (
          <button
            key={method}
            onClick={() => onToggleMethod(method)}
            className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              selectedMethods.includes(method)
                ? 'bg-brand text-on-brand shadow-sm'
                : 'bg-elevated text-dim hover:bg-elevated'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Inputs expandidos para métodos seleccionados */}
      <div className="space-y-2">
        {/* Efectivo BS */}
        {selectedMethods.includes(PaymentMethodEnum.CASH_BS) && (
          <div className="p-2 bg-elevated rounded-lg border border-line">
            <label className="text-[10px] font-medium text-dim mb-1 block">
              Efectivo Bs
            </label>
            <Input
              type="number"
              placeholder="Monto Bs"
              value={paymentAmounts[PaymentMethodEnum.CASH_BS]}
              onChange={(e) =>
                onAmountChange(PaymentMethodEnum.CASH_BS, e.target.value)
              }
              className="w-full h-8 text-xs border-line focus:border-brand"
            />
          </div>
        )}

        {/* Efectivo USD */}
        {selectedMethods.includes(PaymentMethodEnum.CASH_USD) && (
          <div className="p-2 bg-elevated rounded-lg border border-line">
            <label className="text-[10px] font-medium text-dim mb-1 block">
              Efectivo USD
            </label>
            <Input
              type="number"
              placeholder="Monto USD"
              value={paymentAmounts[PaymentMethodEnum.CASH_USD]}
              onChange={(e) =>
                onAmountChange(PaymentMethodEnum.CASH_USD, e.target.value)
              }
              className="w-full h-8 text-xs border-line focus:border-brand"
            />
          </div>
        )}

        {/* Pago Móvil */}
        {selectedMethods.includes(PaymentMethodEnum.PAGO_MOVIL) && (
          <div className="p-2 bg-elevated rounded-lg border border-line">
            <label className="text-[10px] font-medium text-dim mb-1 block">
              Pago Móvil
            </label>
            <div className="flex gap-1">
              <Input
                type="text"
                readOnly
                placeholder={
                  verifiedPagoMoviles.length > 0
                    ? `${verifiedPagoMoviles.length} pago(s)`
                    : 'Agregar'
                }
                value={
                  verifiedPagoMoviles.length > 0
                    ? `${verifiedPagoMoviles.length} verificado(s)`
                    : ''
                }
                className="flex-1 h-8 text-xs border-line bg-surface cursor-pointer"
                onClick={onOpenPagoMovil}
              />
              <button
                onClick={onOpenPagoMovil}
                className="px-2 bg-brand hover:bg-brand text-on-brand rounded-lg text-xs font-bold"
                title="Agregar"
              >
                +
              </button>
            </div>
            {/* Historial PM inline compacto */}
            {verifiedPagoMoviles.length > 0 && (
              <div className="mt-2 space-y-1">
                {verifiedPagoMoviles.map((pm, idx) => {
                  const isOk = pm.status === 'verified';
                  return (
                    <div
                      key={pm.id || idx}
                      className={`flex items-center justify-between text-xs p-1.5 rounded ${isOk ? 'bg-ok/15 text-ok' : 'bg-accent/10 text-accent'}`}
                    >
                      <span className="font-medium">
                        Ref: {pm.referenceNumber}
                      </span>
                      <span className="font-semibold">
                        Bs.{pm.expectedAmountBS?.toFixed(2) || 'N/A'} → $
                        {pm.expectedAmountUSD?.toFixed(2) ||
                          pm.expectedAmount?.toFixed(2) ||
                          '?'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tarjeta — Lista dinámica (Fase 3) */}
        {selectedMethods.includes(PaymentMethodEnum.CARD) && (
          <div className="p-2 bg-elevated rounded-lg border border-line space-y-2">
            <label className="text-[10px] font-medium text-dim block">
              Tarjeta(s) Bs
            </label>
            {cardPayments.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Input
                  type="number"
                  placeholder="Monto Bs"
                  value={entry.amount}
                  onChange={(e) => onUpdateCard(idx, 'amount', e.target.value)}
                  className="flex-1 h-8 text-xs border-line focus:border-brand"
                />
                <Input
                  type="text"
                  placeholder="Ref."
                  value={entry.reference}
                  onChange={(e) =>
                    onUpdateCard(idx, 'reference', e.target.value)
                  }
                  className="w-24 h-8 text-xs border-line focus:border-brand"
                />
                {cardPayments.length > 1 && (
                  <button
                    onClick={() => onRemoveCard(idx)}
                    className="p-1 text-danger hover:text-danger hover:bg-danger/10 rounded transition-colors"
                    title="Eliminar tarjeta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={onAddCard}
              className="w-full flex items-center justify-center gap-1 py-1.5 border-2 border-dashed border-line text-brand hover:border-brand hover:text-dim rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Agregar otra tarjeta</span>
            </button>
          </div>
        )}

        {/* Transferencia */}
        {selectedMethods.includes(PaymentMethodEnum.TRANSFER) && (
          <div className="p-2 bg-elevated rounded-lg border border-line">
            <label className="text-[10px] font-medium text-dim mb-1 block">
              Transferencia USD
            </label>
            <Input
              type="number"
              placeholder="Monto USD"
              value={paymentAmounts[PaymentMethodEnum.TRANSFER]}
              onChange={(e) =>
                onAmountChange(PaymentMethodEnum.TRANSFER, e.target.value)
              }
              className="w-full h-8 text-xs border-line focus:border-brand"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

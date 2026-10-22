import { useNombreApp } from '@/shared/config';
import { CheckCircle2 } from 'lucide-react';
import { PaymentMethodEnum } from '@/shared/types/enumShared';
import { formatearBs, formatearUsdConMiles } from '@/shared/utils/dinero';

const paymentMethodLabels: Record<PaymentMethodEnum, string> = {
  [PaymentMethodEnum.CASH_USD]: 'Efectivo USD',
  [PaymentMethodEnum.CASH_BS]: 'Efectivo Bs',
  [PaymentMethodEnum.TRANSFER]: 'Transferencia',
  [PaymentMethodEnum.PAGO_MOVIL]: 'Pago Movil',
  [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: 'Pago Movil Manual',
  [PaymentMethodEnum.CARD]: 'Tarjeta',
  [PaymentMethodEnum.MIXED]: 'Mixto',
  [PaymentMethodEnum.PENDING]: 'Pendiente',
  [PaymentMethodEnum.PAYROLL_DEDUCTION]: 'Descuento de Nómina',
};

interface SubmittedStateProps {
  invoiceNumber: string;
  amountUsd: string;
  amountBs: string;
  method: PaymentMethodEnum;
}

export function SubmittedState({
  invoiceNumber,
  amountUsd,
  amountBs,
  method,
}: SubmittedStateProps) {
  const nombre = useNombreApp();
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-elevated flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-ok rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-12 h-12 text-ok" />
        </div>
        <h1 className="text-2xl font-bold text-content mb-2">
          ¡Reporte enviado!
        </h1>
        <p className="text-dim mb-6">
          Recibimos tu reporte de pago. El equipo de {nombre} lo
          verificara y se pondra en contacto contigo.
        </p>
        <div className="bg-emerald-50 rounded-xl p-4 text-left text-sm space-y-1">
          <p className="text-dim">
            <span className="font-semibold text-content">Factura:</span>{' '}
            #{invoiceNumber}
          </p>
          <p className="text-dim">
            <span className="font-semibold text-content">Monto:</span>{' '}
            {formatearUsdConMiles(parseFloat(amountUsd))}
            {amountBs && ` · ${formatearBs(parseFloat(amountBs))}`}
          </p>
          <p className="text-dim">
            <span className="font-semibold text-content">Metodo:</span>{' '}
            {paymentMethodLabels[method]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 text-sm text-brand hover:text-brand font-semibold underline"
        >
          Reportar otro pago
        </button>
      </div>
    </div>
  );
}

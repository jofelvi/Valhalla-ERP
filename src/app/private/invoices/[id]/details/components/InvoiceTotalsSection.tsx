'use client';
import { Invoice } from '@odin6/types';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

interface InvoiceTotalsSectionProps {
  invoice: Invoice;
  totalPaid: number;
  pendingBalance: number;
}

export const InvoiceTotalsSection: React.FC<InvoiceTotalsSectionProps> = ({
  invoice,
  totalPaid,
  pendingBalance,
}) => {
  return (
    <div className="bg-gradient-to-br from-brand/5 to-elevated p-6 rounded-xl border border-brand/10">
      <div className="space-y-3">
        <div className="flex justify-between text-dim">
          <span>Subtotal</span>
          <span className="font-semibold">
            ${(invoice.subtotal || 0).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-dim">
          <span>
            Impuestos (
            {invoice.subtotal
              ? ((invoice.tax / invoice.subtotal) * 100).toFixed(0)
              : '0'}
            %)
          </span>
          <span className="font-semibold">
            ${(invoice.tax || 0).toFixed(2)}
          </span>
        </div>
        <div className="border-t border-line pt-3">
          <FilaDeResumen
            className="text-xl font-bold text-content"
            etiqueta="Total Factura"
            valor={<>${(invoice.total || 0).toFixed(2)}</>}
          />
        </div>
        <div className="border-t border-line pt-3 mt-3">
          <FilaDeResumen
            className="text-lg font-semibold text-ok"
            etiqueta="Total Pagado"
            valor={<>${totalPaid.toFixed(2)}</>}
          />
          {pendingBalance > 0 && (
            <FilaDeResumen
              className="text-lg font-semibold text-danger mt-2"
              etiqueta="Saldo Pendiente"
              valor={<>${pendingBalance.toFixed(2)}</>}
            />
          )}
        </div>
      </div>
    </div>
  );
};

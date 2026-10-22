import Link from 'next/link';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { ArrowLeft, FileText, Eye, Pencil } from 'lucide-react';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { Order } from '@/modelTypes/order';
import { Customer } from '@/modelTypes/customer';
import { Invoice } from '@/modelTypes/invoice';
import { getStatusBadgeLabel, getStatusBadgeVariant } from '../utils';
import PrintPrecuentaButton from '@/features/accountsReceivable/PrintPrecuentaButton';
import PDFDownloadButton from '@/features/invoices/PDFDownloadButton';
import ShareWhatsAppButton from '@/features/accountsReceivable/ShareWhatsAppButton';
import RecordPaymentButton from '@/features/accountsReceivable/RecordPaymentButton';
import UnmergeButton from '@/features/accountsReceivable/UnmergeButton';
import WhatsappStatusBadge from '@/features/accountsReceivable/WhatsappStatusBadge';

interface HeaderSectionProps {
  accountReceivable: AccountReceivable;
  firstOrder: Order | undefined;
  mergedOrder: Order | undefined;
  billedTotal: number;
  fallbackInvoice: Invoice | null;
  customer: Customer | null | undefined;
  id: string;
}

export function HeaderSection({
  accountReceivable,
  firstOrder,
  mergedOrder,
  billedTotal,
  fallbackInvoice,
  customer,
  id,
}: HeaderSectionProps) {
  return (
    <div className="bg-surface/90 backdrop-blur-sm rounded-2xl border border-line/50 shadow-lg p-4 sm:p-5 mb-6">
      {/* Fila superior: volver + titulo + estado */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/private/accounts-receivable">
          <Button variant="ghost" size="sm" className="shrink-0 px-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 shrink-0">
          <FileText className="h-5 w-5 text-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent truncate">
            #{accountReceivable.invoiceNumber}
          </h1>
          <p className="text-brand/80 text-xs">
            {accountReceivable.customerName} · Cuenta por cobrar
          </p>
        </div>
        <div className="shrink-0">
          <Badge variant={getStatusBadgeVariant(accountReceivable.status)}>
            {getStatusBadgeLabel(accountReceivable.status)}
          </Badge>
        </div>
      </div>

      {/* Separador */}
      <div className="border-t border-line/50 mb-3" />

      {/* Acciones uniformes */}
      <div className="flex flex-wrap gap-2 [&_button]:h-9 [&_button]:text-xs [&_button]:font-medium">
        {firstOrder && (
          <Link href={`/private/pos/receipt/${firstOrder.id}`}>
            <Button variant="outline" size="sm">
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Ver Factura
            </Button>
          </Link>
        )}
        {mergedOrder && (
          <PrintPrecuentaButton
            order={mergedOrder}
            customerName={accountReceivable.customerName}
          />
        )}
        {mergedOrder && fallbackInvoice && (
          <PDFDownloadButton
            invoice={fallbackInvoice}
            customer={customer}
            size="sm"
            showPreview={false}
          />
        )}
        {mergedOrder && fallbackInvoice && (
          <ShareWhatsAppButton
            invoice={fallbackInvoice}
            customer={customer}
            phone={customer?.phone}
            accountId={accountReceivable.id}
          />
        )}
        <RecordPaymentButton
          accountId={id}
          orderId={accountReceivable.orderId ?? null}
          amount={billedTotal}
          paidAmount={accountReceivable.paidAmount}
        />
        <Link href={`/private/accounts-receivable/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Editar
          </Button>
        </Link>
        {accountReceivable.isConsolidated &&
          accountReceivable.mergedAccountIds && (
            <UnmergeButton
              accountId={accountReceivable.id}
              mergedCount={accountReceivable.mergedAccountIds.length}
            />
          )}
      </div>

      {/* Estado del ultimo envio WhatsApp (si existe) */}
      <div className="mt-3">
        <WhatsappStatusBadge accountId={id} />
      </div>
    </div>
  );
}

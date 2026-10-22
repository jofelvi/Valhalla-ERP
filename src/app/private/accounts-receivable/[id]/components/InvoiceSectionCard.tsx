import { Card, CardContent } from '@/components/shared/card/card';
import { FileText } from 'lucide-react';
import InvoiceReadOnlyView from '@/features/invoices/InvoiceReadOnlyView';
import { AccountReceivable } from '@/modelTypes/accountReceivable';

interface InvoiceSectionCardProps {
  accountReceivable: AccountReceivable;
  invoiceDetails:
    | Parameters<typeof InvoiceReadOnlyView>[0]['invoiceDetails']
    | null;
}

export function InvoiceSectionCard({
  accountReceivable,
  invoiceDetails,
}: InvoiceSectionCardProps) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
          <FileText className="h-4 w-4 text-accent" />
        </div>
        <h2 className="text-lg font-bold text-content">Factura Asociada</h2>
      </div>
      {invoiceDetails ? (
        <InvoiceReadOnlyView invoiceDetails={invoiceDetails} />
      ) : (
        <Card className="bg-surface/90 backdrop-blur-sm border-line/50 shadow-md hover:shadow-md hover:-translate-y-0">
          <CardContent className="py-10 text-center">
            <div className="w-14 h-14 bg-elevated border border-line rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="h-7 w-7 text-dim" />
            </div>
            <p className="text-dim font-medium">
              No se encontro una factura asociada
            </p>
            <p className="text-brand text-sm mt-1">
              Factura #{accountReceivable.invoiceNumber}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

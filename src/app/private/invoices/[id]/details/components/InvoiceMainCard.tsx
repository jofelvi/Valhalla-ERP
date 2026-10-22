'use client';
import { FileText } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { InvoiceDetailData } from '../types';
import { CustomerInfoSection } from './CustomerInfoSection';
import { OrderItemsTable } from './OrderItemsTable';
import { InvoiceTotalsSection } from './InvoiceTotalsSection';
import { getStatusVariant, getStatusLabel } from '../utils';

interface InvoiceMainCardProps {
  data: InvoiceDetailData;
  isFullyPaid: boolean;
  pendingBalance: number;
}

export const InvoiceMainCard: React.FC<InvoiceMainCardProps> = ({
  data,
  isFullyPaid,
  pendingBalance,
}) => {
  const { invoice, customer, user, enrichedItems, totalPaid } = data;

  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span className="text-content flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Factura #{invoice.invoiceNumber || invoice.id}
          </span>
          <div className="flex gap-2">
            <Badge variant={getStatusVariant(invoice.status)}>
              {getStatusLabel(invoice.status)}
            </Badge>
            {isFullyPaid ? (
              <Badge variant="success">Pagada Completamente</Badge>
            ) : (
              <Badge variant="warning">
                Pendiente: ${pendingBalance.toFixed(2)}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <CustomerInfoSection
          invoice={invoice}
          customer={customer}
          user={user}
        />
        <OrderItemsTable items={enrichedItems} />
        <InvoiceTotalsSection
          invoice={invoice}
          totalPaid={totalPaid}
          pendingBalance={pendingBalance}
        />
      </CardContent>
    </Card>
  );
};

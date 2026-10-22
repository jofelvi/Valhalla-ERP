'use client';
import { InvoiceDetailData, PaymentMethodSummary } from '../types';
import { DateInfoCard } from './DateInfoCard';
import { RelatedOrderCard } from './RelatedOrderCard';
import { PaymentMethodsCard } from './PaymentMethodsCard';
import { NotesCard } from './NotesCard';

interface SidePanelProps {
  data: InvoiceDetailData;
  paymentMethodsSummary: PaymentMethodSummary[];
}

export const SidePanel: React.FC<SidePanelProps> = ({
  data,
  paymentMethodsSummary,
}) => {
  const { invoice, order, totalPaid } = data;

  return (
    <div className="space-y-6">
      <DateInfoCard invoice={invoice} />

      {order && <RelatedOrderCard order={order} />}

      <PaymentMethodsCard
        payments={paymentMethodsSummary}
        totalPaid={totalPaid}
      />

      <NotesCard notes={invoice.notes || ''} />
    </div>
  );
};

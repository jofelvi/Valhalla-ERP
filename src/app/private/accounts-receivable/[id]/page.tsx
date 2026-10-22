'use client';

import { use, useMemo } from 'react';
import { buildConsolidatedInvoiceItems } from '@/features/accountsReceivable/consolidatedInvoiceItems';
import { useAccountReceivedDetails } from './hooks';
import {
  HeaderSection,
  SummaryStats,
  PaymentProgressCard,
  AccountDetailsCard,
  OrdersCard,
  PaymentHistoryCard,
  CustomerInfoCard,
  InvoiceSectionCard,
} from './components';
import {
  calculateMergedOrder,
  calculateBilledTotal,
  calculatePendingAmount,
  calculateIsOverdue,
  calculateProgressPercent,
  buildFallbackInvoice,
} from './utils';

interface AccountReceivableDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default function AccountReceivableDetailsPage({
  params,
}: AccountReceivableDetailsPageProps) {
  const { id } = use(params);

  const { accountReceivable, customer, orders, accountPayments, isLoading } =
    useAccountReceivedDetails(id || '');

  // Estado derivado: cálculos que no requieren estado adicional
  const mergedOrder = useMemo(() => calculateMergedOrder(orders), [orders]);

  const billedTotal = useMemo(
    () => calculateBilledTotal(mergedOrder, accountReceivable?.amount ?? 0),
    [mergedOrder, accountReceivable?.amount],
  );

  const pendingAmount = useMemo(
    () =>
      calculatePendingAmount(billedTotal, accountReceivable?.paidAmount ?? 0),
    [billedTotal, accountReceivable?.paidAmount],
  );

  const isOverdue = useMemo(
    () =>
      accountReceivable
        ? calculateIsOverdue(accountReceivable.dueDate, pendingAmount)
        : false,
    [accountReceivable, pendingAmount],
  );

  const progressPercent = useMemo(
    () =>
      calculateProgressPercent(billedTotal, accountReceivable?.paidAmount ?? 0),
    [billedTotal, accountReceivable?.paidAmount],
  );

  // Items para PDF
  const invoiceItems = useMemo(
    () =>
      accountReceivable
        ? buildConsolidatedInvoiceItems(
            orders,
            accountReceivable.paidAmount ?? 0,
          )
        : [],
    [orders, accountReceivable],
  );

  // Factura fallback para componentes
  const fallbackInvoice = useMemo(() => {
    if (!accountReceivable) return null;
    return buildFallbackInvoice(
      accountReceivable,
      mergedOrder,
      billedTotal,
      invoiceItems,
    );
  }, [accountReceivable, mergedOrder, billedTotal, invoiceItems]);

  const firstOrder = orders[0];

  if (isLoading || !accountReceivable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-content">
            Cargando cuenta...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <HeaderSection
          accountReceivable={accountReceivable}
          firstOrder={firstOrder}
          mergedOrder={mergedOrder}
          billedTotal={billedTotal}
          fallbackInvoice={fallbackInvoice}
          customer={customer}
          id={id}
        />

        {/* Summary Stats */}
        <SummaryStats
          accountReceivable={accountReceivable}
          billedTotal={billedTotal}
          pendingAmount={pendingAmount}
          isOverdue={isOverdue}
        />

        {/* Payment Progress */}
        <PaymentProgressCard
          progressPercent={progressPercent}
          paidAmount={accountReceivable.paidAmount}
          pendingAmount={pendingAmount}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Account Details */}
          <div className="lg:col-span-2 space-y-6">
            <AccountDetailsCard
              accountReceivable={accountReceivable}
              isOverdue={isOverdue}
            />

            <OrdersCard orders={orders} />

            <PaymentHistoryCard payments={accountPayments ?? []} />
          </div>

          {/* Right Column: Customer Info */}
          <div className="space-y-6">
            <CustomerInfoCard
              accountReceivable={accountReceivable}
              customer={customer}
            />
          </div>
        </div>

        {/* Factura Asociada — modo lectura */}
        <InvoiceSectionCard
          accountReceivable={accountReceivable}
          invoiceDetails={null}
        />
      </div>
    </div>
  );
}

'use client';
import { useParams } from 'next/navigation';
import GenerateInvoiceModal from '@/features/budgets/GenerateInvoiceModal';
import Loader from '@/components/shared/Loader/Loader';
import {
  BudgetHeader,
  BudgetItemsCard,
  BudgetNotesCard,
  BudgetClientInfoCard,
  BudgetEventInfoCard,
} from './components';
import { useBudgetDetail } from './hooks';

export default function BudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const { id: budgetId } = params;

  const {
    budget,
    isLoading,
    isUpdating,
    showStatusMenu,
    showGenerateInvoice,
    setShowStatusMenu,
    setShowGenerateInvoice,
    handleStatusChange,
    handleDownloadPDF,
    handleDownloadAcuse,
  } = useBudgetDetail(budgetId);

  if (isLoading) {
    return <Loader text="Cargando presupuesto..." />;
  }

  if (!budget) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <BudgetHeader
          budget={budget}
          isUpdating={isUpdating}
          showStatusMenu={showStatusMenu}
          onToggleStatusMenu={setShowStatusMenu}
          onStatusChange={handleStatusChange}
          onDownloadPDF={handleDownloadPDF}
          onDownloadAcuse={handleDownloadAcuse}
          onGenerateInvoice={() => setShowGenerateInvoice(true)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Items & Totals */}
          <div className="lg:col-span-2 space-y-6">
            <BudgetItemsCard budget={budget} />
            <BudgetNotesCard notes={budget.notes} />
          </div>

          {/* Right Column: Client & Event Info */}
          <div className="space-y-6">
            <BudgetClientInfoCard budget={budget} />
            <BudgetEventInfoCard budget={budget} />
          </div>
        </div>
      </div>

      {showGenerateInvoice && (
        <GenerateInvoiceModal
          budget={budget}
          onClose={() => setShowGenerateInvoice(false)}
        />
      )}
    </div>
  );
}

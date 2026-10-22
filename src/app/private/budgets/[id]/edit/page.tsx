'use client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Pencil } from 'lucide-react';

import { useBudget } from '@/hooks/useBudgets';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { Button } from '@/components/shared/button/Button';
import BudgetForm from '@/features/budgets/BudgetForm';
import { useToast } from '@/components/hooks/useToast';
import { useEffect } from 'react';

export default function EditBudgetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const { id: budgetId } = params;
  const { data: budget, isLoading } = useBudget(budgetId);

  useEffect(() => {
    if (!isLoading && !budget) {
      toast.error({ description: 'Presupuesto no encontrado' });
      router.push(PRIVATE_ROUTES.BUDGETS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, budget]);

  // ─── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-4" />
          <p className="text-brand font-medium">Cargando presupuesto...</p>
        </div>
      </div>
    );
  }

  if (!budget) return null;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={PRIVATE_ROUTES.BUDGETS_DETAILS(budget.id)}>
            <Button variant="ghost" size="sm" className="shrink-0 px-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-brand to-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand/30 shrink-0">
            <Pencil className="h-5 w-5 text-on-brand" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
              Editar Presupuesto
            </h1>
            <p className="text-brand/80 text-sm flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {budget.budgetNumber} - {budget.customerName}
            </p>
          </div>
        </div>

        {/* Form */}
        <BudgetForm budget={budget} />
      </div>
    </div>
  );
}

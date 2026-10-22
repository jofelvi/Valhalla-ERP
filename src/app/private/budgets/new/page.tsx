'use client';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

import BudgetForm from '@/features/budgets/BudgetForm';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';

export default function NewBudgetPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={PRIVATE_ROUTES.BUDGETS}>
            <Button variant="ghost" size="sm" className="shrink-0 px-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-brand to-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand/30 shrink-0">
            <FileText className="h-5 w-5 text-on-brand" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">
              Nuevo Presupuesto
            </h1>
            <p className="text-brand/80 text-sm">
              Crea un presupuesto para un evento
            </p>
          </div>
        </div>

        {/* Form */}
        <BudgetForm />
      </div>
    </div>
  );
}

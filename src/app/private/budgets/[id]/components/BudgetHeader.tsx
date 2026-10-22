'use client';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Download,
  Pencil,
  Receipt,
  ClipboardList,
  ChevronDown,
  Clock,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Budget } from '@odin6/types';
import { BudgetStatusEnum } from '@/shared/types/enumShared';
import { Badge, type BadgeVariant } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import ShareBudgetWhatsApp from '@/features/budgets/ShareBudgetWhatsApp';
import SendBudgetWhatsAppButton from '@/features/budgets/SendBudgetWhatsAppButton';
import { STATUS_CONFIG_BASE, getAvailableTransitionsBase } from '../utils';
import { StatusTransitionBase } from '../utils';

interface BudgetHeaderProps {
  budget: Budget;
  isUpdating: boolean;
  showStatusMenu: boolean;
  onToggleStatusMenu: (open: boolean) => void;
  onStatusChange: (status: BudgetStatusEnum) => Promise<void>;
  onDownloadPDF: () => void;
  onDownloadAcuse: () => void;
  onGenerateInvoice: () => void;
}

function getIconForStatusName(
  iconName: 'clock' | 'send' | 'check-circle' | 'x-circle' | 'alert-triangle',
  size: 'sm' | 'base' = 'sm',
) {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  switch (iconName) {
    case 'clock':
      return <Clock className={sizeClass} />;
    case 'send':
      return <Send className={sizeClass} />;
    case 'check-circle':
      return <CheckCircle className={sizeClass} />;
    case 'x-circle':
      return <XCircle className={sizeClass} />;
    case 'alert-triangle':
      return <AlertTriangle className={sizeClass} />;
  }
}

export function BudgetHeader({
  budget,
  isUpdating,
  showStatusMenu,
  onToggleStatusMenu,
  onStatusChange,
  onDownloadPDF,
  onDownloadAcuse,
  onGenerateInvoice,
}: BudgetHeaderProps) {
  const availableTransitionsBase = getAvailableTransitionsBase(budget.status);
  const statusConfigBase = STATUS_CONFIG_BASE[budget.status];
  const statusBadgeIcon = getIconForStatusName(statusConfigBase.iconName);

  return (
    <div className="bg-surface/90 backdrop-blur-sm rounded-2xl border border-line/50 shadow-lg p-4 sm:p-5 mb-6">
      {/* Top row: back + title + status */}
      <div className="flex items-center gap-3 mb-4">
        <Link href={PRIVATE_ROUTES.BUDGETS}>
          <Button variant="ghost" size="sm" className="shrink-0 px-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="w-10 h-10 bg-gradient-to-br from-brand to-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand/30 shrink-0">
          <FileText className="h-5 w-5 text-on-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent truncate">
            {budget.budgetNumber}
          </h1>
          <p className="text-brand/80 text-xs">
            {budget.eventName} - {budget.customerName}
          </p>
        </div>
        <div className="shrink-0">
          <Badge
            variant={statusConfigBase.variant as BadgeVariant}
            className="flex items-center gap-1"
          >
            {statusBadgeIcon}
            {statusConfigBase.label}
          </Badge>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-line/50 mb-3" />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 [&_button]:h-9 [&_button]:text-xs [&_button]:font-medium">
        <Button variant="outline" size="sm" onClick={onDownloadPDF}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Descargar PDF
        </Button>

        {budget.status === BudgetStatusEnum.APPROVED &&
          budget.abonoAmount != null && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadAcuse}
              className="border-ok/40 text-ok hover:bg-ok/10"
            >
              <Receipt className="w-3.5 h-3.5 mr-1.5" />
              Acuse de Recibo
            </Button>
          )}

        <ShareBudgetWhatsApp budget={budget} />
        <SendBudgetWhatsAppButton budget={budget} />

        <Link href={PRIVATE_ROUTES.BUDGETS_EDIT(budget.id)}>
          <Button variant="outline" size="sm">
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Editar
          </Button>
        </Link>

        {/* Generar / Ver Factura Fiscal */}
        {budget.invoiceId ? (
          <Link href={PRIVATE_ROUTES.INVOICES_DETAILS(budget.invoiceId)}>
            <Button variant="outline" size="sm">
              <Receipt className="w-3.5 h-3.5 mr-1.5" />
              Ver Factura
            </Button>
          </Link>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerateInvoice}
            title="Genera una factura fiscal con IVA a partir de este presupuesto"
          >
            <Receipt className="w-3.5 h-3.5 mr-1.5" />
            Generar Factura
          </Button>
        )}

        {/* Status change dropdown */}
        {availableTransitionsBase.length > 0 && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleStatusMenu(!showStatusMenu)}
              isLoading={isUpdating}
            >
              <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
              Cambiar Estado
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </Button>

            {showStatusMenu && (
              <div className="absolute z-30 top-full mt-1 right-0 w-56 bg-surface rounded-xl border border-line shadow-xl py-1">
                {availableTransitionsBase.map(
                  (transition: StatusTransitionBase) => (
                    <button
                      key={transition.target}
                      type="button"
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-surface transition-colors"
                      onClick={() => onStatusChange(transition.target)}
                    >
                      {getIconForStatusName(transition.iconName, 'base')}
                      <span>{transition.label}</span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

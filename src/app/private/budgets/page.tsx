'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/shared/ui/AppLink/AppLink';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Send,
  Filter,
  ListIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
} from 'lucide-react';

import { Budget } from '@odin6/types';
import { BudgetStatusEnum } from '@/shared/types/enumShared';
import { useBudgets } from '@/hooks';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { Button } from '@/components/shared/button/Button';
import { Badge, BadgeVariant } from '@/components/shared/badge/badge';
import { aFecha } from '@/shared/utils/dateHelpers';
import EventCalendar from '@/features/budgets/EventCalendar';
import AcceptBudgetModal from '@/features/budgets/AcceptBudgetModal';
import { useBudgetsCalendar } from '@/hooks/useBudgets';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDateVE(date: Date | string | undefined): string {
  if (!date) return '—';
  const d = aFecha(date);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Caracas',
  });
}

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  icon: React.ReactNode;
}

const STATUS_CONFIG: Record<BudgetStatusEnum, StatusConfig> = {
  [BudgetStatusEnum.DRAFT]: {
    label: 'Borrador',
    variant: 'secondary',
    icon: <Clock className="w-3 h-3" />,
  },
  [BudgetStatusEnum.SENT]: {
    label: 'Enviado',
    variant: 'info',
    icon: <Send className="w-3 h-3" />,
  },
  [BudgetStatusEnum.APPROVED]: {
    label: 'Aprobado',
    variant: 'success',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  [BudgetStatusEnum.REJECTED]: {
    label: 'Rechazado',
    variant: 'destructive',
    icon: <XCircle className="w-3 h-3" />,
  },
  [BudgetStatusEnum.EXPIRED]: {
    label: 'Vencido',
    variant: 'warning',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

function getStatusBadge(status: BudgetStatusEnum) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const router = useRouter();
  const { data: budgets = [], isLoading } = useBudgets();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BudgetStatusEnum | ''>('');
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [acceptingBudget, setAcceptingBudget] = useState<Budget | null>(null);
  const { data: calendarEvents = [] } = useBudgetsCalendar();

  // ─── Sort budgets by createdAt ────────────────────────────────────

  const sortedBudgets = useMemo(() => {
    const sorted = [...budgets];
    sorted.sort((a: Budget, b: Budget) => {
      const dateA = aFecha(a.createdAt).getTime();
      const dateB = aFecha(b.createdAt).getTime();
      return dateB - dateA;
    });
    return sorted;
  }, [budgets]);

  // ─── Filter & search ────────────────────────────────────────────────────

  const byStatusFiltered = useMemo(() => {
    if (!statusFilter) return sortedBudgets;
    return sortedBudgets.filter((b: Budget) => b.status === statusFilter);
  }, [sortedBudgets, statusFilter]);

  const filteredBudgets = useBusqueda(byStatusFiltered, searchQuery, [
    'customerName',
    'eventName',
    'budgetNumber',
  ]);

  // ─── Summary counts ─────────────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    const totalCount = budgets.length;
    const draftCount = budgets.filter(
      (b: Budget) => b.status === BudgetStatusEnum.DRAFT,
    ).length;
    const sentCount = budgets.filter(
      (b: Budget) => b.status === BudgetStatusEnum.SENT,
    ).length;
    const approvedCount = budgets.filter(
      (b: Budget) => b.status === BudgetStatusEnum.APPROVED,
    ).length;
    return { totalCount, draftCount, sentCount, approvedCount };
  }, [budgets]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="bg-page min-h-screen">
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 shrink-0">
              <FileText className="h-5 w-5 text-brand-light" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent mb-1">
                Presupuestos
              </h1>
              <p className="text-brand/80 text-sm">
                Gestiona los presupuestos para eventos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-elevated rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'list'
                    ? 'bg-surface text-content shadow-sm'
                    : 'text-dim hover:text-content'
                }`}
              >
                <ListIcon className="h-4 w-4" />
                Lista
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'calendar'
                    ? 'bg-surface text-content shadow-sm'
                    : 'text-dim hover:text-content'
                }`}
              >
                <CalendarDaysIcon className="h-4 w-4" />
                Calendario
              </button>
            </div>
            <Link href={PRIVATE_ROUTES.BUDGETS_NEW}>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Nuevo Presupuesto
              </Button>
            </Link>
          </div>
        </div>

        {activeTab === 'list' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-elevated/30 backdrop-blur-sm rounded-xl border border-line p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-brand-light" />
                  </div>
                  <span className="text-xs font-medium text-dim">
                    Total Presupuestos
                  </span>
                </div>
                <p className="text-2xl font-bold text-content">
                  {summaryStats.totalCount}
                </p>
              </div>

              <div className="bg-elevated/30 backdrop-blur-sm rounded-xl border border-line p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-dim/20 rounded-lg flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-dim" />
                  </div>
                  <span className="text-xs font-medium text-dim">
                    Borradores
                  </span>
                </div>
                <p className="text-2xl font-bold text-content">
                  {summaryStats.draftCount}
                </p>
              </div>

              <div className="bg-elevated/30 backdrop-blur-sm rounded-xl border border-line p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center shrink-0">
                    <Send className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-xs font-medium text-dim">Enviados</span>
                </div>
                <p className="text-2xl font-bold text-content">
                  {summaryStats.sentCount}
                </p>
              </div>

              <div className="bg-elevated/30 backdrop-blur-sm rounded-xl border border-line p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-ok/20 rounded-lg flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-ok" />
                  </div>
                  <span className="text-xs font-medium text-dim">
                    Aprobados
                  </span>
                </div>
                <p className="text-2xl font-bold text-content">
                  {summaryStats.approvedCount}
                </p>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="bg-elevated/30 rounded-xl border border-line p-4 shadow-sm mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-light" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, evento o número..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line bg-surface/90 text-sm placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-200"
                  />
                </div>

                {/* Status filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-light" />
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as BudgetStatusEnum | '')
                    }
                    className="pl-10 pr-8 py-2.5 rounded-xl border border-line bg-surface/90 text-sm text-dim focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-200 appearance-none cursor-pointer min-w-[160px]"
                  >
                    <option value="">Todos los estados</option>
                    <option value={BudgetStatusEnum.DRAFT}>Borradores</option>
                    <option value={BudgetStatusEnum.SENT}>Enviados</option>
                    <option value={BudgetStatusEnum.APPROVED}>Aprobados</option>
                    <option value={BudgetStatusEnum.REJECTED}>
                      Rechazados
                    </option>
                    <option value={BudgetStatusEnum.EXPIRED}>Vencidos</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-16">
                <div className="w-12 h-12 border-4 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-4" />
                <p className="text-brand font-medium">
                  Cargando presupuestos...
                </p>
              </div>
            )}

            {/* Budget List */}
            {!isLoading && filteredBudgets.length > 0 && (
              <div className="space-y-3">
                {filteredBudgets.map((budget: Budget) => (
                  <div
                    key={budget.id}
                    onClick={() =>
                      router.push(PRIVATE_ROUTES.BUDGETS_DETAILS(budget.id))
                    }
                    className="bg-elevated/30 backdrop-blur-sm rounded-xl border border-line p-4 shadow-sm hover:shadow-md hover:border-brand/40 hover:bg-elevated/50 transition-all duration-200 cursor-pointer mb-3 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: main info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono text-brand-light">
                            {budget.budgetNumber}
                          </span>
                          {getStatusBadge(budget.status)}
                        </div>

                        <h3 className="font-semibold text-content truncate text-base group-hover:text-brand-light transition-colors">
                          {budget.eventName}
                        </h3>

                        <div className="flex items-center gap-3 mt-1.5 text-sm text-brand/80 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {budget.customerName}
                          </span>
                          {budget.eventDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDateVE(budget.eventDate)}
                            </span>
                          )}
                          {budget.eventGuests && (
                            <span className="text-xs text-brand-light">
                              {budget.eventGuests} invitados
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: total and actions */}
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <div>
                          <p className="text-lg font-bold text-content">
                            {formatCurrency(budget.total)}
                          </p>
                          <p className="text-xs text-brand-light">
                            {formatDateVE(budget.createdAt)}
                          </p>
                        </div>
                        {budget.status !== 'approved' && budget.eventDate && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAcceptingBudget(budget);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-ok/10 text-ok hover:bg-ok/20 transition-colors border border-ok/20"
                          >
                            <CheckCircle2Icon className="h-3.5 w-3.5" />
                            Aceptar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredBudgets.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-br from-dim/20 to-dim/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-dim" />
                </div>
                <p className="text-brand font-semibold text-lg mb-1">
                  {budgets.length === 0 ? 'Sin presupuestos' : 'Sin resultados'}
                </p>
                <p className="text-brand-light text-sm mb-4">
                  {budgets.length === 0
                    ? 'Crea tu primer presupuesto para eventos'
                    : 'No se encontraron presupuestos con los filtros aplicados'}
                </p>
                {budgets.length === 0 && (
                  <Link href={PRIVATE_ROUTES.BUDGETS_NEW}>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1.5" />
                      Crear primer presupuesto
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'calendar' && <EventCalendar events={calendarEvents} />}

        {acceptingBudget && (
          <AcceptBudgetModal
            budget={acceptingBudget}
            onClose={() => setAcceptingBudget(null)}
          />
        )}
      </div>
    </div>
  );
}

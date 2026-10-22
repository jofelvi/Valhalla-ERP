'use client';
import { CalendarDaysIcon } from 'lucide-react';
import EventCalendar from '@/features/budgets/EventCalendar';
import { useBudgetsCalendar } from '@/hooks/useBudgets';

export default function CalendarioPage() {
  const { data: events = [], isLoading } = useBudgetsCalendar();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-brand/10">
          <CalendarDaysIcon className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-content">
            Calendario de Eventos
          </h1>
          <p className="text-sm text-dim">Eventos con presupuesto aceptado</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
        </div>
      ) : (
        <EventCalendar events={events} />
      )}
    </div>
  );
}

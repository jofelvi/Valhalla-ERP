'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/button/Button';
import { usePayrollCount } from '@/hooks/usePayroll';
import WeeklyPayrollTable from '@/features/payroll/WeeklyPayrollTable';
import PayrollHistory from '@/features/payroll/PayrollHistory';
import { Banknote, Plus, CalendarDaysIcon, ListIcon } from 'lucide-react';
import { Panel } from '@/components/shared/panel/Panel';
import {
  IconoEnCuadro,
  TituloDePantalla,
} from '@/components/shared/cabecera/CabeceraDePantalla';

export default function PayrollPage() {
  const router = useRouter();
  const { data: payrollCount, isLoading } = usePayrollCount();
  const [activeTab, setActiveTab] = useState<'weekly' | 'history'>('weekly');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated flex justify-center items-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
          <span className="text-dim">Cargando nóminas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header Card */}
        <Panel className="p-3.5 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconoEnCuadro>
              <Banknote className="w-5 h-5 text-brand" />
            </IconoEnCuadro>
            <TituloDePantalla
              titulo="Nómina"
              subtitulo={<>{payrollCount?.total ?? 0} pagos</>}
            />
          </div>
          <Button
            onClick={() => router.push('/private/payroll/new')}
            startIcon={<Plus className="h-4 w-4" />}
          >
            Nueva Nómina
          </Button>
        </Panel>

        {/* Tab switcher */}
        <div className="flex items-center bg-elevated rounded-xl p-1 gap-1 mb-4">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'weekly'
                ? 'bg-surface text-content shadow-sm'
                : 'text-dim hover:text-content'
            }`}
          >
            <CalendarDaysIcon className="h-4 w-4" />
            Semanal
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-surface text-content shadow-sm'
                : 'text-dim hover:text-content'
            }`}
          >
            <ListIcon className="h-4 w-4" />
            Historial
          </button>
        </div>

        {/* Contenido condicional por tab */}
        {activeTab === 'weekly' ? <WeeklyPayrollTable /> : <PayrollHistory />}
      </div>
    </div>
  );
}

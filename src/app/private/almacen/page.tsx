// app/private/almacen/page.tsx
'use client';
import Link from '@/shared/ui/AppLink/AppLink';
import { Package, Calendar, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { useAlmacenDiarioActivo } from '@/hooks/useAlmacen';
import { format } from 'date-fns';
import { PRIVATE_ROUTES } from '@/shared';

/**
 * Página principal del módulo de Almacén
 * Dashboard con estado actual y acceso rápido a funciones principales
 */
export default function AlmacenPage() {
  const { data: diaActivo = null, isLoading } = useAlmacenDiarioActivo();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-elevated flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
          <p className="mt-4 text-dim">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-surface rounded-xl p-4 sm:p-6 shadow-sm border border-line">
            <h1 className="text-2xl sm:text-3xl font-bold text-content tracking-tight">
              Gestión de Almacén
            </h1>
            <p className="text-dim mt-1 text-sm sm:text-base">
              Control de inventario general y diario
            </p>
          </div>
        </div>

        {/* Estado del Día */}
        <div className="mb-6">
          <div className="bg-surface rounded-xl p-6 shadow-sm border border-line">
            <h2 className="text-lg font-semibold text-content mb-4">
              Estado del Día
            </h2>

            {diaActivo ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-ok/10 rounded-lg border border-ok/20">
                  <div>
                    <p className="text-sm text-ok font-medium">Día Abierto</p>
                    <p className="text-2xl font-bold text-content">
                      {format(new Date(diaActivo.fecha), 'dd/MM/yyyy')}
                    </p>
                    <p className="text-sm text-ok mt-1">
                      Apertura:{' '}
                      {format(new Date(diaActivo.horaApertura), 'HH:mm')}
                    </p>
                  </div>
                  <Calendar className="w-12 h-12 text-ok" />
                </div>

                {diaActivo.resumen && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-elevated rounded-lg">
                      <p className="text-sm text-dim">Stock Inicial</p>
                      <p className="text-2xl font-bold text-content">
                        {diaActivo.resumen.totalProductosInicial}
                      </p>
                      <p className="text-xs text-dim">unidades</p>
                    </div>
                    <div className="p-4 bg-elevated rounded-lg">
                      <p className="text-sm text-dim">Ventas</p>
                      <p className="text-2xl font-bold text-brand">
                        {diaActivo.resumen.totalVentas}
                      </p>
                      <p className="text-xs text-dim">
                        {diaActivo.resumen.numeroOrdenes} órdenes
                      </p>
                    </div>
                    <div className="p-4 bg-elevated rounded-lg">
                      <p className="text-sm text-dim">Total Ventas</p>
                      <p className="text-2xl font-bold text-ok">
                        ${diaActivo.resumen.montoTotalVentas.toFixed(2)}
                      </p>
                      <p className="text-xs text-dim">monto</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-accent/10 rounded-lg border border-accent/20 text-center">
                <Calendar className="w-12 h-12 text-accent mx-auto mb-3" />
                <p className="text-content font-medium">No hay día activo</p>
                <p className="text-sm text-dim mt-1">
                  Abre un nuevo día para comenzar operaciones
                </p>
                <Link href={PRIVATE_ROUTES.ALMACEN_DIARIO}>
                  <Button className="mt-4 bg-accent hover:bg-accent/80 text-on-brand">
                    Abrir Día
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Almacén General */}
          <Link href={PRIVATE_ROUTES.ALMACEN_GENERAL} className="block">
            <div className="bg-surface rounded-xl p-6 shadow-sm border border-line hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-elevated rounded-lg">
                  <Package className="w-6 h-6 text-brand" />
                </div>
                <ArrowRight className="w-5 h-5 text-dim" />
              </div>
              <h3 className="text-lg font-semibold text-content mb-2">
                Almacén General
              </h3>
              <p className="text-sm text-dim">
                Gestiona el stock principal de productos
              </p>
            </div>
          </Link>

          {/* Almacén Diario */}
          <Link href={PRIVATE_ROUTES.ALMACEN_DIARIO} className="block">
            <div className="bg-surface rounded-xl p-6 shadow-sm border border-line hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-ok/15 rounded-lg">
                  <Calendar className="w-6 h-6 text-ok" />
                </div>
                <ArrowRight className="w-5 h-5 text-dim" />
              </div>
              <h3 className="text-lg font-semibold text-content mb-2">
                Almacén Diario
              </h3>
              <p className="text-sm text-dim">
                Controla el inventario operacional del día
              </p>
            </div>
          </Link>

          {/* Reportes */}
          <Link href={PRIVATE_ROUTES.REPORTS} className="block">
            <div className="bg-surface rounded-xl p-6 shadow-sm border border-line hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-brand/15 rounded-lg">
                  <FileText className="w-6 h-6 text-brand" />
                </div>
                <ArrowRight className="w-5 h-5 text-dim" />
              </div>
              <h3 className="text-lg font-semibold text-content mb-2">
                Reportes
              </h3>
              <p className="text-sm text-dim">
                Historial y reportes diarios de inventario
              </p>
            </div>
          </Link>
        </div>

        {/* Información */}
        <div className="mt-6 bg-elevated rounded-xl p-6 border border-brand/20">
          <h3 className="text-lg font-semibold text-content mb-2">
            ℹ️ Información
          </h3>
          <ul className="space-y-2 text-sm text-dim">
            <li>• El almacén general contiene todo el stock disponible</li>
            <li>
              • Al abrir un día, se transfiere stock del general al diario
            </li>
            <li>
              • Las ventas del POS se registran automáticamente en el almacén
              diario
            </li>
            <li>• Al cerrar el día, se genera un reporte completo</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

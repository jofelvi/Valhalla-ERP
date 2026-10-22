'use client';

import Link from '@/shared/ui/AppLink/AppLink';
import { useMemo, useState } from 'react';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { Badge } from '@/components/shared/badge/badge';
import { PRIVATE_ROUTES, TableStatusEnum } from '@/shared';
import { Button } from '@/components/shared/button/Button';
import { useTables } from '@/hooks/useTables';
import Loader from '@/components/shared/Loader/Loader';
import { Armchair, Plus, Search, Users, X } from 'lucide-react';
import { Panel } from '@/components/shared/panel/Panel';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';

const statusConfig: Record<
  string,
  {
    label: string;
    variant: 'success' | 'destructive' | 'warning' | 'info' | 'secondary';
  }
> = {
  [TableStatusEnum.ISAVAILABLE]: { label: 'Disponible', variant: 'success' },
  [TableStatusEnum.OCCUPIED]: { label: 'Ocupada', variant: 'destructive' },
  [TableStatusEnum.RESERVED]: { label: 'Reservada', variant: 'warning' },
  [TableStatusEnum.PREPARING]: { label: 'Preparando', variant: 'info' },
  [TableStatusEnum.CLEANING]: { label: 'Limpieza', variant: 'secondary' },
};

export default function TablesClientComponent() {
  const { data: tables = [], isLoading } = useTables();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useBusqueda(tables, searchQuery, [
    'name',
    (t) => String(t.number),
  ]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (a.number || 0) - (b.number || 0)),
    [filtered],
  );

  const availableCount = tables.filter(
    (t) => t.status === TableStatusEnum.ISAVAILABLE,
  ).length;
  const occupiedCount = tables.filter(
    (t) => t.status === TableStatusEnum.OCCUPIED,
  ).length;

  if (isLoading) return <Loader fullScreen text="Cargando mesas..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header */}
        <CabeceraDePantalla
          icono={<Armchair className="h-4 w-4 text-brand" />}
          titulo="Mesas"
          subtitulo={
            <>
              {tables.length} mesas · {availableCount} disponibles ·{' '}
              {occupiedCount} ocupadas
            </>
          }
          acciones={
            <Link href={PRIVATE_ROUTES.TABLES_NEW}>
              <Button size="sm" className="h-8">
                <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Nueva Mesa</span>
              </Button>
            </Link>
          }
        />

        {/* Search */}
        {tables.length > 0 && (
          <Panel className="p-3 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim" />
              <input
                type="text"
                placeholder="Buscar por nombre o numero..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-sm border border-line rounded-lg bg-page text-content placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-content"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </Panel>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
          {Object.entries(statusConfig).map(([key, config]) => {
            const count = tables.filter((t) => t.status === key).length;
            return (
              <div
                key={key}
                className="bg-surface/90 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-line/50 text-center"
              >
                <p className="text-xl font-bold text-content">{count}</p>
                <Badge variant={config.variant} className="text-[10px] mt-1">
                  {config.label}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        {sorted.length === 0 ? (
          <Panel className="text-center py-16">
            <Armchair className="h-10 w-10 text-dim mx-auto mb-3" />
            <p className="text-content font-semibold mb-1">
              {searchQuery ? 'Sin resultados' : 'No hay mesas'}
            </p>
            <p className="text-dim text-sm mb-4">
              {searchQuery
                ? `No se encontro "${searchQuery}"`
                : 'Crea tu primera mesa'}
            </p>
            {!searchQuery && (
              <Link href={PRIVATE_ROUTES.TABLES_NEW}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Crear Mesa
                </Button>
              </Link>
            )}
          </Panel>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {sorted.map((table) => {
              const status = statusConfig[table.status] || {
                label: table.status,
                variant: 'secondary' as const,
              };
              const isOccupied = table.status === TableStatusEnum.OCCUPIED;

              return (
                <Link
                  key={table.id}
                  href={PRIVATE_ROUTES.TABLES_DETAILS(table.id)}
                >
                  <div
                    className={`bg-surface/90 backdrop-blur-sm rounded-xl border shadow-sm p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                      isOccupied ? 'border-danger/30' : 'border-line/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isOccupied ? 'bg-danger/15' : 'bg-brand/15'
                        }`}
                      >
                        <Armchair
                          className={`w-5 h-5 ${isOccupied ? 'text-danger' : 'text-brand'}`}
                        />
                      </div>
                      <Badge variant={status.variant} className="text-[10px]">
                        {status.label}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-content text-sm">
                      Mesa {table.number}
                    </h3>
                    {table.name && (
                      <p className="text-xs text-dim truncate">{table.name}</p>
                    )}

                    <div className="flex items-center gap-1 mt-2 text-xs text-dim">
                      <Users className="w-3 h-3" />
                      <span>{table.capacity} personas</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

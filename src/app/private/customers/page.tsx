'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { Users, Search, Eye, Pencil } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { PRIVATE_ROUTES } from '@/shared';
import Table from '@/components/shared/Table';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import Loader from '@/components/shared/Loader/Loader';
import { Customer } from '@odin6/types';
import { Panel } from '@/components/shared/panel/Panel';
import {
  IconoEnCuadro,
  TituloDePantalla,
} from '@/components/shared/cabecera/CabeceraDePantalla';

export default function CustomersPage() {
  const [query, setQuery] = useState('');
  const router = useRouter();
  // `vista: 'lista'` deja fuera fechas, credito, direccion y la metadata
  // muerta de Firebase. Esta tabla pinta nombre, telefono, correo, accion y
  // activo, y busca por esos mismos campos.
  const { data: customers = [], isLoading: loading } = useCustomers({
    vista: 'lista',
  });

  // El numero de accion es como el dueño identifica a un socio: 2.084 de los
  // 2.992 clientes lo tienen, y no se podia buscar por el. Va guardado con
  // relleno a cinco cifras ("00327"), asi que escribir "327" tambien encuentra.
  const filtered = useBusqueda(customers, query, [
    'name',
    'phone',
    'email',
    'identificationId',
    'memberAction',
  ]);

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'name',
      header: 'Nombre',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.phone && (
            <p className="text-xs text-dim">{row.original.phone}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'memberAction',
      header: 'Acción',
      cell: ({ row }) =>
        row.original.memberAction ? (
          <span className="font-mono text-sm font-semibold tabular-nums text-content">
            {row.original.memberAction}
          </span>
        ) : (
          <span className="text-xs text-dim">—</span>
        ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <span>{row.original.email || '-'}</span>,
    },
    {
      accessorKey: 'identificationId',
      header: 'ID',
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.identificationType && row.original.identificationId
            ? `${row.original.identificationType}-${row.original.identificationId}`
            : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
          {row.original.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push(`${PRIVATE_ROUTES.CUSTOMERS}/${row.original.id}`)
            }
            className="h-8"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push(`${PRIVATE_ROUTES.CUSTOMERS}/${row.original.id}/edit`)
            }
            className="h-8"
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <Loader size="lg" text="Cargando clientes..." />;
  }

  const activeCount = customers.filter((c) => c.isActive).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header Card */}
        <Panel className="p-3.5 mb-3 flex justify-between items-start">
          <div className="flex items-start gap-3">
            <IconoEnCuadro>
              <Users className="w-5 h-5 text-brand" />
            </IconoEnCuadro>
            <TituloDePantalla
              titulo="Clientes"
              subtitulo={
                <>
                  {customers.length} registrados • {activeCount} activos
                </>
              }
            />
          </div>
          <Button
            size="sm"
            className="h-8"
            onClick={() => router.push(`${PRIVATE_ROUTES.CUSTOMERS}/new`)}
          >
            Nuevo Cliente
          </Button>
        </Panel>

        {/* Search Card */}
        <Panel className="p-3.5 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
            <input
              type="text"
              placeholder="Buscar por nombre, N° de acción, teléfono, email o cédula…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm border border-line rounded-lg bg-page focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
            />
            {query && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dim">
                {filtered.length}
              </span>
            )}
          </div>
        </Panel>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-brand" />
            </div>
            <p className="text-content font-semibold">
              {query ? 'Sin resultados' : 'No hay clientes registrados'}
            </p>
            <p className="text-dim text-xs mt-1">
              {query
                ? 'Intenta con otro término de búsqueda'
                : 'Comienza creando tu primer cliente'}
            </p>
            {!query && (
              <Button
                size="sm"
                className="mt-3 h-8"
                onClick={() => router.push(`${PRIVATE_ROUTES.CUSTOMERS}/new`)}
              >
                Crear Cliente
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table data={filtered} columns={columns} />
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {filtered.map((customer) => (
                <Panel key={customer.id} className="p-3.5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-content">
                        {customer.name}
                      </p>
                      <p className="text-xs text-dim">
                        {customer.memberAction && (
                          <span className="font-mono font-semibold text-content">
                            Acción {customer.memberAction}
                          </span>
                        )}
                        {customer.memberAction && customer.phone && ' · '}
                        {customer.phone}
                      </p>
                    </div>
                    <Badge
                      variant={customer.isActive ? 'success' : 'destructive'}
                    >
                      {customer.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  {customer.email && (
                    <p className="text-xs text-dim mb-2">{customer.email}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1"
                      onClick={() =>
                        router.push(
                          `${PRIVATE_ROUTES.CUSTOMERS}/${customer.id}`,
                        )
                      }
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1"
                      onClick={() =>
                        router.push(
                          `${PRIVATE_ROUTES.CUSTOMERS}/${customer.id}/edit`,
                        )
                      }
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Editar
                    </Button>
                  </div>
                </Panel>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

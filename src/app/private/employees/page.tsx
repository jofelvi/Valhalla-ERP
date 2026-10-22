'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { UserIcon, Search, Eye, Pencil, Trash2, HandCoins } from 'lucide-react';
import { useEmployees, useDeleteEmployee } from '@/hooks/useEmployees';
import EmployeeLoanModal from '@/features/employees/EmployeeLoanModal';
import Table from '@/components/shared/Table';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import Loader from '@/components/shared/Loader/Loader';
import { Employee } from '@odin6/types';
import { formatearUsd } from '@/shared/utils/dinero';
import { Panel } from '@/components/shared/panel/Panel';
import {
  IconoEnCuadro,
  TituloDePantalla,
} from '@/components/shared/cabecera/CabeceraDePantalla';
import { useBusqueda } from '@/shared/hooks/useBusqueda';

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loanEmployee, setLoanEmployee] = useState<Employee | null>(null);
  const router = useRouter();
  const { data: employees = [], isLoading } = useEmployees();
  const deleteEmployee = useDeleteEmployee();

  // Sin tildes y palabra por palabra: «maria gonzalez» encuentra a «María
  // González», y buscar el nombre y el apellido juntos deja de dar cero.
  const filteredEmployees = useBusqueda(employees, searchTerm, [
    'firstName',
    'lastName',
    'email',
    'position',
    'department',
  ]);

  const columns: ColumnDef<Employee>[] = [
    {
      accessorKey: 'firstName',
      header: 'Nombre',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </p>
          {row.original.position && (
            <p className="text-xs text-dim">{row.original.position}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'department',
      header: 'Departamento',
      cell: ({ row }) => <span>{row.original.department || '-'}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <span>{row.original.email || '-'}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Teléfono',
      cell: ({ row }) => <span>{row.original.phone || '-'}</span>,
    },
    {
      accessorKey: 'salary',
      header: 'Salario',
      cell: ({ row }) => <span>{formatearUsd(row.original.salary || 0)}</span>,
    },
    {
      accessorKey: 'isActive',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
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
            onClick={() => setLoanEmployee(row.original)}
            className="h-8 text-accent hover:bg-accent/10 hover:text-accent"
            title="Préstamos del empleado"
          >
            <HandCoins className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/private/employees/${row.original.id}`)}
            className="h-8"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push(`/private/employees/${row.original.id}/edit`)
            }
            className="h-8"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  `¿Desactivar a ${row.original.firstName} ${row.original.lastName}? El empleado quedará inactivo.`,
                )
              ) {
                void deleteEmployee.mutateAsync(row.original.id);
              }
            }}
            className="h-8 text-danger hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <Loader size="lg" text="Cargando empleados..." />;
  }

  const activeCount = employees.filter((e) => e.isActive).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header Card */}
        <Panel className="p-3.5 mb-3 flex justify-between items-start">
          <div className="flex items-start gap-3">
            <IconoEnCuadro>
              <UserIcon className="w-5 h-5 text-brand" />
            </IconoEnCuadro>
            <TituloDePantalla
              titulo="Empleados"
              subtitulo={
                <>
                  {employees.length} registrados • {activeCount} activos
                </>
              }
            />
          </div>
          <Button
            size="sm"
            className="h-8"
            onClick={() => router.push('/private/employees/new')}
          >
            Nuevo Empleado
          </Button>
        </Panel>

        {/* Search Card */}
        <Panel className="p-3.5 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, puesto o departamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm border border-line rounded-lg bg-page focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
            />
            {searchTerm && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dim">
                {filteredEmployees.length}
              </span>
            )}
          </div>
        </Panel>

        {/* Content */}
        {filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center mb-3">
              <UserIcon className="w-6 h-6 text-brand" />
            </div>
            <p className="text-content font-semibold">
              {searchTerm ? 'Sin resultados' : 'No hay empleados registrados'}
            </p>
            <p className="text-dim text-xs mt-1">
              {searchTerm
                ? 'Intenta con otro término de búsqueda'
                : 'Comienza creando tu primer empleado'}
            </p>
            {!searchTerm && (
              <Button
                size="sm"
                className="mt-3 h-8"
                onClick={() => router.push('/private/employees/new')}
              >
                Crear Empleado
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table data={filteredEmployees} columns={columns} />
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {filteredEmployees.map((employee) => (
                <Panel key={employee.id} className="p-3.5">
                  <div className="flex gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-5 h-5 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-content truncate">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-xs text-dim truncate">
                        {employee.position}
                      </p>
                    </div>
                    <Badge
                      variant={employee.isActive ? 'success' : 'secondary'}
                    >
                      {employee.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 mb-3 text-xs">
                    {employee.department && (
                      <p>
                        <span className="text-dim">Departamento:</span>{' '}
                        {employee.department}
                      </p>
                    )}
                    {employee.email && (
                      <p>
                        <span className="text-dim">Email:</span>{' '}
                        {employee.email}
                      </p>
                    )}
                    {employee.phone && (
                      <p>
                        <span className="text-dim">Teléfono:</span>{' '}
                        {employee.phone}
                      </p>
                    )}
                    {employee.salary && (
                      <p>
                        <span className="text-dim">Salario:</span>{' '}
                        {formatearUsd(employee.salary)}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1"
                      onClick={() =>
                        router.push(`/private/employees/${employee.id}`)
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
                        router.push(`/private/employees/${employee.id}/edit`)
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
      {loanEmployee && (
        <EmployeeLoanModal
          employee={loanEmployee}
          onClose={() => setLoanEmployee(null)}
        />
      )}
    </div>
  );
}

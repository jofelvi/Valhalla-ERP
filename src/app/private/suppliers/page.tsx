'use client';
import Link from '@/shared/ui/AppLink/AppLink';
import { useState } from 'react';
import { useSuppliers, useDeleteSupplier } from '@/hooks/useSuppliers';
import { PRIVATE_ROUTES } from '@/shared';
import { Supplier } from '@odin6/types';
import { Button } from '@/components/shared/button/Button';
import { Badge } from '@/components/shared/badge/badge';
import { DeleteConfirmationModal } from '@/features/categories/DeleteConfirmationModal';
import Loader from '@/components/shared/Loader/Loader';
import Table from '@/components/shared/Table';
import { ColumnDef } from '@tanstack/react-table';
import { useToast } from '@/components/hooks/useToast';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';
import { Mail, Pencil, Phone, Plus, Trash2, Truck, User } from 'lucide-react';
import { Panel } from '@/components/shared/panel/Panel';
import { CampoDeBusqueda } from '@/components/shared/busqueda/CampoDeBusqueda';
import { useBusqueda } from '@/shared/hooks/useBusqueda';

export default function SuppliersPage() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const deleteSupplier = useDeleteSupplier();
  const toast = useToast();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null,
  );

  const [searchQuery, setSearchQuery] = useState('');
  const filtered = useBusqueda(suppliers, searchQuery, [
    'name',
    'contactName',
    'email',
    'phone',
  ]);

  const activeCount = suppliers.filter((s) => s.isActive).length;

  const handleDeleteClick = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await deleteSupplier.mutateAsync(supplierToDelete.id);
      toast.success({
        title: 'Proveedor eliminado',
        description: `${supplierToDelete.name} fue eliminado`,
      });
      setDeleteModalOpen(false);
      setSupplierToDelete(null);
    } catch {
      toast.error({
        title: 'Error',
        description: 'No se pudo eliminar el proveedor',
      });
    }
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: 'name',
      header: 'Proveedor',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand/15 rounded-lg flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-content text-sm truncate">
              {row.original.name}
            </p>
            {row.original.email && (
              <p className="text-xs text-dim truncate">{row.original.email}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'contactName',
      header: 'Contacto',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm text-content">
          {row.original.contactName ? (
            <>
              <User className="w-3.5 h-3.5 text-dim" />
              {row.original.contactName}
            </>
          ) : (
            <span className="text-dim">—</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Telefono',
      cell: ({ row }) => (
        <span className="text-sm text-content">
          {row.original.phone || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge
          variant={row.original.isActive ? 'success' : 'destructive'}
          className="text-[10px]"
        >
          {row.original.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Link href={PRIVATE_ROUTES.SUPPLIERS_EDIT(row.original.id)}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-dim hover:text-brand"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-dim hover:text-danger"
            onClick={() => handleDeleteClick(row.original)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) return <Loader fullScreen text="Cargando proveedores..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onCloseAction={() => {
          setDeleteModalOpen(false);
          setSupplierToDelete(null);
        }}
        onConfirmAction={confirmDelete}
        title={`Eliminar proveedor ${supplierToDelete?.name}?`}
        description="Esta accion no se puede deshacer."
        isLoading={deleteSupplier.isPending}
      />

      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header */}
        <CabeceraDePantalla
          icono={<Truck className="h-4 w-4 text-brand" />}
          titulo="Proveedores"
          subtitulo={
            <>
              {suppliers.length} proveedores · {activeCount} activos
            </>
          }
          acciones={
            <Link href={PRIVATE_ROUTES.SUPPLIERS_NEW}>
              <Button size="sm" className="h-8">
                <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Nuevo Proveedor</span>
              </Button>
            </Link>
          }
        />

        {/* Search */}
        {suppliers.length > 0 && (
          <Panel className="p-3 mb-3">
            <CampoDeBusqueda
              valor={searchQuery}
              onCambio={setSearchQuery}
              placeholder="Buscar por nombre, contacto, email o telefono..."
            />
          </Panel>
        )}

        {/* Content */}
        {filtered.length === 0 ? (
          <Panel className="text-center py-16">
            <Truck className="h-10 w-10 text-dim mx-auto mb-3" />
            <p className="text-content font-semibold mb-1">
              {searchQuery ? 'Sin resultados' : 'No hay proveedores'}
            </p>
            <p className="text-dim text-sm mb-4">
              {searchQuery
                ? `No se encontro "${searchQuery}"`
                : 'Registra tu primer proveedor'}
            </p>
            {!searchQuery && (
              <Link href={PRIVATE_ROUTES.SUPPLIERS_NEW}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Crear Proveedor
                </Button>
              </Link>
            )}
          </Panel>
        ) : (
          <>
            {/* Desktop: Table */}
            <div className="hidden md:block">
              <Table data={filtered} columns={columns} />
            </div>

            {/* Mobile: Cards */}
            <div className="space-y-2 md:hidden">
              {filtered.map((supplier) => (
                <Panel key={supplier.id} className="p-3.5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-brand/15 rounded-lg flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-content text-sm truncate">
                        {supplier.name}
                      </p>
                      {supplier.contactName && (
                        <p className="text-xs text-dim flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {supplier.contactName}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={supplier.isActive ? 'success' : 'destructive'}
                      className="text-[10px] shrink-0"
                    >
                      {supplier.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-dim mb-3 pl-12">
                    {supplier.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {supplier.phone}
                      </span>
                    )}
                    {supplier.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        {supplier.email}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pl-12">
                    <Link
                      href={PRIVATE_ROUTES.SUPPLIERS_EDIT(supplier.id)}
                      className="flex-1"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 text-danger border-danger/30 hover:bg-danger/10"
                      onClick={() => handleDeleteClick(supplier)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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

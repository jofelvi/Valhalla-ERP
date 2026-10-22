'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDeleteSupplier } from '@/hooks/useSuppliers';
import { PRIVATE_ROUTES } from '@/shared';
import { Supplier } from '@odin6/types';
import { useRouter } from 'next/navigation';
import DeleteSupplierModal from './DeleteSupplierModal';
import { useToast } from '@/shared/hooks/useToast';
import { Edit, Trash2 } from 'lucide-react';

interface SuppliersTableProps {
  initialSuppliers: Supplier[];
}

export default function SuppliersTable({
  initialSuppliers,
}: SuppliersTableProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  useEffect(() => {
    setSuppliers(initialSuppliers);
  }, [initialSuppliers]);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null,
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const deleteSupplier = useDeleteSupplier();

  const handleDeleteClick = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!supplierToDelete) return;

    try {
      await deleteSupplier.mutateAsync(supplierToDelete.id);
      setSuppliers(suppliers.filter((s) => s.id !== supplierToDelete.id));
      toast.success({
        title: 'Proveedor eliminado',
        description: `El proveedor "${supplierToDelete.name}" ha sido eliminado exitosamente`,
      });
      router.refresh();
      setShowDeleteModal(false);
    } catch {
      toast.error({
        title: 'Error al eliminar',
        description:
          'No se pudo eliminar el proveedor. Por favor intenta de nuevo.',
      });
    } finally {
      setSupplierToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setSupplierToDelete(null);
  };

  return (
    <div className="bg-surface/90 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden border border-line/50">
      <table className="min-w-full divide-y divide-line">
        <thead className="bg-elevated">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
              Contacto
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
              Teléfono
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-dim uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-surface/80 divide-y divide-line">
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-semibold text-content">
                  {supplier.name}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-dim">
                {supplier.contactName || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-dim">
                {supplier.phone || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    supplier.isActive
                      ? 'bg-ok/15 text-ok'
                      : 'bg-danger/15 text-danger'
                  }`}
                >
                  {supplier.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Link
                    href={PRIVATE_ROUTES.SUPPLIERS_EDIT(supplier.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-brand hover:text-dim hover:bg-elevated rounded-lg transition-all duration-200"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Editar</span>
                  </Link>
                  <button
                    onClick={() => handleDeleteClick(supplier)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-danger hover:bg-danger/10 rounded-lg transition-all duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {suppliers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-dim text-lg">No hay proveedores registrados</p>
          <Link
            href={PRIVATE_ROUTES.SUPPLIERS_NEW}
            className="text-brand hover:text-content font-medium mt-2 inline-block"
          >
            Crear primer proveedor
          </Link>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteSupplierModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        supplier={supplierToDelete}
        isDeleting={deleteSupplier.isPending}
      />
    </div>
  );
}

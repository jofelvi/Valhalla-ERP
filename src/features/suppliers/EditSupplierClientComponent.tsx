'use client';

import { notFound } from 'next/navigation';
import SupplierForm from '@/features/suppliers/SupplierForm';
import { useSupplier } from '@/hooks/useSuppliers';

interface EditSupplierClientComponentProps {
  id: string;
}

export default function EditSupplierClientComponent({
  id,
}: EditSupplierClientComponentProps) {
  const { data: supplier, isLoading } = useSupplier(id === 'new' ? '' : id);
  const isNew = id === 'new';

  if (isLoading && !isNew) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-dim">Cargando proveedor...</div>
        </div>
      </div>
    );
  }

  if (!supplier && !isNew) {
    return notFound();
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? 'Nuevo Proveedor' : 'Editar Proveedor'}
      </h1>
      <div className="bg-surface shadow rounded-lg p-6">
        <SupplierForm initialData={supplier || null} />
      </div>
    </div>
  );
}

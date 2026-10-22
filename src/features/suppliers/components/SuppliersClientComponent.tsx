'use client';

import { useSuppliers } from '@/hooks/useSuppliers';
import SuppliersTable from './SuppliersTable';

export default function SuppliersClientComponent() {
  const { data: suppliers = [], isLoading } = useSuppliers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dim">Cargando proveedores...</div>
      </div>
    );
  }

  return <SuppliersTable initialSuppliers={suppliers} />;
}

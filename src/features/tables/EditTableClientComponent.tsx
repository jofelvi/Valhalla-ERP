'use client';

import { notFound } from 'next/navigation';
import TableForm from '@/features/tables/TableForm';
import { useTable } from '@/hooks/useTables';

interface EditTableClientComponentProps {
  id: string;
}

export default function EditTableClientComponent({
  id,
}: EditTableClientComponentProps) {
  const { data: table, isLoading } = useTable(id);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-dim">Cargando mesa...</div>
        </div>
      </div>
    );
  }

  if (!table) {
    return notFound();
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Editar Mesa</h1>
      <div className="bg-surface shadow rounded-lg p-6">
        <TableForm initialData={table} />
      </div>
    </div>
  );
}

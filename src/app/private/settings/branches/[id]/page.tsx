'use client';
import { useParams } from 'next/navigation';
import { BranchForm } from '@/features/settings/BranchForm';
import { useBranch } from '@/shared/hooks/useBranch';

export default function EditBranchPage() {
  const params = useParams();
  const { id: branchId } = params;
  const { availableBranches } = useBranch();

  const branch = availableBranches.find((b) => b.id === branchId);

  if (!branch) {
    return (
      <div className="min-h-screen bg-page">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-content">
                Sucursal no encontrada
              </h2>
              <p className="text-dim mt-2">
                La sucursal que intentas editar no existe
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <div className="container mx-auto px-6 py-8">
        <BranchForm initialData={branch} isNew={false} />
      </div>
    </div>
  );
}

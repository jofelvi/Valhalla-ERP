export const dynamic = 'force-dynamic';
import SupplierForm from '@/features/suppliers/SupplierForm';

export default function NewSupplierPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Nuevo Proveedor</h1>
      <div className="bg-surface shadow rounded-lg p-6">
        <SupplierForm />
      </div>
    </div>
  );
}

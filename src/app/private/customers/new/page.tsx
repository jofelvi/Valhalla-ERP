export const dynamic = 'force-dynamic';
import CustomerForm from '@/features/customers/CustomerForm';
import { UserPlus } from 'lucide-react';

export default function NewCustomerPage() {
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="h-8 w-8 text-brand" />
        <h1 className="text-2xl font-bold">Registrar Nuevo Cliente</h1>
      </div>
      <div className="bg-surface shadow rounded-lg p-6">
        <CustomerForm isNew={true} />
      </div>
    </div>
  );
}

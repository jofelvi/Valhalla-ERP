'use client';

import { notFound } from 'next/navigation';
import CustomerForm from '@/features/customers/CustomerForm';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { useCustomer } from '@/hooks/useCustomers';

interface EditCustomerClientComponentProps {
  id: string;
}

export default function EditCustomerClientComponent({
  id,
}: EditCustomerClientComponentProps) {
  const { data: customer, isLoading } = useCustomer(id);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-dim">Cargando cliente...</div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return notFound();
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Pencil className="h-7 w-7 text-brand" />
        <div>
          <h1 className="text-2xl font-bold text-content">Editar Cliente</h1>
          <p className="text-sm text-dim">
            {customer.name} ·{' '}
            <Link
              href={PRIVATE_ROUTES.CUSTOMERS_DETAILS(id)}
              className="text-brand hover:underline"
            >
              Ver perfil
            </Link>
          </p>
        </div>
      </div>

      <div className="bg-surface shadow rounded-lg p-6">
        <CustomerForm initialData={customer} isNew={false} />
      </div>
    </div>
  );
}

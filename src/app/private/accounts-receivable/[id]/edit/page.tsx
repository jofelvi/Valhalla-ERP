'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccountsReceivableRecord } from '@/hooks/useAccountsReceivable';
import AccountReceivableForm from '@/features/accountsReceivable/AccountReceivableForm';

export default function EditAccountReceivablePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { id } = params;

  const { data: accountReceivable, isLoading: loading } =
    useAccountsReceivableRecord(id);

  useEffect(() => {
    if (!loading && !accountReceivable) {
      router.push('/private/accounts-receivable');
    }
  }, [loading, accountReceivable, router]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  if (!accountReceivable) return null;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-content mb-2">
          Editar Cuenta por Cobrar
        </h1>
        <p className="text-dim">
          Editando factura #{accountReceivable.invoiceNumber}
        </p>
      </div>

      <AccountReceivableForm accountReceivable={accountReceivable} />
    </div>
  );
}

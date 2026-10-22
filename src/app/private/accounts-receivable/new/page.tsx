export const dynamic = 'force-dynamic';
import AccountReceivableForm from '@/features/accountsReceivable/AccountReceivableForm';

export default function NewAccountReceivablePage() {
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-content mb-2">
          Nueva Cuenta por Cobrar
        </h1>
        <p className="text-dim">
          Registra una nueva cuenta por cobrar en el sistema
        </p>
      </div>

      <AccountReceivableForm />
    </div>
  );
}

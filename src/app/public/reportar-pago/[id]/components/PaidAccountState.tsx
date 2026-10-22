import { CheckCircle2 } from 'lucide-react';

interface PaidAccountStateProps {
  invoiceNumber: string;
}

export function PaidAccountState({ invoiceNumber }: PaidAccountStateProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-elevated flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-ok rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-12 h-12 text-ok" />
        </div>
        <h1 className="text-2xl font-bold text-content mb-2">
          Factura pagada
        </h1>
        <p className="text-dim mb-2">
          La factura #{invoiceNumber} ya esta totalmente pagada.
        </p>
        <p className="text-sm text-ok font-semibold">
          ¡Gracias por tu preferencia!
        </p>
      </div>
    </div>
  );
}

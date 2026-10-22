import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Hourglass,
} from 'lucide-react';
import { usePagoMoviles } from '@/hooks/usePagoMovil';

interface VerifyPaymentsBankBotBadgeProps {
  orderId: string;
}

export const VerifyPaymentsBankBotBadge = ({
  orderId,
}: VerifyPaymentsBankBotBadgeProps) => {
  const { data } = usePagoMoviles({ orderId });

  if (!data?.length) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {data.map((pm) => {
        const ref = pm.referenceNumber;
        if (pm.status === 'verified') {
          return (
            <span
              key={pm.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-ok/15 text-ok"
              title={`Verificado contra el banco${pm.verificationDate ? ` el ${new Date(pm.verificationDate).toLocaleString('es-VE')}` : ''} · ref banco: ${ref}`}
            >
              <ShieldCheck className="w-3 h-3" /> Banco: verificado por bot
            </span>
          );
        }
        if (pm.status === 'amount_mismatch') {
          return (
            <span
              key={pm.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-warn/15 text-warn"
              title={pm.errorMessage ?? 'El monto en el banco no coincide'}
            >
              <AlertTriangle className="w-3 h-3" /> Banco: monto no coincide
            </span>
          );
        }
        if (pm.status === 'not_found') {
          return (
            <span
              key={pm.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-danger/15 text-danger"
              title={pm.errorMessage ?? 'La referencia no aparece en la cuenta'}
            >
              <ShieldAlert className="w-3 h-3" /> Banco: no encontrada
            </span>
          );
        }
        return (
          <span
            key={pm.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-elevated text-dim"
            title="El bot bancario aun no procesa esta referencia"
          >
            <Hourglass className="w-3 h-3" /> Banco: verificando…
          </span>
        );
      })}
    </div>
  );
};

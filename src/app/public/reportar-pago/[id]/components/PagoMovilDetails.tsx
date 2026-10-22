import { CheckCircle2, Copy } from 'lucide-react';
import { formatearBs } from '@/shared/utils/dinero';
import { usePagoMovilDestino } from '@/shared/hooks/usePagoMovilDestino';

interface PagoMovilDetailsProps {
  amountBs: string;
  amountUsd: string;
  bcvRate: number;
  copied: string | null;
  onCopy: (text: string, label: string) => void;
}

export function PagoMovilDetails({
  amountBs,
  amountUsd,
  bcvRate,
  copied,
  onCopy,
}: PagoMovilDetailsProps) {
  const PAGO_MOVIL_DESTINO = usePagoMovilDestino() ?? { banco: '', telefono: '', cedula: '' };
  return (
    <div className="bg-surface rounded-2xl shadow-lg border-2 border-amber-300 overflow-hidden mb-4">
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-4 py-2.5">
        <p className="text-on-brand font-bold text-center text-sm tracking-wider">
          PAGO MÓVIL
        </p>
      </div>
      <div className="p-5 flex flex-col items-center">

        {/* Datos */}
        <div className="w-full space-y-2 text-center">
          <p className="font-bold text-content">{PAGO_MOVIL_DESTINO.banco}</p>

          <button
            type="button"
            onClick={() => onCopy(PAGO_MOVIL_DESTINO.telefono, 'telefono')}
            className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-100 transition-colors"
          >
            <div className="text-left">
              <p className="text-[10px] text-brand uppercase font-semibold">
                Teléfono
              </p>
              <p className="text-base font-bold text-amber-900">
                {PAGO_MOVIL_DESTINO.telefono}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-brand">
              {copied === 'telefono' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onCopy(PAGO_MOVIL_DESTINO.cedula, 'cedula')}
            className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-100 transition-colors"
          >
            <div className="text-left">
              <p className="text-[10px] text-brand uppercase font-semibold">
                Cédula de Identidad
              </p>
              <p className="text-base font-bold text-amber-900">
                {PAGO_MOVIL_DESTINO.cedula}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-brand">
              {copied === 'cedula' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </>
              )}
            </div>
          </button>

          {bcvRate > 0 && amountUsd && (
            <button
              type="button"
              onClick={() =>
                onCopy(parseFloat(amountBs).toFixed(2), 'monto')
              }
              className="w-full flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-ok transition-colors"
            >
              <div className="text-left">
                <p className="text-[10px] text-ok uppercase font-semibold">
                  Monto a pagar
                </p>
                <p className="text-base font-bold text-ok">
                  {formatearBs(parseFloat(amountBs) || 0)}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-ok">
                {copied === 'monto' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </>
                )}
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

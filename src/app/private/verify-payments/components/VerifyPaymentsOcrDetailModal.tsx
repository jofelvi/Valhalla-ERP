import { X, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Modal from '@/components/shared/modal';
import { PendingPaymentOcr } from '@odin6/types';

interface VerifyPaymentsOcrDetailModalProps {
  ocrDetail: PendingPaymentOcr | null;
  onClose: () => void;
  onOpenImageModal: (url: string) => void;
}

export const VerifyPaymentsOcrDetailModal = ({
  ocrDetail,
  onClose,
  onOpenImageModal,
}: VerifyPaymentsOcrDetailModalProps) => {
  if (!ocrDetail) return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/60"
      classNameWrap="p-4"
      className="bg-surface rounded-lg shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
    >
      <div className="flex justify-between items-center p-3 border-b border-line">
        <div className="flex items-center gap-2">
          {ocrDetail.status === 'fraud_suspect' ? (
            <ShieldAlert className="w-5 h-5 text-danger" />
          ) : ocrDetail.status === 'mismatch' ? (
            <AlertTriangle className="w-5 h-5 text-warn" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-ok" />
          )}
          <span className="font-bold text-content">
            Análisis OCR del comprobante
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-elevated rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 overflow-auto space-y-3 text-sm">
        <div
          className={`p-3 rounded border ${
            ocrDetail.status === 'fraud_suspect'
              ? 'bg-danger/10 border-danger/30 text-danger'
              : ocrDetail.status === 'mismatch'
                ? 'bg-warn/10 border-warn/30 text-warn'
                : 'bg-ok/10 border-ok/30 text-ok'
          }`}
        >
          <div className="font-bold text-base">
            {ocrDetail.status === 'fraud_suspect'
              ? '🚨 Posible voucher reusado'
              : ocrDetail.status === 'mismatch'
                ? '⚠️ Las refs ingresadas no coinciden con la foto'
                : '✅ Datos coinciden — comprobante OK'}
          </div>
          {ocrDetail.warnings.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs space-y-1">
              {ocrDetail.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>

        {ocrDetail.duplicateInOtherOrders.length > 0 && (
          <div className="bg-danger/5 border border-danger/20 rounded p-3">
            <div className="font-bold text-danger mb-2">
              Refs detectadas en otras órdenes:
            </div>
            <ul className="space-y-1 text-xs">
              {ocrDetail.duplicateInOtherOrders.map((d, i) => (
                <li key={i} className="text-content">
                  Ref <span className="font-mono font-bold">{d.part}</span> →
                  orden{' '}
                  <span className="font-mono">
                    #{String(d.orderId).slice(-8).toUpperCase()}
                  </span>{' '}
                  ({d.source}
                  {d.amount ? `, $${Number(d.amount).toFixed(2)}` : ''})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-elevated/40 rounded p-2">
            <div className="text-dim mb-1">Refs ingresadas (mesonero)</div>
            <div className="font-mono">
              {ocrDetail.inputRefs.join(', ') || '—'}
            </div>
          </div>
          <div className="bg-elevated/40 rounded p-2">
            <div className="text-dim mb-1">Refs detectadas en foto</div>
            <div className="font-mono">
              {ocrDetail.extractedShortRefs.join(', ') || '—'}
            </div>
          </div>
          <div className="bg-elevated/40 rounded p-2">
            <div className="text-dim mb-1">Refs largas (banco)</div>
            <div className="font-mono break-all">
              {ocrDetail.extractedRefs.join(', ') || '—'}
            </div>
          </div>
          <div className="bg-elevated/40 rounded p-2">
            <div className="text-dim mb-1">Montos en Bs</div>
            <div className="font-mono">
              {ocrDetail.extractedAmountsBs
                .map((a) => a.toLocaleString('es-VE'))
                .join(', ') || '—'}
            </div>
          </div>
          <div className="bg-elevated/40 rounded p-2">
            <div className="text-dim mb-1">Códigos aprobación</div>
            <div className="font-mono">
              {ocrDetail.extractedCodes.join(', ') || '—'}
            </div>
          </div>
          <div className="bg-elevated/40 rounded p-2">
            <div className="text-dim mb-1">Imágenes procesadas</div>
            <div className="font-mono">{ocrDetail.imagesProcessed}</div>
          </div>
        </div>

        {ocrDetail.perImage.length > 0 && (
          <div>
            <div className="font-bold text-content mb-2 text-xs">
              Detalle por imagen:
            </div>
            <div className="space-y-2">
              {ocrDetail.perImage.map((p, i) => (
                <div
                  key={i}
                  className="flex gap-2 bg-elevated/40 rounded p-2 text-[11px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`img${i + 1}`}
                    className="w-16 h-16 object-cover rounded border border-line cursor-pointer"
                    onClick={() => onOpenImageModal(p.url)}
                  />
                  <div className="flex-1 space-y-0.5">
                    <div>
                      <span className="text-dim">Refs:</span>{' '}
                      <span className="font-mono">
                        {p.refs.join(', ') || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-dim">Bs:</span>{' '}
                      <span className="font-mono">
                        {p.amountsBs
                          .map((a) => a.toLocaleString('es-VE'))
                          .join(', ') || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-dim">Aprob:</span>{' '}
                      <span className="font-mono">
                        {p.codes.join(', ') || '—'}
                      </span>{' '}
                      <span className="text-dim">·</span>{' '}
                      <span>{p.type ?? '—'}</span>{' '}
                      <span className="text-dim">·</span>{' '}
                      <span>{p.status ?? '—'}</span>
                    </div>
                    {p.durationMs ? (
                      <div className="text-dim">OCR: {p.durationMs}ms</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-[10px] text-dim text-right">
          Procesado:{' '}
          {new Date(ocrDetail.processedAt).toLocaleString('es-VE', {
            timeZone: 'America/Caracas',
          })}
        </div>
      </div>
    </Modal>
  );
};

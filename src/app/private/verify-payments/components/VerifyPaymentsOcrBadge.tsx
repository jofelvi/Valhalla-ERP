import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Hourglass,
} from 'lucide-react';
import { PendingPaymentEntry, PendingPaymentOcr } from '@odin6/types';

interface VerifyPaymentsOcrBadgeProps {
  payment: PendingPaymentEntry;
  onShowDetail: (ocr: PendingPaymentOcr) => void;
}

export const VerifyPaymentsOcrBadge = ({
  payment,
  onShowDetail,
}: VerifyPaymentsOcrBadgeProps) => {
  const ocr = payment.ocr;
  const hasProofs = (payment.proofUrls?.length ?? 0) > 0;

  if (!hasProofs) return null;

  if (!ocr) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 text-[10px] bg-elevated text-dim rounded">
        <Hourglass className="w-3 h-3 animate-pulse" />
        OCR procesando…
      </span>
    );
  }

  const styles: Record<string, string> = {
    ok: 'bg-ok/15 text-ok border border-ok/30',
    mismatch: 'bg-warn/15 text-warn border border-warn/30',
    fraud_suspect: 'bg-danger/20 text-danger border border-danger/40 font-bold',
    failed: 'bg-elevated text-dim border border-line',
  };

  const labels: Record<string, string> = {
    ok: 'OCR ✓ Refs OK',
    mismatch: 'OCR ⚠ Refs no coinciden',
    fraud_suspect: '🚨 VOUCHER REUSADO',
    failed: 'OCR no leyó',
  };

  const Icon =
    ocr.status === 'fraud_suspect'
      ? ShieldAlert
      : ocr.status === 'mismatch'
        ? AlertTriangle
        : ocr.status === 'ok'
          ? CheckCircle2
          : Eye;

  return (
    <button
      type="button"
      onClick={() => onShowDetail(ocr)}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 text-[10px] rounded cursor-pointer hover:opacity-80 transition ${
        styles[ocr.status] ?? styles.failed
      }`}
      title="Click para ver detalle del OCR"
    >
      <Icon className="w-3 h-3" />
      {labels[ocr.status] ?? ocr.status}
    </button>
  );
};

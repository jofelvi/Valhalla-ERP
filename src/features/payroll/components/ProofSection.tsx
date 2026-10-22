'use client';
import { useEffect } from 'react';

interface ProofSectionProps {
  proofFile: File | null;
  proofPreview: string | null;
  showConfirm: boolean;
  onProofAccept: (file: File) => void;
  onProofRemove: () => void;
}

export function ProofSection({
  proofFile,
  proofPreview,
  showConfirm,
  onProofAccept,
  onProofRemove,
}: ProofSectionProps) {
  // Handle Ctrl+V paste event
  useEffect(() => {
    if (!showConfirm) return;

    const alPegar = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      );
      if (!item) return;
      const blob = item.getAsFile();
      if (!blob) return;
      e.preventDefault();
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      onProofAccept(
        new File([blob], `comprobante-${Date.now()}.${ext}`, {
          type: blob.type,
        }),
      );
    };

    window.addEventListener('paste', alPegar);
    return () => window.removeEventListener('paste', alPegar);
  }, [showConfirm, onProofAccept]);

  if (proofFile) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 p-2">
        {proofPreview && !proofFile.type.includes('pdf') && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proofPreview}
            alt="Comprobante del pago"
            className="h-14 w-14 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ok">Comprobante listo</p>
          <p className="truncate text-[11px] text-dim">{proofFile.name}</p>
        </div>
        <button
          type="button"
          onClick={onProofRemove}
          className="rounded-lg px-2 py-1 text-[11px] text-dim hover:bg-elevated"
        >
          Quitar
        </button>
      </div>
    );
  }

  return (
    <p className="text-xs text-accent">
      Sin comprobante — pégalo aquí con{' '}
      <kbd className="rounded border border-line px-1">Ctrl</kbd>+
      <kbd className="rounded border border-line px-1">V</kbd>
    </p>
  );
}

import { X, RotateCcw, RotateCw, ExternalLink } from 'lucide-react';
import Modal from '@/components/shared/modal';

interface VerifyPaymentsImageModalProps {
  imageUrl: string | null;
  imageRotation: number;
  onClose: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
}

export const VerifyPaymentsImageModal = ({
  imageUrl,
  imageRotation,
  onClose,
  onRotateLeft,
  onRotateRight,
}: VerifyPaymentsImageModalProps) => {
  if (!imageUrl) return null;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      capa="sobreTodo"
      classNameFondo="bg-black/80"
      classNameWrap="p-4"
      className="bg-surface rounded-lg shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden"
    >
      <div className="flex justify-between items-center p-3 border-b border-line">
        <span className="text-sm text-dim">Comprobante</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRotateLeft}
            className="p-1.5 hover:bg-elevated rounded text-dim hover:text-content"
            title="Rotar izquierda"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRotateRight}
            className="p-1.5 hover:bg-elevated rounded text-dim hover:text-content"
            title="Rotar derecha"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-elevated rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div
        className="flex items-center justify-center bg-black/40 p-4"
        style={{ minHeight: '60vh' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Comprobante full"
          className="max-h-[70vh] max-w-full object-contain transition-transform duration-200"
          style={{ transform: `rotate(${imageRotation}deg)` }}
        />
      </div>
      <div className="p-2 flex items-center justify-center gap-4 border-t border-line">
        <span className="text-xs text-dim">{imageRotation}°</span>
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline inline-flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          Abrir en nueva pestaña
        </a>
      </div>
    </Modal>
  );
};

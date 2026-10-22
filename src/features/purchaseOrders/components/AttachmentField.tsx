// Componente para el campo de adjunto (imagen/factura)
'use client';

import { ImagePlus, X, ExternalLink, FileText } from 'lucide-react';
import { isImagePreviewable } from '../utils';

interface AttachmentFieldProps {
  imageFile: File | null;
  imagePreview: string | null;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

/**
 * Componente para cargar y previsualizar adjuntos de órdenes de compra
 */
export function AttachmentField({
  imageFile,
  imagePreview,
  onImageChange,
  onRemoveImage,
}: AttachmentFieldProps) {
  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-dim mb-1">
        Orden de Compra / Factura{' '}
        <span className="text-dim font-normal">(Opcional)</span>
      </label>

      {imagePreview ? (
        <div className="flex items-center gap-3 p-3 border border-line rounded-xl bg-elevated">
          {isImagePreviewable(imageFile, imagePreview) ? (
            <img
              src={imagePreview}
              alt="Adjunto"
              className="w-16 h-16 object-cover rounded-lg border border-line flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 bg-accent/15 border border-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-8 h-8 text-accent" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-dim truncate">
              {imageFile?.name ?? 'Adjunto guardado'}
            </p>
            <a
              href={imagePreview}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand hover:underline flex items-center gap-1 mt-0.5"
            >
              <ExternalLink className="w-3 h-3" />
              Ver archivo
            </a>
          </div>
          <button
            type="button"
            onClick={onRemoveImage}
            className="p-1.5 text-danger hover:bg-danger/10 rounded-lg transition-colors flex-shrink-0"
            title="Quitar adjunto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-line rounded-xl cursor-pointer bg-elevated hover:bg-elevated hover:border-brand transition-all">
          <ImagePlus className="w-7 h-7 text-dim mb-1.5" />
          <p className="text-sm text-dim">
            <span className="text-brand font-medium">
              Click para seleccionar
            </span>{' '}
            o arrastra aquí
          </p>
          <p className="text-xs text-dim mt-1">JPG, PNG, PDF — máx. 5 MB</p>
          <input
            type="file"
            className="hidden"
            accept="image/*,.pdf"
            onChange={onImageChange}
          />
        </label>
      )}
    </div>
  );
}

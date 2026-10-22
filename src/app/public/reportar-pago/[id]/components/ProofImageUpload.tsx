import { Image as ImageIcon, Upload } from 'lucide-react';

interface ProofImageUploadProps {
  imagePreview: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProofImageUpload({
  imagePreview,
  onChange,
}: ProofImageUploadProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-dim mb-1.5">
        Comprobante (foto) *
      </label>
      <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 text-center bg-amber-50/50 hover:bg-amber-50 transition-colors cursor-pointer relative">
        <input
          type="file"
          accept="image/*"
          onChange={onChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
          required
        />
        {imagePreview ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Vista previa"
              className="max-h-40 mx-auto rounded-lg"
            />
            <p className="text-xs text-brand flex items-center justify-center gap-1">
              <ImageIcon className="w-3 h-3" />
              Toca para cambiar
            </p>
          </div>
        ) : (
          <div className="py-4">
            <Upload className="w-8 h-8 text-brand mx-auto mb-2" />
            <p className="text-sm font-medium text-amber-800">
              Toca para adjuntar foto
            </p>
            <p className="text-xs text-brand mt-1">
              Máximo 5MB · JPG, PNG
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

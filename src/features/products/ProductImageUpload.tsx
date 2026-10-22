import { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { UseFormRegister } from 'react-hook-form';
import { ProductFormData } from '@/features/types/schemaYup/productSchema';
import { FiImage } from 'react-icons/fi';

interface ProductImageUploadProps {
  imagePreview: string | null;
  setImageFile: Dispatch<SetStateAction<File | null>>;
  setImagePreview: Dispatch<SetStateAction<string | null>>;
  register: UseFormRegister<ProductFormData>;
}

export default function ProductImageUpload({
  imagePreview,
  setImageFile,
  setImagePreview,
  register,
}: ProductImageUploadProps) {
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="md:col-span-2">
      <label
        htmlFor="imageFile"
        className="block text-sm font-semibold text-dim mb-3"
      >
        Imagen del Producto
      </label>
      <div className="space-y-4">
        {/* File Input Container */}
        <div className="flex flex-col space-y-2 mt-1 h-full min-h-[200px]">
          <label className="flex flex-col items-center justify-center w-full bg-elevated/20 h-full min-h-[200px] border-2 border-dashed border-line rounded-xl cursor-pointer hover:bg-elevated/50 hover:border-brand/40 hover:text-brand transition-all duration-300 group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FiImage className="w-10 h-10 text-dim group-hover:text-brand/70 mb-3 transition-colors" />
              <p className="text-sm text-content text-center px-4">
                <span className="font-semibold text-brand group-hover:text-brand-light transition-colors">
                  Haz clic para buscar
                </span>{' '}
                o arrastra una imagen
              </p>
              <p className="text-xs text-dim mt-1">
                PNG, JPG (Recomendado 500x500px)
              </p>
            </div>
            <input
              type="file"
              id="imageFile"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        </div>
        <input type="hidden" {...register('imageUrl')} />

        {imagePreview && (
          <div className="space-y-3 mt-4">
            <p className="text-sm font-medium text-dim">Vista previa:</p>
            <div className="bg-elevated/30 p-4 rounded-xl border border-line">
              <img
                src={imagePreview}
                alt="Vista previa del producto"
                className="h-48 w-full object-contain rounded-lg shadow-sm bg-transparent"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

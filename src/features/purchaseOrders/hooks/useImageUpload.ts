// Hook para manejo de carga de imágenes en órdenes de compra
'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/hooks/useToast';
import { isValidFileSize, isImagePreviewable } from '../utils';

const MAX_FILE_SIZE_MB = 5;

interface UseImageUploadResult {
  imageFile: File | null;
  imagePreview: string | null;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  isImagePreviewable: (file: File | null, url: string) => boolean;
  setImagePreview: (url: string | null) => void;
  setImageFile: (file: File | null) => void;
}

/**
 * Hook para manejo de carga y previsualización de imágenes
 * @param initialImageUrl URL inicial de la imagen (si es edición)
 * @returns Objeto con estado y manejadores de imagen
 */
export const useImageUpload = (
  initialImageUrl?: string,
): UseImageUploadResult => {
  const toast = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialImageUrl ?? null,
  );

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!isValidFileSize(file, MAX_FILE_SIZE_MB)) {
        toast.error({
          title: 'Archivo demasiado grande',
          description: `El archivo no debe superar ${MAX_FILE_SIZE_MB} MB.`,
        });
        return;
      }

      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    },
    [toast],
  );

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
  }, []);

  return {
    imageFile,
    imagePreview,
    handleImageChange,
    handleRemoveImage,
    isImagePreviewable,
    setImagePreview,
    setImageFile,
  };
};

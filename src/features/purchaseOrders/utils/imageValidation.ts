// Utilidades para validación de imágenes en órdenes de compra

/**
 * Verifica si una imagen/archivo es previewable
 * @param file Archivo cargado (si existe)
 * @param url URL del archivo guardado
 * @returns true si es una imagen previewable, false si es otro tipo de documento
 */
export const isImagePreviewable = (file: File | null, url: string): boolean => {
  if (file) return file.type.startsWith('image/');
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
};

/**
 * Valida el tamaño del archivo
 * @param file Archivo a validar
 * @param maxSizeInMB Tamaño máximo en megabytes
 * @returns true si el archivo es válido, false si excede el límite
 */
export const isValidFileSize = (
  file: File,
  maxSizeInMB: number = 5,
): boolean => {
  return file.size <= maxSizeInMB * 1024 * 1024;
};

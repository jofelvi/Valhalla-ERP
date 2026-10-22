import { ApiError } from '@/services/api/apiClient';

/** Mensaje en español claro para el dueño. Nunca muestra el texto técnico del servidor. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return 'No tiene permiso para cambiar esta sección.';
    }
    if (error.status === 400) {
      return 'Revise los datos: alguno no es válido.';
    }
  }
  return 'No se pudo conectar con el servidor. Intente de nuevo.';
}

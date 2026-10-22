'use client';

import { api } from '@/services/api/apiClient';

/**
 * Subida de archivos contra la API propia (`POST /api/uploads/image`), que los
 * guarda en el disco del VPS y los sirve por `/uploads/...`.
 *
 * Antes iba a Firebase Storage. Las imagenes YA subidas siguen viviendo alli y
 * sus URLs guardadas en Mongo siguen funcionando: esto solo cambia donde caen
 * las NUEVAS.
 */

/** Categorias que acepta la API. */
export type CategoriaSubida =
  | 'payment-proofs'
  | 'avatars'
  | 'products'
  | 'generic'
  | 'invoices'
  | 'waste-photos'
  | 'payroll-proofs'
  | 'attendance'
  | 'categories'
  | 'employees';

/**
 * El cuerpo viaja como JSON base64, que infla ~33 %. La API y nginx aceptan
 * 30 MB, asi que se corta antes con un mensaje entendible en vez de dejar que
 * el navegador devuelva un 413 sin explicacion.
 */
const MAX_BYTES = 20 * 1024 * 1024;

const EXTENSIONES: Record<string, 'jpg' | 'png' | 'webp' | 'pdf'> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function extensionDe(
  tipo: string,
  nombre?: string,
): 'jpg' | 'png' | 'webp' | 'pdf' {
  const porTipo = EXTENSIONES[tipo?.toLowerCase()];
  if (porTipo) return porTipo;
  const suf = (nombre ?? '').split('.').pop()?.toLowerCase();
  if (suf === 'png' || suf === 'webp' || suf === 'pdf') return suf;
  return 'jpg';
}

/** Lee el archivo como base64 sin el prefijo `data:`. */
function aBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const texto = String(lector.result ?? '');
      resolve(texto.replace(/^data:[^;,]*;base64,/, ''));
    };
    lector.readAsDataURL(blob);
  });
}

async function subir(
  blob: Blob,
  category: CategoriaSubida,
  opciones: { subPath?: string; nombre?: string } = {},
): Promise<string> {
  if (blob.size > MAX_BYTES) {
    const mb = (blob.size / 1024 / 1024).toFixed(1);
    throw new Error(
      `La imagen pesa ${mb} MB y el maximo son 20 MB. Sacala con menos resolucion o recortala.`,
    );
  }

  const { url } = await api.post<{ url: string }>('/api/uploads/image', {
    category,
    ...(opciones.subPath ? { subPath: opciones.subPath } : {}),
    imageBase64: await aBase64(blob),
    extension: extensionDe(blob.type, opciones.nombre),
  });
  return url;
}

/**
 * Sube un archivo. `path` es el que se venia usando con Firebase Storage
 * ("products", "categories/portadas"...): el primer tramo escoge la categoria
 * y el resto queda como sub-ruta, para que las llamadas existentes no cambien.
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  const tramos = String(path ?? '')
    .split('/')
    .filter(Boolean);
  const categoria = (tramos[0] ?? 'generic') as CategoriaSubida;
  return subir(file, categoria, {
    subPath: tramos.slice(1).join('/') || undefined,
    nombre: file.name,
  });
};

export const uploadAttendancePhoto = async (
  photoBlob: Blob,
  employeeId: string,
): Promise<string> => subir(photoBlob, 'attendance', { subPath: employeeId });

/**
 * Comprobante de pago desde la pagina publica del cliente (`/reportar-pago`).
 *
 * Va por su propia ruta porque ahi no hay sesion: `/api/uploads/image` exige
 * token y devolveria 401 al cliente.
 */
export const subirComprobanteDePago = async (
  file: File,
  accountReceivableId: string,
): Promise<string> => {
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(
      `El comprobante pesa ${mb} MB y el maximo son 20 MB. Sacalo con menos resolucion.`,
    );
  }
  const { url } = await api.post<{ url: string }>(
    '/api/uploads/payment-proof',
    {
      category: 'payment-proofs',
      subPath: accountReceivableId,
      imageBase64: await aBase64(file),
      extension: extensionDe(file.type, file.name),
    },
  );
  return url;
};

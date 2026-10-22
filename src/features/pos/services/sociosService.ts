/**
 * Padron de socios contra la API propia.
 *
 * Antes el POS lo pedia a una ruta de Next que leia Firestore. La API sirve el
 * mismo padron desde Mongo (1083 socios, verificado uno a uno contra Firestore
 * antes del cambio: ninguno faltaba).
 */
import { api } from '@/services/api/apiClient';

export interface SocioConCredito {
  accion: number;
  cedula: string;
  nombre: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditMonthsPaid: number;
}

/** La accion se guarda con ceros a la izquierda: "4" y "00004" son el mismo socio. */
export function accionNormalizada(accion: string | number): string {
  return String(accion ?? '')
    .trim()
    .padStart(5, '0');
}

/** El socio, o null si no esta en el padron. */
export async function buscarSocio(
  accion: string | number,
): Promise<SocioConCredito | null> {
  try {
    const socio = await api.get<SocioConCredito>(
      `/api/public/members/${accionNormalizada(accion)}`,
    );
    // El fallback de la API puede devolver un cliente con numero de accion en
    // vez de un socio del padron: sin credito declarado no se puede fiar.
    if (!socio || typeof socio.creditLimit !== 'number') return null;
    return socio;
  } catch {
    return null;
  }
}

/**
 * Anota lo que el socio acaba de consumir a credito.
 *
 * Antes esto era un PATCH a una ruta de Next que solo exportaba GET: Next
 * respondia 405 y el error se tragaba en un `.catch()`, asi que el consumo no
 * se anotaba NUNCA y el limite de credito no se agotaba jamas. Por eso los
 * 1083 socios estan en creditUsed 0.
 *
 * Ahora falla ruidosamente: quien cobra tiene que enterarse de que el cargo no
 * quedo anotado.
 */
export async function anotarConsumoDeCredito(
  accion: string | number,
  monto: number,
): Promise<SocioConCredito> {
  return api.patch<SocioConCredito>(
    `/api/public/members/${accionNormalizada(accion)}/credito`,
    { monto },
  );
}

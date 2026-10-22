import { api, ApiError } from './api/apiClient';

export interface MemberData {
  accion: number;
  cedula: string;
  nombre: string;
}

/**
 * Busca un socio por numero de accion.
 */
export async function findMemberByAction(
  actionNumber: number,
): Promise<MemberData | null> {
  try {
    const raw = await api.get<MemberData>(
      `/api/public/members/${actionNumber}`,
    );
    if (!raw || typeof raw.accion !== 'number') return null;
    return { accion: raw.accion, cedula: raw.cedula, nombre: raw.nombre };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    console.error('Error buscando socio por accion:', error);
    return null;
  }
}

/**
 * Busca un socio por cedula.
 */
export async function findMemberByCedula(
  cedula: string,
): Promise<MemberData | null> {
  try {
    const raw = await api.get<MemberData>(
      `/api/public/members/by-cedula/${encodeURIComponent(cedula)}`,
    );
    if (!raw || typeof raw.accion !== 'number') return null;
    return { accion: raw.accion, cedula: raw.cedula, nombre: raw.nombre };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    console.error('Error buscando socio por cedula:', error);
    return null;
  }
}

/**
 * Calcula el credito segun el rango de ingreso (solo para socios).
 */
export function calculateCreditLimit(incomeRange: string): number {
  const creditTable: Record<string, number> = {
    menos_100: 10,
    '100_200': 15,
    '200_300': 25,
    '300_500': 35,
    '500_800': 50,
    '800_1200': 75,
    '1200_2000': 100,
    '2000_3500': 150,
    mas_3500: 200,
  };

  return creditTable[incomeRange] ?? 0;
}

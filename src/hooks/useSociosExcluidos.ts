import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';

/**
 * Socios directivos cuyo consumo NO suma al monto por cobrar.
 *
 * La lista la sirve el servidor (`configs/socios_excluidos`) y no vive en el
 * front a proposito: si cada pantalla aplicara su propia regla, el dashboard
 * diria un numero y cuentas por cobrar otro, y nadie sabria cual creer.
 */
export interface SociosExcluidos {
  habilitado: boolean;
  acciones: string[];
  motivo: string;
  customerIds: string[];
  nombres: Record<string, string>;
}

const VACIO: SociosExcluidos = {
  habilitado: false,
  acciones: [],
  motivo: '',
  customerIds: [],
  nombres: {},
};

export const sociosExcluidosKeys = {
  all: ['sociosExcluidos'] as const,
};

export function useSociosExcluidos() {
  const query = useQuery({
    queryKey: sociosExcluidosKeys.all,
    queryFn: () => api.get<SociosExcluidos>('/api/config/socios-excluidos'),
    // Cambia una vez al año; no tiene sentido re-pedirla en cada navegación.
    staleTime: 10 * 60 * 1000,
  });

  // Si la config no carga se devuelve la lista vacía: se muestra de más, nunca
  // de menos. Un fallo de red no debe hacer desaparecer plata de la pantalla.
  return { ...query, socios: query.data ?? VACIO };
}

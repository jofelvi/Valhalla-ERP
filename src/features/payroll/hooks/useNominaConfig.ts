'use client';

import { useQuery } from '@tanstack/react-query';
import { NOMINA_DEFAULT, UserRoleEnum, type NominaConfig } from '@odin6/types';
import { CONFIG_QUERY_KEYS, fetchConfig } from '@/shared/config/configService';
import { useUserStore } from '@/shared/store/useUserStore';

/**
 * Configuración de nómina (comisión, descuento a empleados, retenciones).
 * Solo ADMIN y MANAGER la pueden leer: para el resto no se hace la petición (la API
 * responde 403) y se usan los valores neutros del contrato. Esos valores solo afectan la
 * base de comisión, que el cobro no muestra ni guarda.
 */
export function useNominaConfig(): NominaConfig {
  const rol = useUserStore((s) => s.user?.role);
  const puedeLeer = rol === UserRoleEnum.ADMIN || rol === UserRoleEnum.MANAGER;
  const { data } = useQuery({
    queryKey: CONFIG_QUERY_KEYS.doc('nomina'),
    queryFn: () => fetchConfig('nomina'),
    enabled: puedeLeer,
    staleTime: 60 * 1000,
  });
  return data?.valor ?? NOMINA_DEFAULT;
}

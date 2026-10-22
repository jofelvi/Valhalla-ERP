'use client';

import { useSession } from 'next-auth/react';
import { UserRoleEnum } from '@/shared/types/enumShared';

/**
 * Permisos de Ajustes. Espejo de `ConfigsController`: GET para ADMIN y MANAGER,
 * PATCH solo para ADMIN. La pantalla NO decide seguridad; la API la hace cumplir.
 */
export function useAcceso() {
  const { data, status } = useSession();
  const rol = data?.user?.role;
  return {
    cargandoSesion: status === 'loading',
    puedeVer: rol === UserRoleEnum.ADMIN || rol === UserRoleEnum.MANAGER,
    puedeEditar: rol === UserRoleEnum.ADMIN,
  };
}

'use client';

import { useMemo } from 'react';
import { useNegocio } from '@/shared/config';
import { nombreBanco } from '@/shared/constants/banks';

/** Datos de Pago Móvil del negocio para mostrar al cliente. `null` si el negocio no los cargó. */
export function usePagoMovilDestino(): {
  banco: string;
  telefono: string;
  cedula: string;
} | null {
  const pm = useNegocio().mobilePayment;
  return useMemo(
    () =>
      pm
        ? {
            banco: nombreBanco(pm.bank),
            telefono: pm.phone,
            cedula: pm.documentId,
          }
        : null,
    [pm],
  );
}

'use client';

import { useMemo } from 'react';
import { useConfig } from '@/shared/config';
import type { ContextoPdf } from '@/shared/utils/pdfGenerator';

/** Negocio y marca para los PDF y correos que se generan en el navegador. */
export function useContextoPdf(): ContextoPdf {
  const { negocio, marca, tarifas } = useConfig();
  return useMemo(
    () => ({ negocio, marca, tarifas }),
    [negocio, marca, tarifas],
  );
}

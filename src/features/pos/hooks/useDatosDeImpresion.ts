'use client';

import { useMemo } from 'react';
import { nombreVisible } from '@odin6/types';
import { useConfig } from '@/shared/config';
import type { DatosDeImpresion } from '../services/thermalPrintService';

/**
 * Datos del negocio para ticket, recibo y precuenta, sacados de la configuración.
 * Las pantallas los pasan a `printThermalReceipt` / `printPrecuenta` como `datos`.
 */
export function useDatosDeImpresion(): DatosDeImpresion {
  const { marca, negocio, tarifas } = useConfig();
  return useMemo(
    () => ({ nombre: nombreVisible(marca, negocio), negocio, tarifas }),
    [marca, negocio, tarifas],
  );
}

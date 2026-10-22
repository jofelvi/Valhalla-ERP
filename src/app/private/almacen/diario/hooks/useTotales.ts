import { useMemo } from 'react';

interface ProductoTabla {
  cantidadSeleccionada: number;
  seleccionado: boolean;
  precio: number;
}

interface Totales {
  productos: number;
  unidades: number;
  valorEstimado: number;
}

export const useTotales = (productosTabla: ProductoTabla[]): Totales => {
  return useMemo(() => {
    const seleccionados = productosTabla.filter(
      (p) => p.seleccionado && p.cantidadSeleccionada > 0,
    );
    return {
      productos: seleccionados.length,
      unidades: seleccionados.reduce(
        (sum, p) => sum + p.cantidadSeleccionada,
        0,
      ),
      valorEstimado: seleccionados.reduce(
        (sum, p) => sum + p.cantidadSeleccionada * p.precio,
        0,
      ),
    };
  }, [productosTabla]);
};

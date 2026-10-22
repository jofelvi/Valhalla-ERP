import { useCallback, useState, useEffect } from 'react';
import { useToast } from '@/components/hooks/useToast';
import { api } from '@/services/api/apiClient';
import { useProducts } from '@/hooks/useProducts';
import { AlmacenDiario, PlantillaStockItem } from '@odin6/types';
import { Product } from '@odin6/types';
import { AlmacenGeneral } from '@odin6/types';

interface ProductoTabla {
  id: string;
  nombre: string;
  categoria: string;
  stockGeneral: number;
  cantidadSeleccionada: number;
  seleccionado: boolean;
  precio: number;
}

export const useAlmacenDiario = () => {
  const { data: productsData = [] } = useProducts();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [diaActivo, setDiaActivo] = useState<AlmacenDiario | null>(null);
  const [productos, setProductos] = useState<Product[]>([]);
  const [productosTabla, setProductosTabla] = useState<ProductoTabla[]>([]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [dia, almacen, plantilla] = await Promise.all([
        api
          .get<AlmacenDiario | null>('/api/almacen/diario/activo')
          .catch(() => null),
        api
          .get<AlmacenGeneral | null>('/api/almacen/general')
          .catch(() => null),
        api
          .get<{
            productos: PlantillaStockItem[];
          } | null>('/api/almacen/plantillas/default')
          .catch(() => null),
      ]);

      setDiaActivo(dia);

      // Mostrar productos activos (isForSale o isActive)
      const productosDisponibles = productsData.filter(
        (p) => p.isForSale || p.isActive,
      );
      setProductos(productosDisponibles);

      // Crear Maps para lookup O(1) en vez de find() O(n) por producto
      const stockMap = new Map(
        (almacen?.productos || []).map((ag) => [ag.productId, ag]),
      );
      const plantillaMap = new Map(
        (plantilla?.productos || [])
          .filter((pl) => pl.activo)
          .map((pl) => [pl.productId, pl]),
      );

      const productosParaTabla: ProductoTabla[] = productosDisponibles
        .map((p) => {
          const stockItem = stockMap.get(p.id);
          const stockGeneral = stockItem?.stockDisponible ?? p.stock ?? 0;
          const itemPlantilla = plantillaMap.get(p.id);

          return {
            id: p.id,
            nombre: p.name,
            categoria: p.categoryId || 'Sin categoría',
            stockGeneral,
            cantidadSeleccionada: itemPlantilla
              ? Math.min(itemPlantilla.cantidadDefault, stockGeneral)
              : 0,
            seleccionado: !!itemPlantilla,
            precio: p.price,
          };
        })
        .filter((p) => p.stockGeneral > 0);

      setProductosTabla(productosParaTabla);

      console.log('Productos cargados:', {
        total: productsData.length,
        disponibles: productosDisponibles.length,
        conStock: productosParaTabla.length,
        almacenGeneral: almacen?.productos?.length || 0,
      });
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
      });
    } finally {
      setLoading(false);
    }
  }, [productsData, toast]);

  useEffect(() => {
    void cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actualizarCantidad = useCallback(
    (productId: string, cantidad: number) => {
      setProductosTabla((prev) =>
        prev.map((p) => {
          if (p.id === productId) {
            const nuevaCantidad = Math.max(
              0,
              Math.min(cantidad, p.stockGeneral),
            );
            return {
              ...p,
              cantidadSeleccionada: nuevaCantidad,
              seleccionado: nuevaCantidad > 0 ? true : p.seleccionado,
            };
          }
          return p;
        }),
      );
    },
    [],
  );

  const toggleSeleccion = useCallback((productId: string) => {
    setProductosTabla((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const nuevoSeleccionado = !p.seleccionado;
          return {
            ...p,
            seleccionado: nuevoSeleccionado,
            cantidadSeleccionada:
              nuevoSeleccionado && p.cantidadSeleccionada === 0
                ? 1
                : p.cantidadSeleccionada,
          };
        }
        return p;
      }),
    );
  }, []);

  const toggleTodos = useCallback((seleccionar: boolean) => {
    setProductosTabla((prev) =>
      prev.map((p) => ({
        ...p,
        seleccionado: seleccionar,
        cantidadSeleccionada:
          seleccionar && p.cantidadSeleccionada === 0
            ? 1
            : p.cantidadSeleccionada,
      })),
    );
  }, []);

  return {
    loading,
    diaActivo,
    setDiaActivo,
    productos,
    productosTabla,
    setProductosTabla,
    cargarDatos,
    actualizarCantidad,
    toggleSeleccion,
    toggleTodos,
  };
};

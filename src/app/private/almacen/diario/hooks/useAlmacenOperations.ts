import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { useToast } from '@/components/hooks/useToast';
import { api } from '@/services/api/apiClient';
import { AlmacenDiario, PlantillaStockItem } from '@odin6/types';

interface ProductoTabla {
  id: string;
  nombre: string;
  cantidadSeleccionada: number;
  seleccionado: boolean;
  precio: number;
  stockGeneral: number;
}

interface UseAlmacenOperationsParams {
  productosTabla: ProductoTabla[];
  onAbrirSuccess: (nuevoAlmacen: AlmacenDiario) => void;
  onCerrarSuccess: (almacenCerrado: AlmacenDiario) => void;
  cargarDatos: () => Promise<void>;
}

export const useAlmacenOperations = ({
  productosTabla,
  onAbrirSuccess,
  onCerrarSuccess,
  cargarDatos,
}: UseAlmacenOperationsParams) => {
  const { data: session } = useSession();
  const toast = useToast();

  const [abriendo, setAbriendo] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  const handleAbrirDia = useCallback(async () => {
    const productosSeleccionados = productosTabla.filter(
      (p) => p.seleccionado && p.cantidadSeleccionada > 0,
    );

    if (productosSeleccionados.length === 0) {
      toast.error({
        title: 'Error',
        description: 'Selecciona al menos un producto con cantidad mayor a 0',
      });
      return;
    }

    setAbriendo(true);
    try {
      const nuevoAlmacen = await api.post<AlmacenDiario>(
        '/api/almacen/diario/abrir',
        {
          fecha: new Date(),
          stockInicial: productosSeleccionados.map((p) => ({
            productId: p.id,
            cantidad: p.cantidadSeleccionada,
          })),
          usuario: session?.user?.name || session?.user?.email || 'cajero',
          notas: `Apertura de caja - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
        },
      );

      onAbrirSuccess(nuevoAlmacen);

      toast.success({
        title: 'Día abierto',
        description: `Caja abierta con ${productosSeleccionados.length} productos`,
      });

      await cargarDatos();
    } catch (error) {
      console.error('Error abriendo día:', error);
      toast.error({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'No se pudo abrir el día',
      });
    } finally {
      setAbriendo(false);
    }
  }, [productosTabla, session, toast, onAbrirSuccess, cargarDatos]);

  const handleGuardarPlantilla = useCallback(async () => {
    const productosSeleccionados = productosTabla.filter(
      (p) => p.seleccionado && p.cantidadSeleccionada > 0,
    );

    if (productosSeleccionados.length === 0) {
      toast.error({
        title: 'Error',
        description:
          'Selecciona al menos un producto para guardar la plantilla',
      });
      return;
    }

    setGuardandoPlantilla(true);
    try {
      const items: PlantillaStockItem[] = productosSeleccionados.map((p) => ({
        productId: p.id,
        productName: p.nombre,
        cantidadDefault: p.cantidadSeleccionada,
        activo: true,
      }));

      await api.post('/api/almacen/plantillas', {
        productos: items,
        nombre: 'Plantilla Principal',
        isDefault: true,
        usuario: session?.user?.name || session?.user?.email,
      });

      toast.success({
        title: 'Plantilla guardada',
        description: `Se guardaron ${items.length} productos en la plantilla`,
      });
    } catch (error) {
      console.error('Error guardando plantilla:', error);
      toast.error({
        title: 'Error',
        description: 'No se pudo guardar la plantilla',
      });
    } finally {
      setGuardandoPlantilla(false);
    }
  }, [productosTabla, session, toast]);

  const handleCerrarDia = useCallback(
    async (diaActivo: AlmacenDiario | null) => {
      if (!diaActivo) return;

      setCerrando(true);
      try {
        const almacenCerrado = await api.post<AlmacenDiario>(
          '/api/almacen/diario/cerrar',
          {
            diaId: diaActivo.id,
            usuario: session?.user?.name || session?.user?.email || 'cajero',
            notasCierre: `Cierre de caja - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
          },
        );

        onCerrarSuccess(almacenCerrado);

        toast.success({
          title: 'Día cerrado',
          description: `Total ventas: $${almacenCerrado.resumen?.montoTotalVentas.toFixed(2) || '0.00'}`,
        });

        await cargarDatos();
      } catch (error) {
        console.error('Error cerrando día:', error);
        toast.error({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'No se pudo cerrar el día',
        });
      } finally {
        setCerrando(false);
      }
    },
    [session, toast, onCerrarSuccess, cargarDatos],
  );

  return {
    abriendo,
    cerrando,
    guardandoPlantilla,
    handleAbrirDia,
    handleGuardarPlantilla,
    handleCerrarDia,
  };
};

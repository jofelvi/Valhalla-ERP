'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { Panel } from '@/components/shared/panel/Panel';
import {
  IconoEnCuadro,
  TituloDePantalla,
} from '@/components/shared/cabecera/CabeceraDePantalla';
import { useAlmacenDiario, useAlmacenOperations, useTotales } from './hooks';
import { CashDashboard, ClosedCashSetup, CloseCashModal } from './components';

export default function AlmacenDiarioPage() {
  const [showCerrarModal, setShowCerrarModal] = useState(false);

  const {
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
  } = useAlmacenDiario();

  const totales = useTotales(productosTabla);

  const {
    abriendo,
    cerrando,
    guardandoPlantilla,
    handleAbrirDia,
    handleGuardarPlantilla,
    handleCerrarDia,
  } = useAlmacenOperations({
    productosTabla,
    onAbrirSuccess: setDiaActivo,
    onCerrarSuccess: () => {
      setDiaActivo(null);
      setShowCerrarModal(false);
    },
    cargarDatos,
  });

  const handleLoadAllStock = () => {
    setProductosTabla((prev) =>
      prev.map((p) => ({
        ...p,
        seleccionado: true,
        cantidadSeleccionada: p.stockGeneral,
      })),
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
          <p className="mt-4 text-dim">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      {/* Header */}
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        <Panel className="p-3.5 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconoEnCuadro>
              <Package className="w-5 h-5 text-brand" />
            </IconoEnCuadro>
            <TituloDePantalla
              titulo="Almacen Diario"
              subtitulo={
                <>
                  {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                  {diaActivo && ' • Caja Abierta'}
                </>
              }
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={cargarDatos}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </Panel>
      </div>

      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4 space-y-4">
        {diaActivo ? (
          <CashDashboard
            diaActivo={diaActivo}
            onCloseCash={() => setShowCerrarModal(true)}
            productos={productos}
          />
        ) : (
          <ClosedCashSetup
            productos={productosTabla}
            totales={totales}
            onToggleSelection={toggleSeleccion}
            onUpdateQuantity={actualizarCantidad}
            onSelectAll={() => toggleTodos(true)}
            onDeselectAll={() => toggleTodos(false)}
            onLoadAllStock={handleLoadAllStock}
            onSaveTemplate={handleGuardarPlantilla}
            onOpenCash={handleAbrirDia}
            isLoadingTemplate={guardandoPlantilla}
            isLoadingOpen={abriendo}
          />
        )}
      </div>

      {/* Modal Cerrar Día */}
      <CloseCashModal
        isOpen={showCerrarModal}
        onClose={() => setShowCerrarModal(false)}
        onConfirm={() => handleCerrarDia(diaActivo)}
        isLoading={cerrando}
        diaActivo={diaActivo}
      />
    </div>
  );
}

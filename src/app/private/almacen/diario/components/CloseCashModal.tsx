'use client';
import { AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import Modal from '@/components/shared/modal';
import { formatTime } from '@/shared/utils/dateHelpers';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import { AlmacenDiario } from '@odin6/types';

interface CloseCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  diaActivo: AlmacenDiario | null;
}

export const CloseCashModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  diaActivo,
}: CloseCashModalProps) => {
  if (!diaActivo) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-danger/15 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-content">Cerrar Caja</h2>
            <p className="text-sm text-dim">Esta acción no se puede deshacer</p>
          </div>
        </div>

        <div className="bg-elevated rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-dim">Hora apertura:</span>
            <span className="font-medium">
              {formatTime(diaActivo.horaApertura)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-dim">Productos iniciales:</span>
            <span className="font-medium">
              {diaActivo.stockInicial.reduce((sum, s) => sum + s.cantidad, 0)}
            </span>
          </div>
          <FilaDeResumen
            className="text-sm"
            etiqueta="Órdenes realizadas:"
            classNameEtiqueta="text-dim"
            valor={diaActivo.ventasRef.length}
            classNameValor="font-medium"
          />
          <div className="flex justify-between text-sm border-t pt-2 mt-2">
            <span className="text-content font-medium">Total ventas:</span>
            <span className="font-bold text-ok">
              $
              {diaActivo.ventasRef
                .reduce((sum, v) => sum + v.total, 0)
                .toFixed(2)}
            </span>
          </div>
        </div>

        <p className="text-sm text-dim mb-4">
          Al cerrar la caja se calculará el stock final y se generará el resumen
          del día.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-danger hover:bg-danger/80 text-on-brand"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Cerrando...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Cerrar Caja
              </div>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

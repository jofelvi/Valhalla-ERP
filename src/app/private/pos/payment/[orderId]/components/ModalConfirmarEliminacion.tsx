'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import Modal from '@/components/shared/modal';

interface ModalConfirmarEliminacionProps {
  isOpen: boolean;
  nombreItem: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirmación de borrado de un ítem de la orden en la pantalla de cobro. */
export function ModalConfirmarEliminacion({
  isOpen,
  nombreItem,
  onCancel,
  onConfirm,
}: ModalConfirmarEliminacionProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-danger/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-danger" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-content">
              Confirmar eliminación
            </h3>
            <p className="text-sm text-dim">Esta acción no se puede deshacer</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-dim">
            ¿Estás seguro de que deseas eliminar{' '}
            <span className="font-semibold text-danger">{nombreItem}</span> de
            la orden?
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="px-4 py-2 border-line text-dim hover:bg-elevated"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-danger hover:bg-danger text-on-brand"
          >
            Eliminar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

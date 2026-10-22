// features/shared/DeleteConfirmationModal.tsx
'use client';

import { FiAlertTriangle, FiTrash2, FiX } from 'react-icons/fi';
import Modal from '@/components/shared/modal';
import { Button } from '@/components/shared/button/Button';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  onConfirmAction: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
  items?: string[]; // Lista de productos asociados
}

export const DeleteConfirmationModal = ({
  isOpen,
  onCloseAction,
  onConfirmAction,
  title,
  description,
  isLoading = false,
  items = [],
}: DeleteConfirmationModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onCloseAction}>
      <div className="bg-surface rounded-lg p-6 max-w-md w-full">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <FiAlertTriangle className="h-6 w-6 text-danger" />
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-content">{title}</h3>
            <div className="mt-2">
              <p className="text-sm text-dim">{description}</p>

              {items.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-dim">
                    Productos asociados ({items.length}):
                  </p>
                  <div className="mt-2 max-h-40 overflow-y-auto border border-line rounded-md p-2">
                    <ul className="list-disc pl-5 space-y-1">
                      {items.slice(0, 10).map((item, index) => (
                        <li key={index} className="text-sm text-dim truncate">
                          {item}
                        </li>
                      ))}
                      {items.length > 10 && (
                        <li className="text-sm text-dim">
                          ...y {items.length - 10} más
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onCloseAction}
            disabled={isLoading}
            className="border-line"
          >
            <FiX className="mr-2" /> Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmAction}
            isLoading={isLoading}
            startIcon={<FiTrash2 />}
          >
            Eliminar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

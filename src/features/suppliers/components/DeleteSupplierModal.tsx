'use client';

import { Supplier } from '@odin6/types';
import Modal from '@/components/shared/modal';
import { Button } from '@/shared';
import { AlertTriangle } from 'lucide-react';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

interface DeleteSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  supplier: Supplier | null;
  isDeleting: boolean;
}

export default function DeleteSupplierModal({
  isOpen,
  onClose,
  onConfirm,
  supplier,
  isDeleting,
}: DeleteSupplierModalProps) {
  if (!supplier) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        {/* Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 mb-4">
          <AlertTriangle className="h-8 w-8 text-danger" />
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-semibold text-content">
            Eliminar Proveedor
          </h3>
        </div>

        {/* Message */}
        <div className="text-center mb-6">
          <p className="text-dim">
            ¿Estás seguro de que deseas eliminar el proveedor{' '}
            <span className="font-semibold text-content">
              &#34;{supplier.name}&#34;
            </span>
            ?
          </p>
          <p className="text-sm text-dim mt-2">
            Esta acción no se puede deshacer y eliminará toda la información
            relacionada con este proveedor.
          </p>
        </div>

        {/* Supplier Details */}
        <div className="bg-elevated rounded-lg p-4 mb-6">
          <div className="text-sm space-y-2">
            <FilaDeResumen
              etiqueta="Nombre:"
              classNameEtiqueta="text-dim"
              valor={supplier.name}
              classNameValor="font-medium text-content"
            />
            {supplier.contactName && (
              <div className="flex justify-between">
                <span className="text-dim">Contacto:</span>
                <span className="font-medium text-content">
                  {supplier.contactName}
                </span>
              </div>
            )}
            {supplier.phone && (
              <div className="flex justify-between">
                <span className="text-dim">Teléfono:</span>
                <span className="font-medium text-content">
                  {supplier.phone}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-dim">Estado:</span>
              <span
                className={`font-medium ${
                  supplier.isActive ? 'text-ok' : 'text-danger'
                }`}
              >
                {supplier.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="px-6"
          >
            Cancelar
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-6 bg-danger hover:bg-danger/90 text-on-brand"
          >
            {isDeleting ? 'Eliminando...' : 'Eliminar Proveedor'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

'use client';
import Modal from '@/components/shared/modal';
import { useState, useEffect, useCallback } from 'react';
import { XIcon, Loader2, Plus, Edit2 } from 'lucide-react';
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
} from '@/hooks/useInventory';

interface PlacesModalProps {
  onClose: () => void;
}

export default function PlacesModal({ onClose }: PlacesModalProps) {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Cerrar modal con Escape
  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleEscapeKey]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError('El nombre del lugar es requerido');
      return;
    }

    try {
      await createSupplier.mutateAsync({ name: newName.trim() });
      setNewName('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear lugar');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) {
      setError('El nombre del lugar es requerido');
      return;
    }

    try {
      await updateSupplier.mutateAsync({
        id,
        data: { name: editingName.trim() },
      });
      setEditingId(null);
      setEditingName('');
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al actualizar lugar',
      );
    }
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/50"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl border border-line shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface border-b border-line p-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-content">
          Lugares (Proveedores)
        </h2>
        <button
          onClick={onClose}
          className="text-dim hover:text-content transition-colors"
        >
          <XIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-danger/10 border border-danger rounded-lg p-3">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Create New */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-content block">
            Crear Nuevo Lugar
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del lugar"
              className="flex-1 px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createSupplier.isPending}
              className="px-3 py-2 rounded-lg bg-accent text-on-brand hover:bg-accent/90 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {createSupplier.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          <label className="text-sm font-medium text-content block">
            Lugares Existentes
          </label>
          {isLoading ? (
            <div className="text-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-accent mx-auto" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-6 text-dim text-sm">
              Sin lugares registrados
            </div>
          ) : (
            <div className="space-y-2">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex items-center gap-2 p-3 rounded-lg bg-elevated border border-line hover:bg-elevated/80"
                >
                  {editingId === supplier.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-2 py-1 bg-surface border border-line rounded text-content text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdate(supplier.id)}
                        disabled={updateSupplier.isPending}
                        className="px-2 py-1 rounded bg-ok text-on-brand text-xs font-medium hover:bg-ok/90 disabled:opacity-40"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingName('');
                        }}
                        className="px-2 py-1 rounded bg-elevated text-content text-xs font-medium hover:bg-elevated/80"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-content">
                        {supplier.name}
                      </span>
                      <button
                        onClick={() => startEdit(supplier.id, supplier.name)}
                        className="text-accent hover:bg-accent/10 rounded p-1.5 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-surface border-t border-line p-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-elevated text-content hover:bg-elevated/80 transition-colors text-sm font-medium"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

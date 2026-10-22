'use client';

import { useMemo } from 'react';
import Modal from '@/components/shared/modal';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { XIcon } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
}

interface LinkCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerSearch: string;
  onSearchChange: (value: string) => void;
  customers: Customer[];
  /** La busqueda va al servidor: hay un momento sin resultados que no es "no hay". */
  buscandoClientes: boolean;
  onSelectCustomer: (customerId: string) => Promise<void>;
  onUnlinkCustomer: () => Promise<void>;
  employeeHasLinkedCustomer: boolean;
}

export const LinkCustomerModal = ({
  isOpen,
  onClose,
  customerSearch,
  onSearchChange,
  customers,
  buscandoClientes,
  onSelectCustomer,
  onUnlinkCustomer,
  employeeHasLinkedCustomer,
}: LinkCustomerModalProps) => {
  // La busqueda la hace el servidor (`/api/customers/search`). Este
  // `useBusqueda` queda como red: si algun dia el endpoint devolviera de mas,
  // la lista sigue acotada a lo escrito.
  const searched = useBusqueda(customers, customerSearch, ['name']);
  const filteredCustomers = useMemo(() => searched.slice(0, 20), [searched]);

  // El endpoint exige 3 letras. Sin decirlo, escribir "jo" mostraria "Sin
  // resultados" y pareceria que el cliente no existe.
  const faltanLetras = customerSearch.trim().length < 3;

  if (!isOpen) return null;

  const handleSelectClick = async (customerId: string) => {
    await onSelectCustomer(customerId);
    onClose();
    onSearchChange('');
  };

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/60"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-line"
    >
      <div className="flex items-center justify-between p-5 border-b border-line">
        <h2 className="font-semibold text-content">
          Vincular Cuenta de Cliente
        </h2>
        <button
          onClick={() => {
            onClose();
            onSearchChange('');
          }}
          className="text-dim hover:text-content"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="p-5 space-y-3">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={customerSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-content focus:outline-none focus:ring-2 focus:ring-brand/30 text-sm"
          autoFocus
        />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filteredCustomers.map((c: Customer) => (
            <button
              key={c.id}
              onClick={() => handleSelectClick(c.id)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-elevated transition-colors text-sm"
            >
              <span className="font-medium text-content">{c.name}</span>
              {c.phone && <span className="text-dim ml-2">{c.phone}</span>}
            </button>
          ))}
          {filteredCustomers.length === 0 && (
            <p className="text-center text-dim text-sm py-4">
              {faltanLetras
                ? 'Escribí al menos 3 letras del nombre'
                : buscandoClientes
                  ? 'Buscando…'
                  : 'Sin resultados'}
            </p>
          )}
        </div>
        {employeeHasLinkedCustomer && (
          <button
            onClick={onUnlinkCustomer}
            className="w-full text-center text-xs text-danger hover:underline py-1"
          >
            Quitar vinculación
          </button>
        )}
      </div>
    </Modal>
  );
};

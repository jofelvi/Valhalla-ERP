'use client';

import { Customer } from '@/modelTypes/customer';
import { useState } from 'react';
import { Card } from '@/components/shared/card/card';
import { Button } from '@/components/shared/button/Button';
import { useSearchCustomers, useCreateCustomer } from '@/hooks/useCustomers';
import { Input } from '@/components/shared/input/input';
import { useToast } from '@/components/hooks/useToast';
import { ApiError } from '@/services/api/apiClient';
import Modal from '../../components/shared/modal';
import { IdentificationType } from '@/shared';
import {
  CustomerFormData,
  customerSchema,
} from '@/shared/schemas/customerSchema';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

interface CustomerSearchProps {
  onSelectCustomerAction: (customer: Customer | null) => void;
  selectedCustomer: Customer | null;
}

export default function CustomerSearch({
  onSelectCustomerAction,
  selectedCustomer,
}: CustomerSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const createCustomer = useCreateCustomer();
  const toast = useToast();
  const { data: searchResults = [], isLoading: isSearching } =
    useSearchCustomers(searchTerm);

  // Form para crear nuevo cliente
  const {
    register,
    handleSubmit: handleNewCustomerSubmit,
    formState: { errors: newCustomerErrors },
    reset: resetNewCustomerForm,
  } = useForm<CustomerFormData>({
    resolver: yupResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: null,
      address: null,
      identificationId: null,
      identificationType: null,
    },
  });

  const handleSearch = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleSelectCustomer = (e: React.MouseEvent, customer: Customer) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectCustomerAction(customer);
    setSearchTerm(''); // vaciar el query invalida la busqueda del hook
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectCustomerAction(null);
  };

  const handleOpenNewCustomerModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetNewCustomerForm();
  };

  const onSubmitNewCustomer = async (data: CustomerFormData) => {
    try {
      // Los campos opcionales vacios llegan como '' del form; el backend
      // valida formato (@IsEmail) sobre '' y responde 400 — no enviarlos.
      const newCustomer = await createCustomer.mutateAsync({
        name: data.name,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        identificationId: data.identificationId || undefined,
        identificationType: data.identificationType || undefined,
        isActive: true,
      });

      onSelectCustomerAction(newCustomer);
      handleCloseModal();
    } catch (error) {
      let description = 'Intenta de nuevo';
      if (error instanceof ApiError) {
        try {
          const parsed = JSON.parse(error.message) as {
            message?: string | string[];
          };
          description = Array.isArray(parsed.message)
            ? parsed.message.join(', ')
            : (parsed.message ?? error.message);
        } catch {
          description = error.message;
        }
      }
      toast.error({ title: 'No se pudo crear el cliente', description });
    }
  };

  return (
    <>
      <div className="space-y-4">
        {selectedCustomer ? (
          <Card className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">{selectedCustomer.name}</h3>
                <p className="text-sm text-dim">{selectedCustomer.phone}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
              >
                Cambiar
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Nombre, teléfono, cédula o N° socio"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button
                type="button"
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <Card className="p-2 max-h-60 overflow-y-auto">
                <ul className="divide-y">
                  {searchResults.map((customer) => (
                    <li key={customer.id} className="py-2">
                      <button
                        type="button"
                        className="w-full text-left hover:bg-elevated p-2 rounded"
                        onClick={(e) => handleSelectCustomer(e, customer)}
                      >
                        <h3 className="font-medium">{customer.name}</h3>
                        <p className="text-sm text-dim">
                          {customer.phone}
                          {customer.memberAction && (
                            <span className="ml-2 text-accent">
                              · Socio #{customer.memberAction}
                            </span>
                          )}
                          {customer.identificationId &&
                            !customer.memberAction && (
                              <span className="ml-2">
                                · CI: {customer.identificationId}
                              </span>
                            )}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleOpenNewCustomerModal}
          >
            + Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* modal para crear nuevo cliente */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        <div className="p-6 w-full">
          <h2 className="text-xl font-bold mb-4">Crear Nuevo Cliente</h2>

          <form
            onSubmit={handleNewCustomerSubmit(onSubmitNewCustomer)}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <Input
                {...register('name')}
                type="text"
                placeholder="Nombre del cliente"
              />
              {newCustomerErrors.name && (
                <p className="text-danger text-sm mt-1">
                  {newCustomerErrors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Teléfono *
              </label>
              <Input
                {...register('phone')}
                type="tel"
                placeholder="Teléfono del cliente"
              />
              {newCustomerErrors.phone && (
                <p className="text-danger text-sm mt-1">
                  {newCustomerErrors.phone.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tipo de Identificación
              </label>
              <select
                {...register('identificationType')}
                className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="">Seleccionar tipo</option>
                <option value={IdentificationType.V}>V - Venezolano</option>
                <option value={IdentificationType.E}>E - Extranjero</option>
                <option value={IdentificationType.J}>J - Jurídico</option>
                <option value={IdentificationType.G}>G - Gubernamental</option>
                <option value={IdentificationType.A}>
                  A - Número de Acción
                </option>
              </select>
              {newCustomerErrors.identificationType && (
                <p className="text-danger text-sm mt-1">
                  {newCustomerErrors.identificationType.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Número de Identificación
              </label>
              <Input
                {...register('identificationId')}
                type="text"
                placeholder="Número de identificación (opcional)"
              />
              {newCustomerErrors.identificationId && (
                <p className="text-danger text-sm mt-1">
                  {newCustomerErrors.identificationId.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                {...register('email')}
                type="email"
                placeholder="Email del cliente (opcional)"
              />
              {newCustomerErrors.email && (
                <p className="text-danger text-sm mt-1">
                  {newCustomerErrors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Dirección
              </label>
              <Input
                {...register('address')}
                type="text"
                placeholder="Dirección del cliente (opcional)"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createCustomer.isPending}
                className="flex-1"
              >
                {createCustomer.isPending ? 'Creando...' : 'Crear Cliente'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

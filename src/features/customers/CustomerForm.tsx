'use client';

import { useForm } from 'react-hook-form';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { Customer } from '@odin6/types';
import { User } from '@odin6/types';
import { IdentificationType } from '@/shared';
import { useUsers } from '@/hooks/useUsers';
import { useCreateCustomer, useUpdateCustomer } from '@/hooks/useCustomers';
import { Input } from '@/components/shared/input/input';
import { Button } from '@/components/shared/button/Button';
import { useToast } from '@/components/hooks/useToast';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { Link, Search, UserCheck, X } from 'lucide-react';

interface CustomerFormValues {
  name: string;
  email: string;
  phone: string;
  address: string;
  identificationType: IdentificationType | '';
  identificationId: string;
  isActive: boolean;
}

interface CustomerFormProps {
  initialData?: Customer | null;
  isNew?: boolean;
}

export default function CustomerForm({
  initialData = null,
  isNew = false,
}: CustomerFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const { data: usersData = [] } = useUsers();

  // Estado para vinculación de usuario existente
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [linkedUser, setLinkedUser] = useState<User | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    defaultValues: initialData
      ? {
          name: initialData.name,
          email: initialData.email ?? '',
          phone: initialData.phone ?? '',
          address: initialData.address ?? '',
          identificationType: initialData.identificationType ?? '',
          identificationId: initialData.identificationId ?? '',
          isActive: initialData.isActive ?? true,
        }
      : {
          name: '',
          email: '',
          phone: '',
          address: '',
          identificationType: '',
          identificationId: '',
          isActive: true,
        },
  });

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Si hay initialData con linkedUserId, buscar el usuario vinculado
  useEffect(() => {
    if (initialData?.linkedUserId && usersData.length > 0) {
      const found = usersData.find((u) => u.id === initialData.linkedUserId);
      if (found) setLinkedUser(found);
    }
  }, [initialData?.linkedUserId, usersData]);

  const filteredUsers = useBusqueda(usersData, userSearch, ['name', 'email']);

  const handleSelectUser = (user: User) => {
    setLinkedUser(user);
    setShowUserDropdown(false);
    setUserSearch('');
    // Auto-rellenar campos del formulario con datos del usuario
    setValue('name', user.name);
    setValue('email', user.email);
  };

  const handleUnlinkUser = () => {
    setLinkedUser(null);
  };

  const onSubmit = async (data: CustomerFormValues) => {
    setIsSubmitting(true);
    try {
      const payload: Omit<Customer, 'id'> = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        identificationType: data.identificationType || null,
        identificationId: data.identificationId || null,
        isActive: data.isActive,
        createdAt: initialData?.createdAt ?? new Date(),
        updatedAt: new Date(),
        linkedUserId: linkedUser?.id ?? null,
      };

      if (isNew) {
        await createCustomer.mutateAsync(payload);
        toast.success({
          title: 'Cliente creado',
          description: `${data.name} ha sido registrado exitosamente`,
        });
      } else if (initialData?.id) {
        await updateCustomer.mutateAsync({ id: initialData.id, data: payload });
        toast.success({
          title: 'Cliente actualizado',
          description: `${data.name} ha sido actualizado exitosamente`,
        });
      }

      router.push(PRIVATE_ROUTES.CUSTOMERS);
    } catch {
      toast.error({
        title: 'Error',
        description: 'No se pudo guardar el cliente. Intenta nuevamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Vincular usuario del sistema ── */}
      <div className="border border-line bg-elevated rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-semibold text-content">
            Vincular con usuario del sistema
          </h3>
          <span className="text-xs text-brand">(opcional)</span>
        </div>

        {linkedUser ? (
          // Usuario vinculado
          <div className="flex items-center justify-between bg-surface border border-line rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-ok flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-content">
                  {linkedUser.name}
                </p>
                <p className="text-xs text-dim">
                  {linkedUser.email} · {linkedUser.role}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUnlinkUser}
              className="text-dim hover:text-danger transition-colors p-1"
              title="Desvincular usuario"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // Buscador de usuarios
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setShowUserDropdown(true);
                }}
                onFocus={() => setShowUserDropdown(true)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-line rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50"
              />
            </div>

            {showUserDropdown && filteredUsers.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-elevated transition-colors border-b border-line last:border-0"
                  >
                    <UserCheck className="w-4 h-4 text-brand flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-content truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-dim truncate">
                        {user.email} · {user.role}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showUserDropdown &&
              userSearch.trim() !== '' &&
              filteredUsers.length === 0 && (
                <div className="absolute z-20 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg px-3 py-3 text-sm text-dim">
                  No se encontraron usuarios con ese nombre o email
                </div>
              )}
          </div>
        )}

        <p className="mt-2 text-xs text-brand">
          Al vincular, el nombre y email se auto-rellenarán con los datos del
          usuario seleccionado.
        </p>
      </div>

      {/* ── Campos del formulario ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-dim">
            Nombre Completo *
          </label>
          <Input
            id="name"
            {...register('name', { required: 'El nombre es requerido' })}
            className={errors.name ? 'border-danger' : ''}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-danger">{errors.name.message}</p>
          )}
        </div>

        {/* Teléfono */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-dim">
            Teléfono
          </label>
          <Input
            id="phone"
            type="tel"
            placeholder="04XX-XXXXXXX"
            {...register('phone')}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-dim">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="correo@ejemplo.com"
            {...register('email', {
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Email inválido',
              },
            })}
            className={errors.email ? 'border-danger' : ''}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-danger">{errors.email.message}</p>
          )}
        </div>

        {/* Dirección */}
        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-dim"
          >
            Dirección
          </label>
          <Input
            id="address"
            placeholder="Dirección del cliente"
            {...register('address')}
          />
        </div>

        {/* Tipo de identificación */}
        <div>
          <label
            htmlFor="identificationType"
            className="block text-sm font-medium text-dim"
          >
            Tipo de Identificación
          </label>
          <select
            id="identificationType"
            {...register('identificationType')}
            className="mt-1 block w-full border border-line rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand/50 focus:border-brand/50"
          >
            <option value="">Sin identificación</option>
            <option value={IdentificationType.V}>V - Venezolano</option>
            <option value={IdentificationType.E}>E - Extranjero</option>
            <option value={IdentificationType.J}>J - Jurídico</option>
            <option value={IdentificationType.G}>G - Gubernamental</option>
            <option value={IdentificationType.A}>A - Número de Acción</option>
          </select>
        </div>

        {/* Número de identificación */}
        <div>
          <label
            htmlFor="identificationId"
            className="block text-sm font-medium text-dim"
          >
            Número de Identificación
          </label>
          <Input
            id="identificationId"
            placeholder="Ej: 12345678"
            {...register('identificationId')}
          />
        </div>

        {/* Estado activo */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            {...register('isActive')}
            className="h-4 w-4 text-brand focus:ring-brand border-line rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-dim">
            Cliente activo
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(PRIVATE_ROUTES.CUSTOMERS)}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {isNew ? 'Registrando...' : 'Actualizando...'}
            </span>
          ) : isNew ? (
            'Registrar Cliente'
          ) : (
            'Actualizar Cliente'
          )}
        </Button>
      </div>
    </form>
  );
}

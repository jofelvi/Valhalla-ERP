'use client';

import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@odin6/types';
import { UserRoleEnum } from '@/shared';
import { useUpdateUser } from '@/hooks/useUsers';
import { api } from '@/services/api/apiClient';
import { Input } from '@/components/shared/input/input';
import { Button } from '@/components/shared/button/Button';
import { useToast } from '@/components/hooks/useToast';

interface UserFormValues {
  name: string;
  email: string;
  role: UserRoleEnum;
  isActive: boolean;
  password?: string;
  confirmPassword?: string;
}

interface UserFormProps {
  initialData?: User | null;
  isNew?: boolean;
}

export default function UserForm({
  initialData = null,
  isNew = false,
}: UserFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateUser = useUpdateUser();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>({
    defaultValues: initialData
      ? {
          name: initialData.name,
          email: initialData.email,
          role: initialData.role,
          isActive: initialData.isActive ?? true,
        }
      : {
          name: '',
          email: '',
          role: UserRoleEnum.WAITER,
          isActive: true,
          password: '',
          confirmPassword: '',
        },
  });

  const onSubmit = async (data: UserFormValues) => {
    setIsSubmitting(true);
    try {
      if (isNew) {
        // Validar que se haya ingresado contraseña
        if (!data.password || data.password.length < 6) {
          toast.error({
            title: 'Error',
            description: 'La contraseña debe tener al menos 6 caracteres',
          });
          setIsSubmitting(false);
          return;
        }

        // Crear usuario via NestJS backend
        const created = await api.post<{ user: User }>('/api/auth/register', {
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
        });

        // Actualizar isActive si es false (register lo crea activo por defecto)
        if (!data.isActive && created.user?.id) {
          await updateUser.mutateAsync({
            id: created.user.id,
            data: { isActive: false },
          });
        }

        toast.success({
          title: 'Usuario creado',
          description: `${data.name} ha sido creado exitosamente`,
        });
      } else if (initialData?.id) {
        // Actualizar usuario existente
        await updateUser.mutateAsync({
          id: initialData.id,
          data: {
            name: data.name,
            email: data.email,
            role: data.role,
            isActive: data.isActive,
            image: initialData.image || '',
          },
        });

        toast.success({
          title: 'Usuario actualizado',
          description: `${data.name} ha sido actualizado exitosamente`,
        });
      }

      router.push('/private/users');
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error({
        title: 'Error',
        description: 'No se pudo guardar el usuario. Intenta nuevamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-dim">
            Email *
          </label>
          <Input
            id="email"
            type="email"
            {...register('email', {
              required: 'El email es requerido',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Email inválido',
              },
            })}
            className={errors.email ? 'border-danger' : ''}
            disabled={!isNew}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-danger">{errors.email.message}</p>
          )}
        </div>

        {/* Contraseña (solo para nuevos usuarios) */}
        {isNew && (
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-dim"
            >
              Contrasena *
            </label>
            <Input
              id="password"
              type="password"
              {...register('password', {
                required: isNew ? 'La contrasena es requerida' : false,
                minLength: {
                  value: 6,
                  message: 'La contrasena debe tener al menos 6 caracteres',
                },
              })}
              className={errors.password ? 'border-danger' : ''}
              placeholder="Minimo 6 caracteres"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-danger">
                {errors.password.message}
              </p>
            )}
          </div>
        )}

        {/* Confirmar Contraseña (solo para nuevos usuarios) */}
        {isNew && (
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-dim"
            >
              Confirmar Contrasena *
            </label>
            <Input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword', {
                required: isNew ? 'Debe confirmar la contrasena' : false,
                validate: (value) =>
                  value === watch('password') || 'Las contrasenas no coinciden',
              })}
              className={errors.confirmPassword ? 'border-danger' : ''}
              placeholder="Repita la contrasena"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-danger">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        )}

        {/* Rol */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-dim">
            Rol *
          </label>
          <select
            id="role"
            {...register('role', { required: 'El rol es requerido' })}
            className={`mt-1 block w-full border ${
              errors.role ? 'border-danger' : 'border-line'
            } rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          >
            <option value={UserRoleEnum.ADMIN}>Administrador</option>
            <option value={UserRoleEnum.MANAGER}>Gerente</option>
            <option value={UserRoleEnum.CASHIER}>Cajero</option>
            <option value={UserRoleEnum.WAITER}>Mesero</option>
            <option value={UserRoleEnum.KITCHEN}>Cocina</option>
            <option value={UserRoleEnum.BAR}>Barra</option>
            <option value={UserRoleEnum.PIZZA}>Pizza</option>
          </select>
          {errors.role && (
            <p className="mt-1 text-sm text-danger">{errors.role.message}</p>
          )}
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
            Usuario activo
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/private/users')}
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {isNew ? 'Creando...' : 'Actualizando...'}
            </span>
          ) : isNew ? (
            'Crear Usuario'
          ) : (
            'Actualizar Usuario'
          )}
        </Button>
      </div>
    </form>
  );
}

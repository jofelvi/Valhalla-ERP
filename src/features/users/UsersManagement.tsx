'use client';

import { useState, useMemo } from 'react';
import Link from '@/shared/ui/AppLink/AppLink';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { Users, UserPlus, Search, Eye, Edit, Loader2 } from 'lucide-react';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/ui/tabs/tabs';
import { useToast } from '@/components/hooks/useToast';
import { useUserStore } from '@/shared/store/useUserStore';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { UserRoleEnum } from '@/shared/types/enumShared';
import { useUsers, useUpdateUser } from '@/hooks/useUsers';
import { useCustomers, useUpdateCustomer } from '@/hooks/useCustomers';
import { ROLE_LABELS, ROLE_BADGE_VARIANTS, STAFF_ROLES } from './userConstants';

export default function UsersManagement() {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const toast = useToast();
  const currentUser = useUserStore((state) => state.user);

  const { data: usersData = [], isLoading: usersLoading } = useUsers();
  const { data: customersData = [], isLoading: customersLoading } =
    useCustomers({ vista: 'lista' });
  const updateUser = useUpdateUser();
  const updateCustomer = useUpdateCustomer();

  const loading = usersLoading || customersLoading;

  const filteredByRoleStaff = useMemo(() => {
    if (roleFilter === 'all') return usersData;
    return usersData.filter((u) => u.role === roleFilter);
  }, [usersData, roleFilter]);

  const filteredStaff = useBusqueda(filteredByRoleStaff, searchQuery, [
    'name',
    'email',
  ]);

  const filteredCustomers = useBusqueda(customersData, searchQuery, [
    'name',
    'email',
    'phone',
  ]);

  const handleRoleChange = async (userId: string, newRole: UserRoleEnum) => {
    setUpdatingId(userId);
    try {
      await updateUser.mutateAsync({ id: userId, data: { role: newRole } });
      toast.success({
        description: `Rol actualizado a ${ROLE_LABELS[newRole]}`,
      });
    } catch {
      toast.error({ description: 'Error al actualizar el rol' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStaffToggleActive = async (userId: string, isActive: boolean) => {
    setUpdatingId(userId);
    try {
      await updateUser.mutateAsync({ id: userId, data: { isActive } });
      toast.success({
        description: `Usuario ${isActive ? 'activado' : 'desactivado'} correctamente`,
      });
    } catch {
      toast.error({ description: 'Error al cambiar el estado del usuario' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCustomerToggleActive = async (
    customerId: string,
    isActive: boolean,
  ) => {
    setUpdatingId(customerId);
    try {
      await updateCustomer.mutateAsync({ id: customerId, data: { isActive } });
      toast.success({
        description: `Cliente ${isActive ? 'activado' : 'desactivado'} correctamente`,
      });
    } catch {
      toast.error({ description: 'Error al cambiar el estado del cliente' });
    } finally {
      setUpdatingId(null);
    }
  };

  const isCurrentUser = (userId: string) => currentUser?.id === userId;

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
          <span className="ml-3 text-dim">Cargando usuarios...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-brand" />
          <h1 className="text-2xl font-bold">Gestion de Usuarios</h1>
        </div>
        <Link href={PRIVATE_ROUTES.USERS_NEW}>
          <Button startIcon={<UserPlus className="h-4 w-4" />}>
            Nuevo Usuario
          </Button>
        </Link>
      </div>

      {/* Barra de busqueda y filtro */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dim" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o telefono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="all">Todos los roles</option>
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="staff">
        <TabsList className="mb-4">
          <TabsTrigger value="staff">
            Staff ({filteredStaff.length})
          </TabsTrigger>
          <TabsTrigger value="customers">
            Clientes ({filteredCustomers.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab Staff */}
        <TabsContent value="staff">
          {filteredStaff.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-dim mx-auto mb-4" />
              <p className="text-dim">
                {searchQuery || roleFilter !== 'all'
                  ? 'No se encontraron usuarios con esos filtros'
                  : 'No hay usuarios registrados'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-elevated border-b border-line">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Nombre
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Rol
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Estado
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredStaff.map((user) => {
                    const isSelf = isCurrentUser(user.id);
                    const isUpdating = updatingId === user.id;

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-elevated transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            {user.name}
                            {isSelf && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0.5"
                              >
                                Tu
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-dim">{user.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin text-brand" />
                            ) : null}
                            <select
                              value={user.role}
                              disabled={isSelf || isUpdating}
                              onChange={(e) =>
                                handleRoleChange(
                                  user.id,
                                  e.target.value as UserRoleEnum,
                                )
                              }
                              className="border border-line rounded-md px-2 py-1 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {STAFF_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                            <Badge variant={ROLE_BADGE_VARIANTS[user.role]}>
                              {ROLE_LABELS[user.role]}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={user.isActive ?? true}
                            disabled={isSelf || isUpdating}
                            onCheckedChange={(checked) =>
                              handleStaffToggleActive(user.id, checked)
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={PRIVATE_ROUTES.USERS_DETAILS(user.id)}>
                              <Button
                                variant="ghost"
                                size="sm"
                                startIcon={<Eye className="h-4 w-4" />}
                              >
                                Ver
                              </Button>
                            </Link>
                            <Link href={PRIVATE_ROUTES.USERS_EDIT(user.id)}>
                              <Button
                                variant="ghost"
                                size="sm"
                                startIcon={<Edit className="h-4 w-4" />}
                              >
                                Editar
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab Clientes */}
        <TabsContent value="customers">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-dim mx-auto mb-4" />
              <p className="text-dim">
                {searchQuery
                  ? 'No se encontraron clientes con esa busqueda'
                  : 'No hay clientes registrados'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-elevated border-b border-line">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Nombre
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Telefono
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredCustomers.map((customer) => {
                    const isUpdating = updatingId === customer.id;

                    return (
                      <tr
                        key={customer.id}
                        className="hover:bg-elevated transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">
                          {customer.name}
                        </td>
                        <td className="px-4 py-3 text-dim">
                          {customer.email || '-'}
                        </td>
                        <td className="px-4 py-3 text-dim">
                          {customer.phone || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin text-brand" />
                            ) : null}
                            <Switch
                              checked={customer.isActive}
                              disabled={isUpdating}
                              onCheckedChange={(checked) =>
                                handleCustomerToggleActive(customer.id, checked)
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

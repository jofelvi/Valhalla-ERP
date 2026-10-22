'use client';

import { useMemo, useState } from 'react';
import Link from '@/shared/ui/AppLink/AppLink';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
} from 'lucide-react';
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
import { User } from '@odin6/types';
import { Customer } from '@odin6/types';
import { useUsers, useUpdateUser } from '@/hooks/useUsers';
import { useCustomers, useUpdateCustomer } from '@/hooks/useCustomers';
import {
  ROLE_LABELS,
  ROLE_BADGE_VARIANTS,
  STAFF_ROLES,
} from '@/features/users/userConstants';
import { Panel } from '@/components/shared/panel/Panel';
import {
  IconoEnCuadro,
  TituloDePantalla,
} from '@/components/shared/cabecera/CabeceraDePantalla';

/** Clientes por pagina. 2.992 de golpe congelaban el navegador. */
const POR_PAGINA = 50;

type Pestana = 'staff' | 'customers';

/**
 * Usuarios: personal del POS y clientes.
 *
 * Tres defectos que tenia esta pantalla y que este archivo corrige:
 *
 * 1. NO HABIA VERSION MOVIL. Las dos tablas eran `hidden md:block` y no existia
 *    ninguna alternativa, asi que por debajo de 768 px la pantalla mostraba el
 *    buscador, los filtros y las pestañas con el conteo — y ni una sola fila.
 *    Literalmente "no veo ningun usuario", con el contador diciendo 47.
 *
 * 2. LA PESTAÑA DE CLIENTES PINTABA LAS 2.992 FILAS DE UNA. Cada una con su
 *    interruptor: unos 12.000 nodos y 2.992 componentes con estado. El
 *    navegador se quedaba clavado. Ahora va paginada.
 *
 * 3. EL PERSONAL ESPERABA A LOS CLIENTES. `loading` era
 *    `usersLoading || customersLoading`, asi que los 47 usuarios (que ya habian
 *    llegado) se quedaban detras de 1,11 MB de clientes que ni se estaban
 *    mirando. Ahora los clientes se piden solo al abrir su pestaña.
 */
export default function UsersPage() {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [pestana, setPestana] = useState<Pestana>('staff');
  const [pagina, setPagina] = useState(1);

  const toast = useToast();
  const currentUser = useUserStore((state) => state.user);

  const {
    data: usersData = [],
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useUsers();

  // Los clientes solo se piden cuando se abre su pestaña: son 1,11 MB que la
  // inmensa mayoria de las visitas a esta pantalla no necesita.
  const {
    data: customersData = [],
    isLoading: customersLoading,
    error: customersError,
    refetch: refetchCustomers,
  } = useCustomers(undefined, { enabled: pestana === 'customers' });

  const updateUser = useUpdateUser();
  const updateCustomer = useUpdateCustomer();

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

  const totalPaginas = Math.max(
    1,
    Math.ceil(filteredCustomers.length / POR_PAGINA),
  );
  const paginaSegura = Math.min(pagina, totalPaginas);
  const clientesDeLaPagina = useMemo(
    () =>
      filteredCustomers.slice(
        (paginaSegura - 1) * POR_PAGINA,
        paginaSegura * POR_PAGINA,
      ),
    [filteredCustomers, paginaSegura],
  );

  const roleCountsForSubtitle = useMemo(() => {
    const counts: Record<string, number> = {};
    STAFF_ROLES.forEach((role) => {
      counts[role] = usersData.filter((u) => u.role === role).length;
    });
    return counts;
  }, [usersData]);

  const roleCountsText = STAFF_ROLES.filter(
    (role) => roleCountsForSubtitle[role] > 0,
  )
    .map((role) => `${roleCountsForSubtitle[role]} ${ROLE_LABELS[role]}`)
    .join(', ');

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

  const cambiarPestana = (valor: string) => {
    setPestana(valor === 'customers' ? 'customers' : 'staff');
    setPagina(1);
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="w-full px-3 py-4 sm:px-4 lg:px-6 xl:px-8">
        <Panel className="mb-3 flex flex-wrap items-center justify-between gap-3 p-3.5">
          <div className="flex items-center gap-3">
            <IconoEnCuadro>
              <Shield className="h-5 w-5 text-brand" />
            </IconoEnCuadro>
            <TituloDePantalla
              titulo="Usuarios"
              subtitulo={
                usersLoading ? (
                  'Cargando…'
                ) : (
                  <>
                    {usersData.length} total
                    {roleCountsText ? ` • ${roleCountsText}` : ''}
                  </>
                )
              }
            />
          </div>
          <Link href={PRIVATE_ROUTES.USERS_NEW}>
            <Button startIcon={<UserPlus className="h-4 w-4" />}>
              Nuevo Usuario
            </Button>
          </Link>
        </Panel>

        <Panel className="mb-3 space-y-3 p-3.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
            <input
              type="search"
              placeholder={
                pestana === 'staff'
                  ? 'Buscar por nombre o email…'
                  : 'Buscar cliente por nombre, email o teléfono…'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagina(1);
              }}
              className="w-full rounded-lg border border-line bg-surface py-2 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {pestana === 'staff' && (
            <div className="flex flex-wrap gap-2">
              <PildoraDeRol
                activa={roleFilter === 'all'}
                onClick={() => setRoleFilter('all')}
              >
                Todos
              </PildoraDeRol>
              {STAFF_ROLES.map((role) => (
                <PildoraDeRol
                  key={role}
                  activa={roleFilter === role}
                  onClick={() => setRoleFilter(role)}
                >
                  {ROLE_LABELS[role]}
                  {roleCountsForSubtitle[role] > 0 && (
                    <span className="ml-1.5 opacity-70">
                      {roleCountsForSubtitle[role]}
                    </span>
                  )}
                </PildoraDeRol>
              ))}
            </div>
          )}
        </Panel>

        <Tabs defaultValue="staff" onValueChange={cambiarPestana}>
          <TabsList className="mb-4 ml-0">
            <TabsTrigger value="staff">
              Personal {usersLoading ? '' : `(${filteredStaff.length})`}
            </TabsTrigger>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-3">
            {usersError ? (
              <ErrorDeCarga
                que="el personal"
                error={usersError}
                reintentar={() => void refetchUsers()}
              />
            ) : usersLoading ? (
              <EsqueletoDeLista />
            ) : filteredStaff.length === 0 ? (
              <Vacio
                mensaje={
                  searchQuery || roleFilter !== 'all'
                    ? 'Ningún usuario coincide con esos filtros'
                    : 'No hay usuarios registrados'
                }
              />
            ) : (
              <>
                {/* Tarjetas en móvil. Sin esto, por debajo de 768 px la
                    pantalla se veía vacía. */}
                <div className="space-y-2.5 md:hidden">
                  {filteredStaff.map((user) => (
                    <TarjetaDePersonal
                      key={user.id}
                      user={user}
                      esUnoMismo={isCurrentUser(user.id)}
                      actualizando={updatingId === user.id}
                      onRol={handleRoleChange}
                      onActivo={handleStaffToggleActive}
                    />
                  ))}
                </div>

                <Panel className="hidden overflow-hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-line bg-elevated">
                        <tr>
                          <Th>Nombre</Th>
                          <Th>Email</Th>
                          <Th>Rol</Th>
                          <Th>Activo</Th>
                          <Th>Acciones</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {filteredStaff.map((user) => {
                          const isSelf = isCurrentUser(user.id);
                          const isUpdating = updatingId === user.id;
                          return (
                            <tr
                              key={user.id}
                              className="transition-colors hover:bg-elevated"
                            >
                              <td className="px-4 py-3 font-medium">
                                <span className="flex items-center gap-2">
                                  {user.name}
                                  {isSelf && (
                                    <Badge
                                      variant="outline"
                                      className="px-1.5 py-0.5 text-[10px]"
                                    >
                                      Tú
                                    </Badge>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-dim">
                                {user.email}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {isUpdating && (
                                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                                  )}
                                  <SelectorDeRol
                                    valor={user.role}
                                    deshabilitado={isSelf || isUpdating}
                                    onCambio={(rol) =>
                                      handleRoleChange(user.id, rol)
                                    }
                                  />
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
                                <div className="flex items-center gap-1">
                                  <Link
                                    href={PRIVATE_ROUTES.USERS_DETAILS(user.id)}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      startIcon={<Eye className="h-4 w-4" />}
                                    >
                                      Ver
                                    </Button>
                                  </Link>
                                  <Link
                                    href={PRIVATE_ROUTES.USERS_EDIT(user.id)}
                                  >
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
                </Panel>
              </>
            )}
          </TabsContent>

          <TabsContent value="customers" className="space-y-3">
            {customersError ? (
              <ErrorDeCarga
                que="los clientes"
                error={customersError}
                reintentar={() => void refetchCustomers()}
              />
            ) : customersLoading ? (
              <EsqueletoDeLista />
            ) : filteredCustomers.length === 0 ? (
              <Vacio
                mensaje={
                  searchQuery
                    ? 'Ningún cliente coincide con esa búsqueda'
                    : 'No hay clientes registrados'
                }
              />
            ) : (
              <>
                <p className="text-xs text-dim">
                  {filteredCustomers.length.toLocaleString('es-VE')} clientes ·
                  mostrando {clientesDeLaPagina.length} (página {paginaSegura}{' '}
                  de {totalPaginas})
                </p>

                <div className="space-y-2.5 md:hidden">
                  {clientesDeLaPagina.map((customer) => (
                    <TarjetaDeCliente
                      key={customer.id}
                      customer={customer}
                      actualizando={updatingId === customer.id}
                      onActivo={handleCustomerToggleActive}
                    />
                  ))}
                </div>

                <Panel className="hidden overflow-hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-line bg-elevated">
                        <tr>
                          <Th>Nombre</Th>
                          <Th>Email</Th>
                          <Th>Teléfono</Th>
                          <Th>Activo</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {clientesDeLaPagina.map((customer) => {
                          const isUpdating = updatingId === customer.id;
                          return (
                            <tr
                              key={customer.id}
                              className="transition-colors hover:bg-elevated"
                            >
                              <td className="px-4 py-3 font-medium">
                                {customer.name}
                              </td>
                              <td className="px-4 py-3 text-dim">
                                {customer.email || '—'}
                              </td>
                              <td className="px-4 py-3 text-dim">
                                {customer.phone || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {isUpdating && (
                                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                                  )}
                                  <Switch
                                    checked={customer.isActive}
                                    disabled={isUpdating}
                                    onCheckedChange={(checked) =>
                                      handleCustomerToggleActive(
                                        customer.id,
                                        checked,
                                      )
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
                </Panel>

                <Paginador
                  pagina={paginaSegura}
                  total={totalPaginas}
                  onCambio={setPagina}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-semibold text-dim">{children}</th>
  );
}

function PildoraDeRol({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        activa
          ? 'bg-brand text-on-brand'
          : 'border border-line bg-elevated text-content hover:bg-surface'
      }`}
    >
      {children}
    </button>
  );
}

function SelectorDeRol({
  valor,
  deshabilitado,
  onCambio,
}: {
  valor: UserRoleEnum;
  deshabilitado: boolean;
  onCambio: (rol: UserRoleEnum) => void;
}) {
  return (
    <select
      value={valor}
      disabled={deshabilitado}
      aria-label="Rol del usuario"
      onChange={(e) => onCambio(e.target.value as UserRoleEnum)}
      className="rounded-md border border-line bg-surface px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
    >
      {STAFF_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

function TarjetaDePersonal({
  user,
  esUnoMismo,
  actualizando,
  onRol,
  onActivo,
}: {
  user: User;
  esUnoMismo: boolean;
  actualizando: boolean;
  onRol: (id: string, rol: UserRoleEnum) => void;
  onActivo: (id: string, activo: boolean) => void;
}) {
  return (
    <Panel className="space-y-3 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-content">
            <span className="truncate">{user.name}</span>
            {esUnoMismo && (
              <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                Tú
              </Badge>
            )}
          </p>
          <p className="truncate text-xs text-dim">{user.email}</p>
        </div>
        <Badge variant={ROLE_BADGE_VARIANTS[user.role]}>
          {ROLE_LABELS[user.role]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex items-center gap-2">
          {actualizando && (
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
          )}
          <SelectorDeRol
            valor={user.role}
            deshabilitado={esUnoMismo || actualizando}
            onCambio={(rol) => onRol(user.id, rol)}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-dim">
          Activo
          <Switch
            checked={user.isActive ?? true}
            disabled={esUnoMismo || actualizando}
            onCheckedChange={(checked) => onActivo(user.id, checked)}
          />
        </label>
      </div>

      <div className="flex gap-2">
        <Link href={PRIVATE_ROUTES.USERS_DETAILS(user.id)} className="flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            startIcon={<Eye className="h-4 w-4" />}
          >
            Ver
          </Button>
        </Link>
        <Link href={PRIVATE_ROUTES.USERS_EDIT(user.id)} className="flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            startIcon={<Edit className="h-4 w-4" />}
          >
            Editar
          </Button>
        </Link>
      </div>
    </Panel>
  );
}

function TarjetaDeCliente({
  customer,
  actualizando,
  onActivo,
}: {
  customer: Customer;
  actualizando: boolean;
  onActivo: (id: string, activo: boolean) => void;
}) {
  return (
    <Panel className="flex items-center justify-between gap-3 p-3.5">
      <div className="min-w-0">
        <p className="truncate font-medium text-content">{customer.name}</p>
        <p className="truncate text-xs text-dim">
          {customer.email || customer.phone || 'Sin contacto'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actualizando && (
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
        )}
        <Switch
          checked={customer.isActive}
          disabled={actualizando}
          onCheckedChange={(checked) => onActivo(customer.id, checked)}
        />
      </div>
    </Panel>
  );
}

function Paginador({
  pagina,
  total,
  onCambio,
}: {
  pagina: number;
  total: number;
  onCambio: (p: number) => void;
}) {
  if (total <= 1) return null;

  return (
    <nav
      aria-label="Paginación de clientes"
      className="flex items-center justify-center gap-3 pt-1"
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={pagina <= 1}
        onClick={() => onCambio(pagina - 1)}
        startIcon={<ChevronLeft className="h-4 w-4" />}
      >
        Anterior
      </Button>
      <span className="text-sm tabular-nums text-dim">
        {pagina} / {total}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pagina >= total}
        onClick={() => onCambio(pagina + 1)}
        endIcon={<ChevronRight className="h-4 w-4" />}
      >
        Siguiente
      </Button>
    </nav>
  );
}

function EsqueletoDeLista() {
  return (
    <div className="animate-pulse space-y-2.5" aria-busy="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-14 rounded-lg bg-elevated" />
      ))}
    </div>
  );
}

function Vacio({ mensaje }: { mensaje: string }) {
  return (
    <Panel className="p-8 text-center">
      <Shield className="mx-auto mb-3 h-12 w-12 text-dim opacity-50" />
      <p className="text-sm text-dim">{mensaje}</p>
    </Panel>
  );
}

/**
 * Un fallo se ve como un fallo. Antes el hook caia a `= []` y la pantalla decia
 * "No hay usuarios registrados" aunque hubiera 47: no se podia distinguir una
 * lista vacia de una consulta rota.
 */
function ErrorDeCarga({
  que,
  error,
  reintentar,
}: {
  que: string;
  error: unknown;
  reintentar: () => void;
}) {
  const detalle = error instanceof Error ? error.message : null;
  return (
    <Panel className="space-y-3 border-danger/40 bg-danger/5 p-4" role="alert">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <div>
          <p className="text-sm font-semibold text-content">
            No se pudo cargar {que}
          </p>
          <p className="mt-0.5 text-xs text-dim">
            {detalle ?? 'La conexión con el servidor falló.'} La lista está
            vacía por el fallo, no porque no haya registros.
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={reintentar}
        startIcon={<RefreshCw className="h-3.5 w-3.5" />}
      >
        Reintentar
      </Button>
    </Panel>
  );
}

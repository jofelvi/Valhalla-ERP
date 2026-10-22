'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import Modal from '@/components/shared/modal';
import { useToast } from '@/components/hooks/useToast';
import { useUserStore } from '@/shared/store/useUserStore';
import { ArrowLeft, Edit, Trash2, KeyRound, Shield } from 'lucide-react';
import { Input } from '@/components/shared/input/input';
import { useUser, useDeleteUser, useResetUserPassword } from '@/hooks/useUsers';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UserDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { user: currentUser } = useUserStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { data: user, isLoading: loading } = useUser(id);
  const deleteUserMutation = useDeleteUser();
  const resetPassword = useResetUserPassword();

  // Handle user not found
  useEffect(() => {
    if (!loading && !user) {
      toast.error({
        title: 'Usuario no encontrado',
        description: 'El usuario que buscas no existe',
      });
      router.push('/private/users');
    }
  }, [user, loading, toast, router]);

  const handleDelete = async () => {
    if (!user) return;

    // Evitar que el admin se elimine a sí mismo
    if (user.id === currentUser?.id) {
      toast.error({
        title: 'Acción no permitida',
        description: 'No puedes eliminar tu propio usuario',
      });
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUserMutation.mutateAsync(user.id);
      toast.success({
        title: 'Usuario eliminado',
        description: `${user.name} ha sido eliminado exitosamente`,
      });
      router.push('/private/users');
      setShowDeleteModal(false);
    } catch {
      toast.error({
        title: 'Error',
        description: 'No se pudo eliminar el usuario. Intenta nuevamente.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;

    // Validaciones
    if (!newPassword || newPassword.length < 6) {
      toast.error({
        title: 'Contraseña inválida',
        description: 'La contraseña debe tener al menos 6 caracteres',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
      });
      return;
    }

    setIsResetting(true);
    try {
      // Persiste de verdad: el backend hashea con bcrypt y guarda en
      // `passwordHash`, que es el campo que compara el login. Antes esto era
      // un setTimeout que fingia exito y jamas cambiaba la clave.
      await resetPassword.mutateAsync({
        id: user.id,
        newPassword,
      });

      toast.success({
        title: 'Contraseña actualizada',
        description: `${user.name} ya puede entrar con la nueva contraseña`,
      });
      setShowResetPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error({
        title: 'No se pudo actualizar la contraseña',
        description:
          error instanceof Error ? error.message : 'Intenta nuevamente.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive' as const;
      case 'manager':
        return 'default' as const;
      case 'cashier':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      manager: 'Gerente',
      cashier: 'Cajero',
      waiter: 'Mesero',
      kitchen: 'Cocina',
      customer: 'Cliente',
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-dim">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = currentUser?.role === 'admin';
  const isSelf = user.id === currentUser?.id;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Detalle de Usuario</h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => router.push('/private/users')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <Link href={`/private/users/${user.id}`}>
            <Button variant="outline" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          </Link>
          {isAdmin && (
            <>
              <Button
                variant="default"
                onClick={() => setShowResetPasswordModal(true)}
                className="flex items-center gap-2"
              >
                <KeyRound className="h-4 w-4" />
                Reset Password
              </Button>
              {!isSelf && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-brand" />
              <span>{user.name}</span>
            </div>
            <div className="flex gap-2">
              <Badge variant={getRoleBadgeVariant(user.role)}>
                {getRoleLabel(user.role)}
              </Badge>
              <Badge variant={user.isActive ? 'default' : 'secondary'}>
                {user.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-dim">Email</h3>
            <p className="mt-1 text-sm text-content">{user.email}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-dim">Rol</h3>
            <p className="mt-1 text-sm text-content">
              {getRoleLabel(user.role)}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-dim">Estado</h3>
            <p className="mt-1 text-sm text-content">
              {user.isActive ? 'Activo' : 'Inactivo'}
            </p>
          </div>
          {user.image && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-dim mb-2">
                Imagen de perfil
              </h3>
              <img
                src={user.image}
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmación para eliminar */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 text-content">
            Confirmar eliminación
          </h2>
          <p className="text-dim mb-6">
            ¿Estás seguro que deseas eliminar al usuario{' '}
            <span className="font-semibold">{user.name}</span>? Esta acción no
            se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar Usuario'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de reset de contraseña */}
      <Modal
        isOpen={showResetPasswordModal}
        onClose={() => !isResetting && setShowResetPasswordModal(false)}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 text-content flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Restablecer Contraseña
          </h2>
          <p className="text-dim mb-6">
            Establece una nueva contraseña para{' '}
            <span className="font-semibold">{user.name}</span>
          </p>
          <div className="space-y-4 mb-6">
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-dim mb-1"
              >
                Nueva Contraseña
              </label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                disabled={isResetting}
              />
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-dim mb-1"
              >
                Confirmar Contraseña
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                disabled={isResetting}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowResetPasswordModal(false);
                setNewPassword('');
                setConfirmPassword('');
              }}
              disabled={isResetting}
            >
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={isResetting}>
              {isResetting ? 'Actualizando...' : 'Actualizar Contraseña'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

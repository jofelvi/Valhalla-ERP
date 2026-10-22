'use client';
import { useParams } from 'next/navigation';
import { useUser } from '@/hooks/useUsers';
import UserForm from '@/features/users/UserForm';
import { Users, Loader2 } from 'lucide-react';

export default function EditUserPage() {
  // useParams() retorna objeto plano (no Promise). use(params) → React error #438.
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: user, isLoading } = useUser(id);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <p className="text-content">Cargando usuario...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-lg text-content">Usuario no encontrado</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-8 w-8 text-brand" />
        <h1 className="text-2xl font-bold">Editar Usuario</h1>
      </div>
      <div className="bg-surface shadow rounded-lg p-6">
        <UserForm initialData={user} />
      </div>
    </div>
  );
}

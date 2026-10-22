export const dynamic = 'force-dynamic';
import UserForm from '@/features/users/UserForm';
import { Users } from 'lucide-react';

export default function NewUserPage() {
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-8 w-8 text-brand" />
        <h1 className="text-2xl font-bold">Crear Nuevo Usuario</h1>
      </div>
      <div className="bg-surface shadow rounded-lg p-6">
        <UserForm isNew={true} />
      </div>
    </div>
  );
}

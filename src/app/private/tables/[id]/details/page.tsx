'use client';
import { use, useState } from 'react';
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
import { getStatusVariant } from '@/shared/utils/getStatusTableOrder';
import { useTable, useDeleteTable } from '@/hooks/useTables';
import { useToast } from '@/components/hooks/useToast';
import { useUserStore } from '@/shared/store/useUserStore';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TableDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { user } = useUserStore();
  const { data: table, isLoading: loading } = useTable(id);
  const deleteTable = useDeleteTable();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-dim">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!table) {
    return null;
  }

  const handleDelete = async () => {
    if (!table) return;

    try {
      await deleteTable.mutateAsync(table.id);
      toast.success({
        title: 'Mesa eliminada',
        description: `La mesa ${table.name} ha sido eliminada exitosamente`,
      });
      router.push('/private/tables');
    } catch {
      toast.error({
        title: 'Error',
        description: 'No se pudo eliminar la mesa. Intenta nuevamente.',
      });
    } finally {
      setShowDeleteModal(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isDeleting = deleteTable.isPending;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Detalle de Mesa</h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => router.push('/private/tables')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <Link href={`/private/tables/${table.id}`}>
            <Button variant="outline" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          </Link>
          {isAdmin && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>
              Mesa {table.number} - {table.name}
            </span>
            <Badge variant={getStatusVariant(table.status)}>
              {table.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-dim">Capacidad</h3>
            <p className="mt-1 text-sm text-content">
              {table.capacity} personas
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-dim">Disponibilidad</h3>
            <p className="mt-1 text-sm text-content">
              {table.isAvailable ? 'Disponible' : 'No disponible'}
            </p>
          </div>
          {table.orderId && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-dim">Orden asociada</h3>
              <p className="mt-1 text-sm text-content">{table.orderId}</p>
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
            ¿Estás seguro que deseas eliminar la mesa{' '}
            <span className="font-semibold">
              {table.name} (Mesa {table.number})
            </span>
            ? Esta acción no se puede deshacer.
          </p>
          {table.orderId && (
            <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
              <p className="text-sm text-accent">
                <strong>Advertencia:</strong> Esta mesa tiene una orden
                asociada. Eliminarla podría causar problemas con la orden
                activa.
              </p>
            </div>
          )}
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
              {isDeleting ? 'Eliminando...' : 'Eliminar Mesa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

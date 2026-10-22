import Link from 'next/link';
import { ArchiveX, PlusCircle } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared';

export function EmptyState() {
  return (
    <div className="text-center border-2 border-dashed rounded-lg p-12 mt-6">
      <ArchiveX className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-content">
        No se encontraron órdenes de compra
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Parece que aún no has creado ninguna orden. ¡Empieza ahora!
      </p>
      <div className="mt-6">
        <Link href={PRIVATE_ROUTES.PURCHASE_ORDERS_NEW}>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Primera Orden
          </Button>
        </Link>
      </div>
    </div>
  );
}

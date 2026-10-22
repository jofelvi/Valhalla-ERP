'use client';

import { useUserStore } from '@/shared/store/useUserStore';
import { UserRoleEnum } from '@/shared';
import { Button } from '@/components/shared/button/Button';
import Link from '@/shared/ui/AppLink/AppLink';
import { Pencil } from 'lucide-react';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';

interface EditCustomerButtonProps {
  customerId: string;
}

export default function EditCustomerButton({
  customerId,
}: EditCustomerButtonProps) {
  const { user } = useUserStore();

  const canEdit =
    user?.role === UserRoleEnum.ADMIN || user?.role === UserRoleEnum.MANAGER;

  if (!canEdit) return null;

  return (
    <Link href={PRIVATE_ROUTES.CUSTOMERS_EDIT(customerId)}>
      <Button className="flex items-center gap-2">
        <Pencil className="w-4 h-4" />
        Editar
      </Button>
    </Link>
  );
}

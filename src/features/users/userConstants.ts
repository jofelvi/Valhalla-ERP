import { UserRoleEnum } from '@/shared/types/enumShared';
import { BadgeVariant } from '@/components/shared/badge/badge';

export const ROLE_LABELS: Record<UserRoleEnum, string> = {
  [UserRoleEnum.ADMIN]: 'Administrador',
  [UserRoleEnum.MANAGER]: 'Gerente',
  [UserRoleEnum.CASHIER]: 'Cajero',
  [UserRoleEnum.WAITER]: 'Mesero',
  [UserRoleEnum.KITCHEN]: 'Cocina',
  [UserRoleEnum.BAR]: 'Barra',
  [UserRoleEnum.PIZZA]: 'Pizza',
  [UserRoleEnum.CUSTOMER]: 'Cliente',
};

export const ROLE_BADGE_VARIANTS: Record<UserRoleEnum, BadgeVariant> = {
  [UserRoleEnum.ADMIN]: 'destructive',
  [UserRoleEnum.MANAGER]: 'default',
  [UserRoleEnum.CASHIER]: 'info',
  [UserRoleEnum.WAITER]: 'success',
  [UserRoleEnum.KITCHEN]: 'warning',
  [UserRoleEnum.BAR]: 'warning',
  [UserRoleEnum.PIZZA]: 'warning',
  [UserRoleEnum.CUSTOMER]: 'secondary',
};

export const STAFF_ROLES: UserRoleEnum[] = [
  UserRoleEnum.ADMIN,
  UserRoleEnum.MANAGER,
  UserRoleEnum.CASHIER,
  UserRoleEnum.WAITER,
  UserRoleEnum.KITCHEN,
  UserRoleEnum.BAR,
  UserRoleEnum.PIZZA,
];

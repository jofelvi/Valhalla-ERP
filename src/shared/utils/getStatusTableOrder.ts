import { TableStatusEnum } from '@/shared/types/enumShared';
import { BadgeVariant } from '@/components/shared/badge/badge';

export const getStatusVariant = (status: TableStatusEnum): BadgeVariant => {
  switch (status) {
    case TableStatusEnum.ISAVAILABLE:
      return 'success'; // Verde para disponible
    case TableStatusEnum.OCCUPIED:
      return 'destructive'; // Rojo para ocupado
    case TableStatusEnum.RESERVED:
      return 'info'; // Azul para reservado
    case TableStatusEnum.PREPARING:
      return 'warning'; // Amarillo para preparando
    case TableStatusEnum.CLEANING:
      return 'warning'; // Amarillo para limpiando
    default:
      return 'default'; // Por defecto, si hay algún estado no manejado
  }
};

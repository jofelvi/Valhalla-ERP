import { BudgetStatusEnum } from '@/shared/types/enumShared';

export interface StatusConfigBase {
  label: string;
  variant:
    | 'default'
    | 'secondary'
    | 'info'
    | 'success'
    | 'destructive'
    | 'warning';
  iconName: 'clock' | 'send' | 'check-circle' | 'x-circle' | 'alert-triangle';
}

export const STATUS_CONFIG_BASE: Record<BudgetStatusEnum, StatusConfigBase> = {
  [BudgetStatusEnum.DRAFT]: {
    label: 'Borrador',
    variant: 'secondary',
    iconName: 'clock',
  },
  [BudgetStatusEnum.SENT]: {
    label: 'Enviado',
    variant: 'info',
    iconName: 'send',
  },
  [BudgetStatusEnum.APPROVED]: {
    label: 'Aprobado',
    variant: 'success',
    iconName: 'check-circle',
  },
  [BudgetStatusEnum.REJECTED]: {
    label: 'Rechazado',
    variant: 'destructive',
    iconName: 'x-circle',
  },
  [BudgetStatusEnum.EXPIRED]: {
    label: 'Vencido',
    variant: 'warning',
    iconName: 'alert-triangle',
  },
};

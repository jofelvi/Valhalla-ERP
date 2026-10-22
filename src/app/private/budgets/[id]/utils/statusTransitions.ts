import { BudgetStatusEnum } from '@/shared/types/enumShared';

export interface StatusTransitionBase {
  target: BudgetStatusEnum;
  label: string;
  iconName: 'clock' | 'send' | 'check-circle' | 'x-circle' | 'alert-triangle';
  variant: 'default' | 'outline' | 'ghost' | 'destructive';
}

export function getAvailableTransitionsBase(
  current: BudgetStatusEnum,
): StatusTransitionBase[] {
  const transitions: StatusTransitionBase[] = [];

  switch (current) {
    case BudgetStatusEnum.DRAFT:
      transitions.push({
        target: BudgetStatusEnum.SENT,
        label: 'Marcar como Enviado',
        iconName: 'send',
        variant: 'default',
      });
      break;
    case BudgetStatusEnum.SENT:
      transitions.push(
        {
          target: BudgetStatusEnum.APPROVED,
          label: 'Aprobar',
          iconName: 'check-circle',
          variant: 'default',
        },
        {
          target: BudgetStatusEnum.REJECTED,
          label: 'Rechazar',
          iconName: 'x-circle',
          variant: 'destructive',
        },
      );
      break;
    case BudgetStatusEnum.APPROVED:
      transitions.push({
        target: BudgetStatusEnum.EXPIRED,
        label: 'Marcar como Vencido',
        iconName: 'alert-triangle',
        variant: 'outline',
      });
      break;
    case BudgetStatusEnum.REJECTED:
      transitions.push({
        target: BudgetStatusEnum.DRAFT,
        label: 'Volver a Borrador',
        iconName: 'clock',
        variant: 'outline',
      });
      break;
    case BudgetStatusEnum.EXPIRED:
      transitions.push({
        target: BudgetStatusEnum.DRAFT,
        label: 'Volver a Borrador',
        iconName: 'clock',
        variant: 'outline',
      });
      break;
  }

  return transitions;
}

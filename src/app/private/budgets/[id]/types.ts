import { BudgetStatusEnum } from '@/shared/types/enumShared';

export interface StatusConfig {
  label: string;
  variant:
    | 'default'
    | 'secondary'
    | 'info'
    | 'success'
    | 'destructive'
    | 'warning';
  icon: React.ReactNode;
}

export interface StatusTransition {
  target: BudgetStatusEnum;
  label: string;
  icon: React.ReactNode;
  variant: 'default' | 'outline' | 'ghost' | 'destructive';
}

export interface BudgetDetailState {
  showStatusMenu: boolean;
  showGenerateInvoice: boolean;
}

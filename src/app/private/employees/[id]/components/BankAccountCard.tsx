import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCardIcon } from 'lucide-react';
import { Employee } from '@odin6/types';

interface BankAccountCardProps {
  employee: Employee;
}

export const BankAccountCard = ({ employee }: BankAccountCardProps) => {
  if (!employee.bankAccount) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCardIcon className="h-5 w-5 text-brand" />
          Informacion Bancaria
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-2.5 rounded-lg bg-elevated/50">
            <p className="text-xs text-brand/70">Numero de Cuenta</p>
            <p className="text-sm font-medium text-content">
              {employee.bankAccount.accountNumber}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-elevated/50">
            <p className="text-xs text-brand/70">Banco</p>
            <p className="text-sm font-medium text-content">
              {employee.bankAccount.bankName}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-elevated/50">
            <p className="text-xs text-brand/70">Tipo de Cuenta</p>
            <p className="text-sm font-medium text-content">
              {employee.bankAccount.accountType}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

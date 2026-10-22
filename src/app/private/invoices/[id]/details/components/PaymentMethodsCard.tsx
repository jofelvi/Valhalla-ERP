'use client';
import { CreditCard } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import { PaymentMethodSummary } from '../types';

interface PaymentMethodsCardProps {
  payments: PaymentMethodSummary[];
  totalPaid: number;
}

export const PaymentMethodsCard: React.FC<PaymentMethodsCardProps> = ({
  payments,
  totalPaid,
}) => {
  if (payments.length === 0) {
    return null;
  }

  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50">
      <CardHeader>
        <CardTitle className="text-content flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Métodos de Pago
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {payments.map((payment, index) => (
            <div
              key={index}
              className="flex justify-between items-center p-3 bg-gradient-to-r from-page to-elevated rounded-lg"
            >
              <div>
                <span className="font-medium text-content">
                  {payment.method}
                </span>
                <span className="text-xs text-brand ml-2">
                  ({payment.count} pago{payment.count > 1 ? 's' : ''})
                </span>
              </div>
              <span className="font-semibold text-content">
                ${payment.amount.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="border-t border-line pt-3">
            <FilaDeResumen
              className="font-semibold text-content"
              etiqueta="Total Pagado:"
              valor={<>${totalPaid.toFixed(2)}</>}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

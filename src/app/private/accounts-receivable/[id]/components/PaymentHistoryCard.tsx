import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { Banknote, Wallet, Clock } from 'lucide-react';
import { Payment } from '@/modelTypes/payment';
import { formatearUsdConMiles, formatearBs } from '@/shared/utils/dinero';
import { formatPaymentDateTime, getPaymentMethodLabel } from '../utils';

interface PaymentHistoryCardProps {
  payments: Payment[];
}

export function PaymentHistoryCard({ payments }: PaymentHistoryCardProps) {
  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-ok/20">
      <CardHeader className="border-b border-ok/20 pb-4">
        <CardTitle className="text-content flex items-center gap-2 text-lg">
          <Banknote className="h-5 w-5 text-ok" />
          Historial de Abonos ({payments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {payments.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-elevated rounded-full flex items-center justify-center mx-auto mb-3">
              <Banknote className="h-6 w-6 text-dim" />
            </div>
            <p className="text-sm text-dim font-medium">
              Sin abonos registrados
            </p>
            <p className="text-xs text-dim mt-1">
              Los pagos parciales o totales apareceran aqui
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 bg-ok/10 rounded-xl border border-ok/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-ok/20 rounded-lg flex items-center justify-center shrink-0">
                    <Wallet className="h-4 w-4 text-ok" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ok text-sm">
                        {formatearUsdConMiles(payment.amount)}
                      </span>
                      <Badge variant="info" className="text-[10px]">
                        {getPaymentMethodLabel(payment.method)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-ok/70 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {formatPaymentDateTime(payment.createdAt)}
                    </div>
                    {payment.bcvRate && payment.bcvRate > 0 && (
                      <p className="text-[10px] text-ok/60 mt-0.5">
                        Tasa: Bs. {payment.bcvRate.toFixed(2)}
                        {payment.expectedAmountBS
                          ? ` · ${formatearBs(payment.expectedAmountBS)}`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Total abonado */}
            <div className="border-t border-ok/30 pt-3 mt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-ok">Total abonado</span>
              <span className="text-lg font-bold text-ok">
                {formatearUsdConMiles(
                  payments.reduce((sum, p) => sum + p.amount, 0),
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

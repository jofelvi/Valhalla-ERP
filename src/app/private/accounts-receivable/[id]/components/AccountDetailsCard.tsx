import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Hash, Calendar, FileText } from 'lucide-react';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { formatDate } from '../utils';

interface AccountDetailsCardProps {
  accountReceivable: AccountReceivable;
  isOverdue: boolean;
}

export function AccountDetailsCard({
  accountReceivable,
  isOverdue,
}: AccountDetailsCardProps) {
  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50 hover:shadow-xl hover:-translate-y-0">
      <CardHeader className="border-b border-line/50 pb-4">
        <CardTitle className="text-content flex items-center gap-2 text-lg">
          <Hash className="h-5 w-5 text-brand" />
          Detalles de la Cuenta
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-brand/20 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-brand" />
            </div>
            <div>
              <p className="text-xs font-medium text-brand">N° Factura</p>
              <p className="font-semibold text-content">
                {accountReceivable.invoiceNumber}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-accent/20 rounded-lg flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xs font-medium text-accent">Vencimiento</p>
              <p
                className={`font-semibold ${isOverdue ? 'text-danger' : 'text-content'}`}
              >
                {formatDate(accountReceivable.dueDate)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-brand/20 rounded-lg flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-brand" />
            </div>
            <div>
              <p className="text-xs font-medium text-brand">Creacion</p>
              <p className="font-semibold text-content">
                {formatDate(accountReceivable.createdAt)}
              </p>
            </div>
          </div>

          {accountReceivable.updatedAt && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-brand/10 to-brand/5 rounded-lg flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-brand" />
              </div>
              <div>
                <p className="text-xs font-medium text-brand">Actualizado</p>
                <p className="font-semibold text-content">
                  {formatDate(accountReceivable.updatedAt)}
                </p>
              </div>
            </div>
          )}
        </div>

        {accountReceivable.description && (
          <div className="mt-5 bg-gradient-to-br from-page/60 to-elevated/60 p-4 rounded-xl border border-line/50">
            <p className="text-xs font-medium text-brand mb-1">Descripcion</p>
            <p className="text-sm text-content leading-relaxed">
              {accountReceivable.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

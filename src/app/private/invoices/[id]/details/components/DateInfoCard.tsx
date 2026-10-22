'use client';
import { Calendar, DollarSign } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { formatDate, formatDateTime } from '@/shared/utils/dateHelpers';
import { Invoice } from '@odin6/types';

interface DateInfoCardProps {
  invoice: Invoice;
}

export const DateInfoCard: React.FC<DateInfoCardProps> = ({ invoice }) => {
  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50">
      <CardHeader>
        <CardTitle className="text-content">Información de Fechas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center">
            <Calendar className="h-5 w-5 text-on-brand" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand mb-1">
              Fecha de Creación
            </p>
            <p className="font-semibold text-content">
              {formatDateTime(invoice.createdAt)}
            </p>
          </div>
        </div>

        {invoice.dueDate && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-accent mb-1">
                Fecha de Vencimiento
              </p>
              <p className="font-semibold text-accent">
                {formatDate(invoice.dueDate)}
              </p>
            </div>
          </div>
        )}

        {invoice.paidAt && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-ok to-ok/80 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-ok" />
            </div>
            <div>
              <p className="text-sm font-medium text-ok mb-1">Fecha de Pago</p>
              <p className="font-semibold text-ok">
                {formatDateTime(invoice.paidAt)}
              </p>
            </div>
          </div>
        )}

        {/* Información adicional de la factura */}
        <div className="border-t border-line pt-4">
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-brand">ID de Factura:</span>
              <span className="font-mono text-content">
                {invoice.id.slice(0, 12)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand">Número de Factura:</span>
              <span className="font-semibold text-content">
                #{invoice.invoiceNumber}
              </span>
            </div>
            {invoice.orderId && (
              <div className="flex justify-between">
                <span className="text-brand">ID de Orden:</span>
                <span className="font-mono text-content">
                  {invoice.orderId.slice(0, 12)}...
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

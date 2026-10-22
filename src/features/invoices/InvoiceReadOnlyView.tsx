import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { Invoice } from '@odin6/types';
import { Order } from '@odin6/types';
import { Customer } from '@odin6/types';
import { User as UserModel } from '@odin6/types';
import { Payment } from '@odin6/types';
import { Product } from '@odin6/types';
import { OrderItem } from '@odin6/types';

interface EnrichedOrderItem extends OrderItem {
  product?: Product;
}

interface InvoiceDetailData {
  invoice: Invoice;
  order?: Order | null;
  customer?: Customer | null;
  user?: UserModel | null;
  enrichedItems: EnrichedOrderItem[];
  payments: Payment[];
  totalPaid: number;
}
import { InvoiceStatusEnum } from '@/shared';
import { formatDate, formatDateTime } from '@/shared/utils/dateHelpers';
import {
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  ShoppingCart,
  User,
} from 'lucide-react';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

interface InvoiceReadOnlyViewProps {
  invoiceDetails: InvoiceDetailData;
}

function getStatusVariant(
  status: InvoiceStatusEnum,
): 'success' | 'warning' | 'destructive' | 'secondary' | 'default' {
  switch (status) {
    case InvoiceStatusEnum.PAID:
      return 'success';
    case InvoiceStatusEnum.PENDING:
    case InvoiceStatusEnum.PARTIALLY_PAID:
      return 'warning';
    case InvoiceStatusEnum.OVERDUE:
      return 'destructive';
    case InvoiceStatusEnum.CANCELLED:
      return 'secondary';
    default:
      return 'default';
  }
}

function getStatusLabel(status: InvoiceStatusEnum): string {
  switch (status) {
    case InvoiceStatusEnum.PAID:
      return 'Pagada';
    case InvoiceStatusEnum.PENDING:
      return 'Pendiente';
    case InvoiceStatusEnum.PARTIALLY_PAID:
      return 'Pago Parcial';
    case InvoiceStatusEnum.OVERDUE:
      return 'Vencida';
    case InvoiceStatusEnum.CANCELLED:
      return 'Cancelada';
    default:
      return status;
  }
}

export default function InvoiceReadOnlyView({
  invoiceDetails,
}: InvoiceReadOnlyViewProps) {
  const { invoice, customer, user, enrichedItems, payments, totalPaid } =
    invoiceDetails;

  const paymentMethodsSummary = new Map<
    string,
    { amount: number; count: number }
  >();
  payments.forEach((payment) => {
    const method = payment.method ?? 'No especificado';
    const existing = paymentMethodsSummary.get(method) ?? {
      amount: 0,
      count: 0,
    };
    paymentMethodsSummary.set(method, {
      amount: existing.amount + (payment.amount ?? 0),
      count: existing.count + 1,
    });
  });
  const paymentSummaryList = Array.from(paymentMethodsSummary.entries()).map(
    ([method, data]) => ({ method, ...data }),
  );

  const pendingBalance = Math.max(0, (invoice.total ?? 0) - totalPaid);
  const isFullyPaid = totalPaid >= (invoice.total ?? 0);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <Card className="bg-surface/95 backdrop-blur-sm border-accent/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-accent/10 to-accent/5 border-b border-accent/20">
          <CardTitle className="flex justify-between items-center text-content">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factura #{invoice.invoiceNumber ?? invoice.id}
            </span>
            <div className="flex gap-2">
              <Badge variant={getStatusVariant(invoice.status)}>
                {getStatusLabel(invoice.status)}
              </Badge>
              {isFullyPaid ? (
                <Badge variant="success">Pagada Completamente</Badge>
              ) : (
                <Badge variant="warning">
                  Pendiente: ${pendingBalance.toFixed(2)}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Info cliente */}
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-5 rounded-xl border border-accent/20">
            <h3 className="text-base font-semibold text-content mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-accent font-medium">Nombre</p>
                <p className="text-content font-semibold">
                  {customer?.name ?? invoice.customerName ?? 'No especificado'}
                </p>
              </div>
              {customer?.phone && (
                <div>
                  <p className="text-accent font-medium">Teléfono</p>
                  <p className="text-content">{customer.phone}</p>
                </div>
              )}
              {customer?.email && (
                <div>
                  <p className="text-accent font-medium">Email</p>
                  <p className="text-content">{customer.email}</p>
                </div>
              )}
              {user && (
                <div>
                  <p className="text-accent font-medium">Atendido por</p>
                  <p className="text-content">{user.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabla de productos */}
          <div>
            <h3 className="text-base font-semibold text-content mb-3 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Productos
            </h3>
            <div className="overflow-x-auto rounded-xl border border-accent/20">
              <table className="min-w-full divide-y divide-accent/10">
                <thead className="bg-gradient-to-r from-accent/10 to-accent/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-accent uppercase tracking-wider">
                      Cant.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-accent uppercase tracking-wider">
                      P. Unit.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-accent uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-accent/5">
                  {enrichedItems.length > 0 ? (
                    enrichedItems.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-accent/5 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gradient-to-br from-accent to-accent rounded-lg flex items-center justify-center flex-shrink-0">
                              <Package className="h-3.5 w-3.5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-content text-sm">
                                {item.product?.name ?? item.name ?? 'Producto'}
                              </p>
                              {item.notes && (
                                <p className="text-xs text-dim italic">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-dim font-medium text-sm">
                          {item.quantity ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right text-dim text-sm">
                          ${(item.unitPrice ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-content text-sm">
                          $
                          {(
                            (item.quantity ?? 0) * (item.unitPrice ?? 0)
                          ).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-accent text-sm"
                      >
                        Sin productos registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totales + Métodos de pago (2 columnas) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Totales */}
            <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-5 rounded-xl border border-accent/20 space-y-2 text-sm">
              <div className="flex justify-between text-accent">
                <span>Subtotal</span>
                <span className="font-semibold">
                  ${(invoice.subtotal ?? 0).toFixed(2)}
                </span>
              </div>
              {(invoice.tax ?? 0) > 0 && (
                <div className="flex justify-between text-accent">
                  <span>Impuestos</span>
                  <span className="font-semibold">
                    ${(invoice.tax ?? 0).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-accent/20 pt-2 flex justify-between text-base font-bold text-content">
                <span>Total Factura</span>
                <span>${(invoice.total ?? 0).toFixed(2)}</span>
              </div>
              <FilaDeResumen
                className="text-ok font-semibold"
                etiqueta="Total Pagado"
                valor={<>${totalPaid.toFixed(2)}</>}
              />
              {pendingBalance > 0 && (
                <FilaDeResumen
                  className="text-danger font-semibold"
                  etiqueta="Saldo Pendiente"
                  valor={<>${pendingBalance.toFixed(2)}</>}
                />
              )}
            </div>

            {/* Fechas y Métodos de pago */}
            <div className="space-y-3">
              {/* Fechas */}
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-4 rounded-xl border border-accent/20 text-sm space-y-2">
                <div className="flex items-center gap-2 text-accent">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Fechas</span>
                </div>
                <div className="flex justify-between text-dim">
                  <span>Creación:</span>
                  <span className="font-semibold">
                    {formatDateTime(invoice.createdAt)}
                  </span>
                </div>
                {invoice.dueDate && (
                  <div className="flex justify-between text-dim">
                    <span>Vencimiento:</span>
                    <span className="font-semibold">
                      {formatDate(invoice.dueDate)}
                    </span>
                  </div>
                )}
                {invoice.paidAt && (
                  <div className="flex justify-between text-ok">
                    <span>Pago:</span>
                    <span className="font-semibold">
                      {formatDateTime(invoice.paidAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Métodos de pago */}
              {paymentSummaryList.length > 0 && (
                <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-4 rounded-xl border border-accent/20 text-sm">
                  <div className="flex items-center gap-2 text-accent mb-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="font-medium">Métodos de Pago</span>
                  </div>
                  <div className="space-y-1">
                    {paymentSummaryList.map((p, i) => (
                      <div key={i} className="flex justify-between text-dim">
                        <span>
                          {p.method}{' '}
                          <span className="text-xs text-accent">
                            ({p.count})
                          </span>
                        </span>
                        <span className="font-semibold">
                          ${p.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ID de factura */}
              <div className="flex items-center gap-2 text-xs text-dim px-1">
                <DollarSign className="h-3 w-3" />
                <span>ID: {invoice.id}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="bg-elevated p-4 rounded-xl border border-line text-sm">
              <p className="font-medium text-dim mb-1">Notas</p>
              <p className="text-content">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

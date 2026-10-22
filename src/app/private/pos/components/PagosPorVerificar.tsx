import { Order } from '@/modelTypes/order';
import { User } from '@/modelTypes/user';
import { Card } from '@/components/shared/card/card';
import { ShieldCheck, Utensils, UserCheck, X as XIcon } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { getPaymentMethodLabel } from '../utils';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';
import { formatSmartTime } from '@/shared/utils/dateHelpers';
import { useMemo, useState } from 'react';

interface PagosPorVerificarProps {
  orders: Order[];
  waiters: User[];
  onRejectOrder: (order: Order) => void;
  onVerifyOrder: (orderId: string) => void;
}

export default function PagosPorVerificar({
  orders,
  waiters,
  onRejectOrder,
  onVerifyOrder,
}: PagosPorVerificarProps) {
  const [filterWaiter, setFilterWaiter] = useState<string>('all');
  const [filterMethod, setFilterMethod] = useState<string>('all');

  const { verifyWaiterOptions, verifyMethodOptions, filteredOrders } =
    useMemo(() => {
      const waiterOptions = Array.from(
        new Map(
          orders
            .filter((o) => o.waiterId)
            .map((o) => [
              o.waiterId!,
              waiters.find((w) => w.id === o.waiterId)?.name ?? 'Sin nombre',
            ]),
        ).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1]));

      const methodOptions = Array.from(
        new Set(
          orders.flatMap((o) =>
            o.pendingPayments && o.pendingPayments.length > 0
              ? o.pendingPayments.map((p) => p.method).filter(Boolean)
              : [o.paymentMethod].filter(Boolean),
          ) as string[],
        ),
      ).sort();

      const filtered = orders.filter((o) => {
        if (filterWaiter !== 'all' && o.waiterId !== filterWaiter) return false;
        if (filterMethod !== 'all') {
          const orderMethods =
            o.pendingPayments && o.pendingPayments.length > 0
              ? o.pendingPayments.map((p) => p.method)
              : [o.paymentMethod];
          if (!orderMethods.some((m) => String(m) === filterMethod))
            return false;
        }
        return true;
      });

      return {
        verifyWaiterOptions: waiterOptions,
        verifyMethodOptions: methodOptions,
        filteredOrders: filtered,
      };
    }, [orders, waiters, filterWaiter, filterMethod]);

  const hasActiveFilter = filterWaiter !== 'all' || filterMethod !== 'all';

  if (orders.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-bold text-content mb-3 flex items-center">
        <ShieldCheck className="w-5 h-5 mr-1.5 text-accent" />
        Pagos por Verificar
        <span className="ml-2 px-2 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded-full">
          {hasActiveFilter
            ? `${filteredOrders.length} / ${orders.length}`
            : orders.length}
        </span>
      </h2>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={filterWaiter}
          onChange={(e) => setFilterWaiter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-surface border border-line rounded-lg text-content focus:border-accent focus:outline-none"
        >
          <option value="all">Todos los mesoneros</option>
          {verifyWaiterOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          className="px-3 py-1.5 text-xs bg-surface border border-line rounded-lg text-content focus:border-accent focus:outline-none"
        >
          <option value="all">Todos los pagos</option>
          {verifyMethodOptions.map((m) => (
            <option key={m} value={m}>
              {getPaymentMethodLabel(m)}
            </option>
          ))}
        </select>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setFilterWaiter('all');
              setFilterMethod('all');
            }}
            className="px-3 py-1.5 text-xs text-dim hover:text-content underline"
          >
            Limpiar
          </button>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="p-4 text-center text-sm text-dim bg-surface/40 border border-line rounded-lg">
          No hay pagos que coincidan con los filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredOrders.map((order) => {
            const waiter = waiters.find((w) => w.id === order.waiterId);
            return (
              <Card
                key={order.id}
                className="bg-surface border border-accent/20 overflow-hidden"
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-content">
                        {getDisplayOrderNumber(order)}
                      </span>
                      {order.tableName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-elevated text-dim rounded-full text-[10px] font-semibold">
                          <Utensils className="w-3 h-3" />
                          {order.tableName}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex px-2 py-0.5 bg-accent/15 text-accent rounded-full text-[10px] font-semibold">
                      Por Verificar
                    </span>
                  </div>

                  {waiter && (
                    <div className="flex items-center gap-1 text-xs text-dim mb-2">
                      <UserCheck className="w-3 h-3" />
                      <span>{waiter.name}</span>
                    </div>
                  )}

                  {/* Pagos registrados por mesonero */}
                  {order.pendingPayments && order.pendingPayments.length > 0 ? (
                    <div className="space-y-2 mb-2">
                      {order.pendingPayments.map((payment, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-2 bg-surface/60 rounded-lg border border-line"
                        >
                          <div className="flex items-center gap-2 text-xs mb-1">
                            <span className="px-2 py-0.5 bg-elevated text-dim rounded font-medium">
                              {getPaymentMethodLabel(payment.method)}
                            </span>
                            {payment.reference && (
                              <span className="text-dim">
                                Ref: {payment.reference}
                              </span>
                            )}
                            <span className="ml-auto font-bold text-accent">
                              Bs. {payment.amountBs.toFixed(2)}
                            </span>
                          </div>
                          {payment.pagoMovilPhone && (
                            <div className="text-[10px] text-dim flex gap-2 flex-wrap">
                              <span>
                                Tel: <strong>{payment.pagoMovilPhone}</strong>
                              </span>
                              <span>
                                CI: <strong>{payment.pagoMovilCedula}</strong>
                              </span>
                              {payment.pagoMovilBanco && (
                                <span>
                                  Banco:{' '}
                                  <strong>{payment.pagoMovilBanco}</strong>
                                </span>
                              )}
                            </div>
                          )}
                          {payment.proofUrls &&
                            payment.proofUrls.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {payment.proofUrls.map((url, imgIdx) => (
                                  <a
                                    key={imgIdx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0"
                                  >
                                    <img
                                      src={url}
                                      alt="Comprobante"
                                      className="w-10 h-10 object-cover rounded border border-line hover:border-accent"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
                        <span className="px-2 py-0.5 bg-elevated text-dim rounded font-medium">
                          {getPaymentMethodLabel(
                            order.paymentMethod ?? undefined,
                          )}
                        </span>
                        {order.paymentReference && (
                          <span className="text-dim">
                            Ref: {order.paymentReference}
                          </span>
                        )}
                      </div>
                      {order.pagoMovilPhone && (
                        <div className="mb-2 p-2 bg-elevated rounded-lg text-[10px] text-dim space-y-0.5">
                          <div className="flex gap-2">
                            <span>
                              Tel:{' '}
                              <strong className="text-content">
                                {order.pagoMovilPhone}
                              </strong>
                            </span>
                            <span>
                              CI:{' '}
                              <strong className="text-content">
                                {order.pagoMovilCedula}
                              </strong>
                            </span>
                          </div>
                          {order.pagoMovilBanco && (
                            <div>
                              Banco:{' '}
                              <strong className="text-content">
                                {order.pagoMovilBanco}
                              </strong>
                            </div>
                          )}
                        </div>
                      )}
                      {order.paymentProofUrls &&
                        order.paymentProofUrls.length > 0 && (
                          <div className="mb-2 flex gap-1.5 overflow-x-auto">
                            {order.paymentProofUrls.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0"
                              >
                                <img
                                  src={url}
                                  alt={`Comprobante ${idx + 1}`}
                                  className="w-14 h-14 object-cover rounded-lg border border-line hover:border-accent transition-colors"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                    </>
                  )}

                  {(order.tipAmount ?? 0) > 0 && (
                    <div className="mb-2 flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-accent/10 border border-accent/20">
                      <span className="text-dim">Propina</span>
                      <span className="font-semibold text-accent">
                        ${(order.tipAmount ?? 0).toFixed(2)}
                        {order.bcvRate ? (
                          <span className="ml-1 text-dim font-normal">
                            · Bs.{' '}
                            {((order.tipAmount ?? 0) * order.bcvRate).toFixed(
                              2,
                            )}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-lg font-bold text-accent">
                        ${order.total.toFixed(2)}
                      </span>
                      {order.paymentAmountBs ? (
                        <span className="ml-2 text-xs text-dim">
                          Bs. {order.paymentAmountBs.toFixed(2)}
                        </span>
                      ) : order.bcvRate ? (
                        <span className="ml-2 text-xs text-dim">
                          Bs. {(order.total * order.bcvRate).toFixed(2)}
                        </span>
                      ) : null}
                      {(order.tipAmount ?? 0) > 0 && (
                        <span className="ml-2 text-[10px] text-ok font-semibold">
                          + ${(order.tipAmount ?? 0).toFixed(2)} prop
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onRejectOrder(order)}
                        className="px-2.5 py-1.5 bg-surface border border-danger/30 text-danger hover:bg-danger/10 text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1"
                        title="Rechazar pago — el mesonero podra corregir y volver a enviar"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                        Rechazar
                      </button>
                      <Button
                        size="sm"
                        className="px-3 py-1.5 bg-gradient-to-r from-ok to-ok hover:from-ok hover:to-ok text-on-brand text-xs font-bold"
                        onClick={() => onVerifyOrder(order.id)}
                      >
                        Verificar y Cobrar
                      </Button>
                    </div>
                  </div>

                  {order.bcvRate && (
                    <p className="text-[10px] text-dim mt-1">
                      Tasa: {order.bcvRate.toFixed(2)} Bs/$ •{' '}
                      {formatSmartTime(order.createdAt)}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

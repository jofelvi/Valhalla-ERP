'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useNegocio, useNombreApp } from '@/shared/config';
import { BrandLogo } from '@/shared/ui/brand/BrandLogo';
import { nombreBanco } from '@/shared/constants/banks';
import {
  AlertCircle,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  Receipt,
  Send,
  Users,
} from 'lucide-react';
import { formatearUsdConMiles, formatearBs } from '@/shared/utils/dinero';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

interface PublicOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes: string | null;
}

interface PublicOrderData {
  id: string;
  orderNumber: string;
  tableName: string | null;
  sector: string | null;
  customerAlias: string | null;
  items: PublicOrderItem[];
  subtotal: number;
  serviceCharge: number;
  tax: number;
  tipAmount: number;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

interface PublicAccountData {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paidAmount: number;
  pending: number;
  status: string;
  dueDate: string;
}



const formatDateTime = (date: string) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusLabel = (paymentStatus: string): { label: string; color: string } => {
  if (paymentStatus === 'paid') return { label: 'Pagada', color: 'bg-ok' };
  if (paymentStatus === 'pending_verification')
    return { label: 'En verificación', color: 'bg-blue-500' };
  return { label: 'Pendiente de pago', color: 'bg-brand' };
};

export default function PrecuentaPublicPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<PublicOrderData | null>(null);
  const [account, setAccount] = useState<PublicAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const negocio = useNegocio();
  const nombre = useNombreApp();
  const pagoMovil = negocio.mobilePayment;
  const [bcvRate, setBcvRate] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/public/order/${orderId}`);
        const json = (await res.json()) as {
          success: boolean;
          order?: PublicOrderData;
          account?: PublicAccountData | null;
          error?: string;
        };
        if (!res.ok || !json.success) {
          setError(json.error || 'No se pudo cargar la orden');
          return;
        }
        if (json.order) setOrder(json.order);
        if (json.account) setAccount(json.account);
        if (!json.order && !json.account) {
          setError('No se pudo cargar la orden');
        }
      } catch {
        setError('Error al cargar la orden. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [orderId]);

  useEffect(() => {
    const loadRate = async () => {
      try {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiBase}/api/exchange/bcv-rate`);
        if (!res.ok) return;
        const json = (await res.json()) as { rate?: number };
        if (json.rate && json.rate > 0) setBcvRate(json.rate);
      } catch {
        /* sin tasa: precios solo en USD */
      }
    };
    void loadRate();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand animate-spin mx-auto" />
          <p className="text-content mt-4">Cargando su precuenta...</p>
        </div>
      </div>
    );
  }

  if (error || (!order && !account)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated flex items-center justify-center p-4">
        <div className="bg-page/80 backdrop-blur-sm border border-danger/30 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
          <h1 className="text-xl font-bold text-stone-50 mb-2">Orden no encontrada</h1>
          <p className="text-dim">{error || 'El enlace puede ser inválido o la orden fue eliminada.'}</p>
        </div>
      </div>
    );
  }

  const status = statusLabel(order?.paymentStatus || 'pending');
  const location = order?.tableName || order?.sector || 'Para llevar';
  const hasPending = (account?.pending ?? 0) > 0.01;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header - Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-2">
            <BrandLogo />
            <p className="text-xs text-dim">{negocio.address}</p>
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-page/90 backdrop-blur-sm border border-brand/20 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header de la orden */}
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-amber-100 font-medium uppercase tracking-wider">
                  {account ? 'Factura' : 'Precuenta'}
                </p>
                <h2 className="text-2xl font-bold text-on-brand flex items-center gap-2 mt-1 truncate">
                  <Receipt className="w-6 h-6 flex-shrink-0" />
                  #{account?.invoiceNumber || order?.orderNumber}
                </h2>
              </div>
              <div className={`${status.color} px-3 py-1.5 rounded-full flex-shrink-0`}>
                <span className="text-xs font-bold text-on-brand uppercase">{status.label}</span>
              </div>
            </div>
          </div>

          {/* Info */}
          {order && (
            <div className="p-5 border-b border-line">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-dim text-xs">Ubicación</p>
                    <p className="text-stone-50 font-semibold">{location}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-dim text-xs">Fecha</p>
                    <p className="text-stone-50 font-semibold">{formatDateTime(order.createdAt)}</p>
                  </div>
                </div>
                {(order.customerAlias || account?.customerName) && (
                  <div className="flex items-start gap-2 col-span-2">
                    <Users className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-dim text-xs">Cliente</p>
                      <p className="text-stone-50 font-semibold">
                        {account?.customerName || order.customerAlias}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          {order && order.items.length > 0 && (
            <div className="p-5">
              <h3 className="text-xs font-bold text-brand uppercase tracking-wider mb-3">
                Productos ({order.items.length})
              </h3>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 py-2 border-b border-line last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-brand font-bold text-sm">{item.quantity}x</span>
                        <span className="text-stone-50 font-medium">{item.name}</span>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-dim italic mt-0.5 ml-6">{item.notes}</p>
                      )}
                      <p className="text-xs text-dim ml-6">
                        {formatearUsdConMiles(item.unitPrice)} c/u
                      </p>
                    </div>
                    <span className="text-stone-50 font-bold whitespace-nowrap">
                      {formatearUsdConMiles(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totales */}
          <div className="bg-page/60 p-5 space-y-2">
            {order && (
              <>
                <FilaDeResumen
                  className="text-content text-sm"
                  etiqueta="Subtotal"
                  valor={formatearUsdConMiles(order.subtotal)}
                />
                {order.serviceCharge > 0 && (
                  <FilaDeResumen
                    className="text-content text-sm"
                    etiqueta="Servicio (10%)"
                    valor={formatearUsdConMiles(order.serviceCharge)}
                  />
                )}
                {order.tax > 0 && (
                  <FilaDeResumen
                    className="text-content text-sm"
                    etiqueta="Impuestos"
                    valor={formatearUsdConMiles(order.tax)}
                  />
                )}
                {order.tipAmount > 0 && (
                  <FilaDeResumen
                    className="text-content text-sm"
                    etiqueta="Propina"
                    valor={formatearUsdConMiles(order.tipAmount)}
                  />
                )}
                <div className="h-px bg-elevated my-2" />
                <div className="flex justify-between items-start">
                  <span className="text-stone-50 font-bold text-lg">Total</span>
                  <div className="text-right">
                    <div className="text-brand font-bold text-2xl">
                      {formatearUsdConMiles(order.total)}
                    </div>
                    {bcvRate && (
                      <div className="text-brand-light/80 text-sm font-semibold mt-0.5">
                        {formatearBs(order.total * bcvRate)}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Info de cuenta por cobrar */}
            {account && (
              <>
                {order && <div className="h-px bg-elevated my-2" />}
                {account.paidAmount > 0 && (
                  <FilaDeResumen
                    className="text-ok text-sm"
                    etiqueta="Ya pagado"
                    valor={formatearUsdConMiles(account.paidAmount)}
                  />
                )}
                {hasPending && (
                  <div className="flex justify-between items-start pt-2 border-t border-danger/30">
                    <span className="text-danger font-bold text-base">Pendiente</span>
                    <div className="text-right">
                      <div className="text-danger font-bold text-2xl">
                        {formatearUsdConMiles(account.pending)}
                      </div>
                      {bcvRate && (
                        <div className="text-danger/80 text-sm font-semibold mt-0.5">
                          {formatearBs(account.pending * bcvRate)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tasa BCV usada */}
            {bcvRate && (
              <div className="pt-2 mt-1 border-t border-line">
                <p className="text-[11px] text-dim text-right">
                  Tasa BCV: 1 USD = {formatearBs(bcvRate).replace('Bs ', '')} Bs
                </p>
              </div>
            )}
          </div>

          {/* CTA Reportar Pago (solo si hay pendiente) */}
          {account && hasPending && (
            <div className="p-5 border-t border-brand/20 bg-gradient-to-br from-amber-900/20 to-elevated/20">
              <Link href={`/public/reportar-pago/${account.id}`} className="block">
                <button
                  type="button"
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-on-brand font-bold py-4 rounded-xl shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <DollarSign className="w-5 h-5" />
                  Reportar Pago
                  <Send className="w-4 h-4" />
                </button>
              </Link>
              <p className="text-center text-xs text-brand-light/60 mt-2">
                Al reportar, adjunta tu comprobante de pago
              </p>
            </div>
          )}

          {/* Métodos de pago */}
          <div className="p-5 border-t border-line bg-page/60">
            <h3 className="text-xs font-bold text-brand uppercase tracking-wider mb-3">
              Métodos de pago aceptados
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-elevated rounded-lg p-2 text-center text-content">
                💵 Efectivo USD
              </div>
              <div className="bg-elevated rounded-lg p-2 text-center text-content">
                💴 Efectivo Bs
              </div>
              <div className="bg-elevated rounded-lg p-2 text-center text-content">
                💳 Tarjeta
              </div>
              <div className="bg-elevated rounded-lg p-2 text-center text-content">
                📱 Pago Móvil Banco de Venezuela
              </div>
            </div>
            {pagoMovil && (
            <div className="mt-3 p-3 bg-brand/10 border border-brand/30 rounded-lg">
              <p className="text-xs text-brand-light font-semibold mb-1">Pago Móvil {nombreBanco(pagoMovil.bank)}</p>
              <p className="text-xs text-content">
                <span className="font-mono">{pagoMovil.bank}</span> · CI:{' '}
                <span className="font-mono">{pagoMovil.documentId}</span> · Tlf:{' '}
                <span className="font-mono">{pagoMovil.phone}</span>
              </p>
            </div>)}
          </div>

          {/* Footer */}
          <div className="p-4 bg-page text-center">
            <p className="text-xs text-dim">
              Este es un resumen de su consumo. Para pagar, presente este número al mesonero o
              cajero:{' '}
              <span className="text-brand font-bold">
                #{account?.invoiceNumber || order?.orderNumber}
              </span>
            </p>
            <p className="text-xs text-dim mt-2">{nombre} · Gracias por su preferencia</p>
          </div>
        </div>
      </div>
    </div>
  );
}

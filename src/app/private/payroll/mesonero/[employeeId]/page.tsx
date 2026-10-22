'use client';
import Modal from '@/components/shared/modal';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useActiveEmployees } from '@/hooks/useEmployees';
import { api } from '@/services/api/apiClient';
import { Order, PendingPaymentEntry } from '@/modelTypes/order';
import { User } from '@/modelTypes/user';
import { calcularComision, type NominaConfig } from '@odin6/types';
import { shareFraction } from '@/features/payroll/payrollCalc';
import { useNominaConfig } from '@/features/payroll/hooks/useNominaConfig';
import {
  etiquetaComision,
  etiquetaServicio,
  porcentaje,
} from '@/features/pos/utils/etiquetasDeCobro';
import { useTarifas } from '@/shared/config';
import {
  findUserForEmployee,
  ordersForEmployee,
} from '@/features/payroll/waiterMatching';
import {
  checkOrderTip,
  summarizeTipChecks,
  TipCheck,
} from '@/features/payroll/tipReconciliation';
import { formatearBs } from '@/shared/utils/dinero';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

const formatUSD = (n: number) => `$${n.toFixed(2)}`;

interface OrderWithCheck {
  order: Order;
  check: TipCheck;
  /** Comisión de ESTE mesonero (fracción si la orden fue traspasada). */
  commission: number;
  fraction: number;
}

/** Las fotos llegan duplicadas en paymentProofUrls y en pendingPayments[]. */
const proofUrlsOf = (o: Order): string[] =>
  Array.from(
    new Set([
      ...(o.paymentProofUrls ?? []),
      ...(o.pendingPayments?.flatMap((p) => p.proofUrls ?? []) ?? []),
    ]),
  );

const TIP_BADGE: Record<
  TipCheck['status'],
  { label: string; cls: string } | null
> = {
  MATCH: { label: 'Propina verificada', cls: 'bg-ok/15 text-ok' },
  NOT_CHARGED: {
    label: 'La propina no pasó por el punto',
    cls: 'bg-accent/15 text-accent',
  },
  OVER_DECLARED: { label: 'Declaró de más', cls: 'bg-danger/15 text-danger' },
  UNDER_DECLARED: {
    label: 'Cobró más de lo declarado',
    cls: 'bg-accent/15 text-accent',
  },
  OCR_DISPUTED: {
    label: 'El comprobante dice otro monto — revisar',
    cls: 'bg-accent/15 text-accent',
  },
  INCOMPLETE: {
    label: 'Pago incompleto — no se puede cotejar',
    cls: 'bg-elevated text-dim',
  },
  UNVERIFIABLE: { label: 'Sin comprobante', cls: 'bg-elevated text-dim' },
};

/** Por qué se paga ese monto — la justificación en una línea. */
const EVIDENCE_NOTE: Record<TipCheck['evidence'], string> = {
  CONFIRMED: 'respaldada por el comprobante',
  UNCONFIRMED: 'el monto no se pudo leer del comprobante → sin respaldo',
  DISPUTED: 'topada por lo que dice el comprobante',
  NONE: 'sin comprobante → sin respaldo',
};

function PaymentRow({
  payment,
  check,
}: {
  payment: PendingPaymentEntry;
  check: TipCheck;
}) {
  const read = payment.ocr?.extractedAmountsBs ?? [];
  const declared = payment.amountBs ?? 0;
  const confirmed = read.some(
    (a) => Math.abs(a - declared) <= Math.max(2, declared * 0.005),
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] bg-surface/70 rounded-lg px-2.5 py-1.5">
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-content font-semibold">{payment.method}</span>
        {payment.reference && (
          <span className="text-dim truncate">ref {payment.reference}</span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <span className="text-content font-semibold">
          {formatearBs(declared)}
        </span>
        {read.length > 0 ? (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              confirmed ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger'
            }`}
            title={
              confirmed
                ? 'El monto del comprobante coincide con lo tecleado'
                : `El comprobante dice ${read.map(formatearBs).join(', ')}`
            }
          >
            {confirmed
              ? 'comprobante ✓'
              : `comprobante dice ${read.map(formatearBs).join(', ')}`}
          </span>
        ) : (
          <span className="text-[10px] text-dim">sin monto legible</span>
        )}
      </span>
      {(payment.ocr?.warnings?.length ?? 0) > 0 && (
        <p className="w-full text-[10px] text-accent">
          {payment.ocr!.warnings.join(' · ')}
        </p>
      )}
      {check.status === 'INCOMPLETE' && (
        <p className="w-full text-[10px] text-dim">
          Este pago no cubre el total: la orden se cerró con otro tramo
          (efectivo en caja) que no queda registrado aquí.
        </p>
      )}
    </div>
  );
}

function OrderCard({
  item,
  nomina,
  servicio,
}: {
  item: OrderWithCheck;
  nomina: NominaConfig;
  /** Texto de la línea de servicio, o null si el negocio no cobra servicio. */
  servicio: string | null;
}) {
  const { order, check, commission, fraction } = item;
  const [zoom, setZoom] = useState<string | null>(null);
  const proofs = proofUrlsOf(order);
  const badge = TIP_BADGE[check.status];
  const rate = order.bcvRate ?? 0;
  const declaredTip = order.tipAmount ?? 0;

  return (
    <div className="rounded-xl border border-line/60 bg-elevated/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/private/orders/${order.id}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 underline underline-offset-2"
        >
          #{order.id.slice(-8).toUpperCase()}
          <ExternalLink className="h-3 w-3" />
        </Link>
        <span className="text-xs text-dim">
          {order.createdAt
            ? new Date(order.createdAt).toLocaleString('es-VE', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </span>
      </div>
      <p className="text-[10px] text-dim">
        {order.tableName ??
          (order.sector ? String(order.sector).replace('_', ' ') : '')}
        {rate > 0 && ` · tasa del día ${rate.toFixed(2)}`}
        {fraction < 1 && ` · compartida ${Math.round(fraction * 100)}%`}
      </p>

      {/* Desglose del monto de la orden */}
      <div className="bg-surface/70 rounded-lg px-3 py-2 text-xs space-y-1">
        <FilaDeResumen
          etiqueta="Consumo (productos)"
          classNameEtiqueta="text-dim"
          valor={formatUSD(order.subtotal ?? 0)}
          classNameValor="text-content"
        />
        {servicio && (
          <div className="flex justify-between">
            <span className="text-dim">{servicio}</span>
            <span className="text-content">
              + {formatUSD(order.serviceCharge ?? 0)}
            </span>
          </div>
        )}
        <div className="flex justify-between border-t border-line/50 pt-1 font-semibold">
          <span className="text-content">Total de la orden</span>
          <span className="text-content">
            {formatUSD(order.total ?? 0)}
            {rate > 0 && (
              <span className="block text-[10px] font-normal text-dim">
                {formatearBs((order.total ?? 0) * rate)}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Lo que le toca al mesonero */}
      <div className="bg-surface/70 rounded-lg px-3 py-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-dim">{etiquetaComision(nomina)}</span>
          <span className="font-semibold text-ok">
            +{formatUSD(commission)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-dim">Propina declarada</span>
          <span className={declaredTip > 0 ? 'text-content' : 'text-dim'}>
            {declaredTip > 0 ? formatUSD(declaredTip) : '—'}
          </span>
        </div>
        <div className="flex justify-between border-t border-line/50 pt-1">
          <span className="font-semibold text-content">
            Propina a pagar
            <span className="block text-[10px] font-normal text-dim">
              {EVIDENCE_NOTE[check.evidence]}
            </span>
          </span>
          <span
            className={`font-bold ${
              check.payableTipUsd > 0 ? 'text-ok' : 'text-dim'
            }`}
          >
            {check.payableTipUsd > 0
              ? `+${formatUSD(check.payableTipUsd)}`
              : formatUSD(0)}
          </span>
        </div>
        {declaredTip - check.payableTipUsd > 0.01 && (
          <p className="text-[10px] text-accent">
            Declaró {formatUSD(declaredTip)} pero el comprobante solo respalda{' '}
            {formatUSD(check.photoBackedTipUsd)}
            {check.photoBackedTipUsd === 0 &&
              ' (no se pudo leer el monto en la foto)'}
            : no se pagan {formatUSD(declaredTip - check.payableTipUsd)}.
          </p>
        )}
      </div>

      {/* Cotejo del cobro real */}
      <div className="space-y-1">
        {(order.pendingPayments ?? []).map((p, i) => (
          <PaymentRow key={i} payment={p} check={check} />
        ))}

        {check.status !== 'UNVERIFIABLE' ? (
          <div className="rounded-lg border border-line/50 px-2.5 py-1.5 text-[11px] space-y-1">
            <div className="flex justify-between text-dim">
              <span>Cobrado</span>
              <span className="text-content">
                {formatearBs(check.chargedBs)}
              </span>
            </div>
            <div className="flex justify-between text-dim">
              <span>Total de la orden</span>
              <span className="text-content">
                − {formatearBs(check.orderTotalBs)}
              </span>
            </div>
            <div className="flex justify-between border-t border-line/50 pt-1">
              <span className="text-dim">Diferencia real</span>
              <span className="font-semibold text-content">
                {formatearBs(check.chargedBs - check.orderTotalBs)} ={' '}
                {formatUSD(check.realTipUsd)}
              </span>
            </div>
            {check.status === 'NOT_CHARGED' && (
              <p className="text-[10px] text-accent">
                El punto cobró exactamente el total (
                {formatUSD(order.total ?? 0)}
                ), ni un bolívar de más. La propina de {formatUSD(
                  declaredTip,
                )}{' '}
                tuvo que entrar en efectivo o no existió.
              </p>
            )}
            {check.status === 'OVER_DECLARED' && (
              <p className="text-[10px] text-danger">
                Se cobró {formatUSD(check.realTipUsd)} por encima del total pero
                declaró {formatUSD(declaredTip)}: {formatUSD(check.diffUsd)} de
                más.
              </p>
            )}
            {check.status === 'OCR_DISPUTED' && (
              <p className="text-[10px] text-accent">
                El comprobante dice{' '}
                {check.unmatchedOcrAmountsBs.map(formatearBs).join(' / ')} pero
                se tecleó {formatearBs(check.chargedBs)}. Con el monto del
                comprobante la cuenta cambia, así que no se puede concluir nada
                de la propina de {formatUSD(declaredTip)} sin mirar la foto.
              </p>
            )}
            {check.status === 'UNDER_DECLARED' && (
              <p className="text-[10px] text-accent">
                Se cobraron {formatUSD(-check.diffUsd)} de más que no se
                registraron como propina.
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-dim px-2.5">
            Sin comprobante (efectivo en caja): no hay contra qué cotejar la
            propina.
          </p>
        )}

        {badge && (
          <span
            className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* Comprobantes */}
      {proofs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {proofs.map((url) => (
            <button
              key={url}
              onClick={() => setZoom(url)}
              className="relative h-20 w-20 rounded-lg overflow-hidden border border-line/60 hover:border-accent transition-colors"
              title="Ampliar comprobante"
            >
              <Image
                src={url}
                alt="Comprobante"
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <Modal
          isOpen
          estiloPropio
          onClose={() => setZoom(null)}
          classNameFondo="bg-black/80"
          classNameWrap="p-4"
          className="bg-transparent border-0 shadow-none backdrop-blur-none min-h-0 max-w-fit mx-0"
        >
          <button
            className="absolute -top-2 -right-2 rounded-full bg-black/70 p-1 text-white"
            onClick={() => setZoom(null)}
            aria-label="Cerrar"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom}
            alt="Comprobante"
            className="max-h-[90vh] max-w-full rounded-lg"
          />
        </Modal>
      )}
    </div>
  );
}

export default function WaiterOrdersPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = use(params);
  const { data: employees = [], isLoading: loadingEmp } = useActiveEmployees();
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const nomina = useNominaConfig();
  const tarifas = useTarifas();
  const servicio = etiquetaServicio(tarifas);

  useEffect(() => {
    api
      .get<User[]>('/api/users')
      .then(setUsers)
      .catch(() => setUsers([]));
    api
      // Esta pantalla SI abre los comprobantes para cotejar la propina, asi
      // que pide la vista que los incluye (313 KB en vez de 767 KB).
      .get<Order[]>('/api/orders', {
        comisionPendiente: 'true',
        view: 'payroll-waiter',
      })
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  const employee = employees.find((e) => e.id === employeeId);

  const items = useMemo<OrderWithCheck[]>(() => {
    if (!employee || !orders) return [];
    const user = findUserForEmployee(employee, users);
    const own = ordersForEmployee(employee, orders, user);
    return own
      .map((order) => {
        const fraction = shareFraction(order, employee.userId);
        return {
          order,
          check: checkOrderTip(order),
          fraction,
          commission: calcularComision(
            (order.comisionBase ?? 0) * fraction,
            nomina,
          ),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.order.createdAt ?? 0).getTime() -
          new Date(a.order.createdAt ?? 0).getTime(),
      );
  }, [employee, orders, users, nomina]);

  const totals = useMemo(() => {
    const consumo = items.reduce((s, i) => s + (i.order.subtotal ?? 0), 0);
    const servicio = items.reduce(
      (s, i) => s + (i.order.serviceCharge ?? 0),
      0,
    );
    const comision = items.reduce((s, i) => s + i.commission, 0);
    const propinas = items.reduce(
      (s, i) => s + (i.order.tipAmount ?? 0) * i.fraction,
      0,
    );
    return {
      consumo,
      servicio,
      comision,
      propinas,
      ...summarizeTipChecks(items.map((i) => i.check)),
    };
  }, [items]);

  // Necesita revisión todo lo que se declaró y no se va a pagar: ahí está la
  // plata en juego. Más los comprobantes que contradicen lo tecleado.
  const visible = onlyIssues
    ? items.filter(
        (i) =>
          i.check.declaredTipUsd - i.check.payableTipUsd > 0.01 ||
          i.check.ocrAmount === 'MISMATCH',
      )
    : items;

  if (loadingEmp || orders === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen p-6">
        <Link href="/private/payroll" className="text-accent text-sm">
          ← Volver a nómina
        </Link>
        <p className="text-dim mt-4">Empleado no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        <Link
          href="/private/payroll"
          className="inline-flex items-center gap-1.5 text-sm text-dim hover:text-content"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a nómina
        </Link>

        <div className="bg-surface/90 rounded-xl border border-line/50 p-4 space-y-3">
          <div>
            <h1 className="text-lg font-bold text-content">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-xs text-dim">
              {items.length} orden(es) con comisión pendiente
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-dim uppercase">Consumo</p>
              <p className="font-semibold text-content">
                {formatUSD(totals.consumo)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-dim uppercase">
                {servicio ?? 'Servicio'}
              </p>
              <p className="font-semibold text-content">
                {formatUSD(totals.servicio)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-dim uppercase">
                Comisión {porcentaje(nomina.commissionRate)}
              </p>
              <p className="font-semibold text-ok">
                +{formatUSD(totals.comision)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-dim uppercase">Propina a pagar</p>
              <p className="font-semibold text-ok">
                +{formatUSD(totals.payableUsd)}
              </p>
              {Math.abs(totals.declaredUsd - totals.payableUsd) > 0.01 && (
                <p className="text-[10px] text-dim">
                  declaró {formatUSD(totals.declaredUsd)}
                </p>
              )}
            </div>
          </div>

          {/* De dónde sale la propina a pagar */}
          <div className="rounded-lg bg-elevated/40 px-3 py-2 text-xs space-y-1">
            <p className="font-semibold text-content">
              Respaldo de la propina · {formatUSD(totals.payableUsd)}
            </p>
            <div className="flex justify-between">
              <span className="text-dim">Confirmada por comprobante</span>
              <span className="text-ok font-medium">
                {formatUSD(totals.payableConfirmedUsd)}
              </span>
            </div>
            {totals.payableDisputedUsd > 0 && (
              <div className="flex justify-between">
                <span className="text-dim">
                  Topada por lo que dice el comprobante
                </span>
                <span className="text-accent font-medium">
                  {formatUSD(totals.payableDisputedUsd)}
                </span>
              </div>
            )}
            {totals.declaredUsd - totals.payableUsd > 0.01 && (
              <div className="flex justify-between border-t border-line/50 pt-1">
                <span className="text-accent">
                  Declarada sin respaldo — no se paga
                </span>
                <span className="text-accent font-medium">
                  −{formatUSD(totals.declaredUsd - totals.payableUsd)}
                </span>
              </div>
            )}
          </div>

          {(totals.overDeclared > 0 ||
            totals.unverifiable > 0 ||
            totals.ocrMismatch > 0) && (
            <div className="rounded-lg bg-accent/10 border border-accent/30 px-3 py-2 text-xs text-content space-y-0.5">
              <p className="flex items-center gap-1.5 font-semibold text-accent">
                <AlertTriangle className="h-3.5 w-3.5" />
                Revisar
              </p>
              {totals.overDeclared > 0 && (
                <p>
                  {totals.overDeclared} orden(es) con propina declarada de más ·{' '}
                  {formatUSD(totals.overDeclaredUsd)}
                </p>
              )}
              {totals.unverifiable > 0 && (
                <p>
                  {totals.unverifiable} propina(s) sin comprobante ·{' '}
                  {formatUSD(totals.unverifiableUsd)}
                </p>
              )}
              {totals.ocrMismatch > 0 && (
                <p>
                  {totals.ocrMismatch} comprobante(s) cuyo monto no coincide con
                  lo tecleado
                </p>
              )}
              {totals.incomplete > 0 && (
                <p className="text-dim">
                  {totals.incomplete} pago(s) mixtos que no se pueden cotejar
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-dim cursor-pointer">
            <input
              type="checkbox"
              checked={onlyIssues}
              onChange={(e) => setOnlyIssues(e.target.checked)}
            />
            Ver solo las que necesitan revisión
          </label>
        </div>

        <div className="space-y-2.5">
          {visible.length === 0 ? (
            <p className="text-sm text-dim text-center py-8">
              {onlyIssues
                ? 'Ninguna orden necesita revisión.'
                : 'Sin órdenes con comisión pendiente.'}
            </p>
          ) : (
            visible.map((item) => (
              <OrderCard
                key={item.order.id}
                item={item}
                nomina={nomina}
                servicio={servicio}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

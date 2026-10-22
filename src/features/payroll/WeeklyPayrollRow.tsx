'use client';
import { useState, useRef } from 'react';
import { Employee } from '@odin6/types';
import { NominaConfig, Payroll } from '@odin6/types';
import {
  InvoiceStatusEnum,
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
} from '@/shared';
import { useSession } from 'next-auth/react';
import { useCreatePayroll } from '@/hooks/usePayroll';
import { useCreatePayment } from '@/hooks/usePayments';
import { useUpdateAccountsReceivable } from '@/hooks/useAccountsReceivable';
import {
  getOrGenerateClientRequestId,
  clearClientRequestId,
} from '@/shared/utils/clientRequestIdManager';
import { api } from '@/services/api/apiClient';
import { CheckCircle2 } from 'lucide-react';
import { AccountReceivable } from '@odin6/types';
import { WaiterShare } from '@odin6/types';
import { rowNet, payrollSettlement, grossPay, finalNet } from './payrollCalc';
import { PayrollReceiptModal } from './PayrollReceipt';
import { useEmployeeEarnings } from './hooks/useEmployeeEarnings';
import { useEmployeeConsumptions } from './hooks/useEmployeeConsumptions';
import {
  usePayrollAdjustments,
  useBonoPizzeroPrecarga,
} from './hooks/usePayrollAdjustments';
import { useLoanPayments } from './hooks/useLoanPayments';
import { useExternalAccounts } from './hooks/useExternalAccounts';
import { PayrollRowCompact } from './components/PayrollRowCompact';
import { PayrollConfirmModal } from './components/PayrollConfirmModal';
import { formatUSD, formatBs } from './utils/formatters';

interface WaiterOrder {
  id: string;
  serviceCharge?: number;
  tipAmount?: number;
  createdAt?: string | Date;
  waiterShares?: WaiterShare[];
}

export interface PaidBreakdown {
  earnings: number;
  commissions: number;
  tips: number;
  consumos: number;
  net: number;
}

interface WeeklyPayrollRowProps {
  employee: Employee;
  isWaiter: boolean;
  waiterOrders: WaiterOrder[];
  defaultDays: number;
  nomina: NominaConfig;
  weekStart: Date;
  weekEnd: Date;
  bcvRate: number;
  paidAmount: number;
  onPaid: (employeeId: string, net: number, breakdown: PaidBreakdown) => void;
  alreadyPaid: boolean;
  weekPayroll?: Payroll;
  bonoPizzero?: { total: number; resumen: string } | null;
  diasAsistencia?: number | null;
  semanaAsistencia?: string;
  customerIds: readonly string[];
}

export default function WeeklyPayrollRow({
  employee,
  isWaiter,
  waiterOrders,
  defaultDays,
  nomina,
  weekStart,
  weekEnd,
  bcvRate,
  paidAmount,
  onPaid,
  alreadyPaid,
  weekPayroll,
  bonoPizzero,
  diasAsistencia,
  semanaAsistencia,
  customerIds,
}: WeeklyPayrollRowProps) {
  const { data: session } = useSession();
  const fullName = `${employee.firstName} ${employee.lastName}`;

  // Hooks
  const earnings = useEmployeeEarnings(
    employee,
    isWaiter,
    waiterOrders,
    defaultDays,
    nomina,
  );
  const consumptions = useEmployeeConsumptions(
    employee.id,
    employee.customerId,
    customerIds,
    nomina,
  );
  const adjustmentsState = usePayrollAdjustments(bcvRate);
  const loans = useLoanPayments(employee.id);
  const externalAR = useExternalAccounts(employee.customerId);

  useBonoPizzeroPrecarga(
    bonoPizzero,
    alreadyPaid,
    adjustmentsState.adjustments,
    (adj) => adjustmentsState.setAdjustments?.(adj),
  );

  // State
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const paymentRequestIdRef = useRef<string | undefined>(undefined);

  const createPayroll = useCreatePayroll();
  const updateAR = useUpdateAccountsReceivable();
  const createPayment = useCreatePayment();

  // Calculations
  const netUSD = rowNet({
    earnings: earnings.earnings,
    commissions: earnings.commissions,
    tips: earnings.tips,
    consumos: consumptions.consumosTotal,
  });

  const adjustmentsAdd = adjustmentsState.adjustments
    .filter((a) => a.type === 'ADDITION')
    .reduce((s, a) => s + a.amountUsd, 0);
  const adjustmentsDed = adjustmentsState.adjustments
    .filter((a) => a.type === 'DEDUCTION')
    .reduce((s, a) => s + a.amountUsd, 0);

  const grossUSD = grossPay({
    earnings: earnings.earnings,
    commissions: earnings.commissions,
    tips: earnings.tips,
    adjustmentsAdd,
  });

  // Lo que se le retiene por abonos a prestamos. Sale de la MISMA fuente que
  // la linea que se dibuja en el resumen (`loanAbonoMap` via
  // `loanAdjustments`), para que pantalla y total no puedan decir cosas
  // distintas — que es justo lo que pasaba: la linea mostraba −$20 y el neto
  // no los restaba.
  const loansTotal = loans.loanAdjustments.reduce((s, a) => s + a.amountUsd, 0);

  const finalNetUSD = finalNet({
    net: netUSD,
    adjustmentsAdd,
    adjustmentsDed,
    externalTotal: externalAR.externalTotal,
    loansTotal,
  });

  const effectiveAdjustments = [
    ...loans.loanAdjustments,
    ...adjustmentsState.adjustments,
    ...(adjustmentsState.draftAdjustment
      ? [adjustmentsState.draftAdjustment]
      : []),
  ];

  // Accept proof from file or clipboard
  const aceptarComprobante = (file: File) => {
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Main payment handler
  const handlePay = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      // Generar clientRequestId una sola vez (estable en reintentos)
      if (!paymentRequestIdRef.current) {
        paymentRequestIdRef.current = getOrGenerateClientRequestId(
          `payroll:${employee.id}:${weekStart.getTime()}`,
        );
      }

      let proofUrl: string | undefined;
      if (proofFile && proofPreview) {
        const ext = proofFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const res = await api.post<{ url: string }>('/api/uploads/image', {
          category: 'payroll-proofs',
          subPath: employee.id,
          imageBase64: proofPreview,
          extension: ext,
        });
        proofUrl = res.url;
      }

      const selectedAR = consumptions.pendingAR.filter((ar) =>
        consumptions.selectedARIds.has(ar.id),
      );
      const expenseDeductions = [
        ...selectedAR.map((ar) => ({
          accountReceivableId: ar.id,
          amount: consumptions.cobroFor(ar),
          description: ar.description ?? ar.invoiceNumber,
        })),
        ...externalAR.externalAR.map((ar) => ({
          accountReceivableId: ar.id,
          amount: externalAR.externalPendingOf(ar),
          description: `Asumida de ${ar.customerName}: ${ar.description ?? ar.invoiceNumber}`,
        })),
      ];

      const createdPayroll = await createPayroll.mutateAsync({
        employeeId: employee.id,
        period: {
          startDate: weekStart,
          endDate: weekEnd,
          month: weekStart.getMonth() + 1,
          year: weekStart.getFullYear(),
        },
        salary: {
          baseSalary: earnings.earnings,
          overtime: 0,
          bonuses: Math.round(adjustmentsAdd * 100) / 100,
          commissions: Math.round(earnings.commissions * 100) / 100,
        },
        deductions: {
          taxes: 0,
          socialSecurity: 0,
          insurance: 0,
          // `loansTotal` va aca por lo mismo que en `finalNet`: el abono se
          // retiene de verdad, asi que tiene que figurar como deduccion en la
          // ficha. Sin el, la ficha decia que se dedujo menos de lo que se
          // dedujo y no cuadraba contra el neto pagado.
          other:
            Math.round(
              (consumptions.consumosTotal +
                adjustmentsDed +
                externalAR.externalTotal +
                loansTotal) *
                100,
            ) / 100,
        },
        grossPay: grossUSD,
        netPay: finalNetUSD,
        status: 'paid',
        paymentDate: new Date(),
        proofUrl,
        expenseDeductions,
        adjustments: effectiveAdjustments,
        daysWorked: earnings.daysWorked,
        dailyRate: earnings.dailyRate,
        tips: Math.round(earnings.tips * 100) / 100,
        kind: isWaiter ? 'WAITER' : 'STAFF',
        paidOrderIds: isWaiter ? waiterOrders.map((o) => o.id) : [],
      } as Partial<Payroll>);

      // Mark commissions as paid
      if (isWaiter && waiterOrders.length > 0) {
        await api.post('/api/orders/commission/mark-paid', {
          orderIds: waiterOrders.map((o) => o.id),
          waiterId: employee.userId,
        });
      }

      // Apply discounts to AR accounts
      const aplicarDescuento = async (
        ar: AccountReceivable,
        abono: number,
        extra?: { description?: string },
        target?: number,
      ) => {
        const {
          paidAmount: nuevoPagado,
          isSettled,
          applied,
        } = payrollSettlement(ar, abono, target);

        const cierraConsumoPersonal =
          isSettled && target != null && nuevoPagado < ar.amount - 0.01;

        await updateAR.mutateAsync({
          id: ar.id,
          data: {
            paidAmount: nuevoPagado,
            status: isSettled
              ? InvoiceStatusEnum.PAID
              : InvoiceStatusEnum.PARTIALLY_PAID,
            settlementSource: 'PAYROLL',
            ...(cierraConsumoPersonal ? { amount: nuevoPagado } : {}),
            ...(createdPayroll?.id
              ? { settlementPayrollId: createdPayroll.id }
              : {}),
            ...(extra?.description ? { description: extra.description } : {}),
          },
        });

        if (applied > 0.001) {
          await createPayment.mutateAsync({
            orderId: ar.orderId ?? ar.id,
            amount: applied,
            method: PaymentMethodEnum.PAYROLL_DEDUCTION,
            status: PaymentStatusEnum.PAID,
            notes: `Descuento de nómina de ${fullName}${createdPayroll?.id ? ` (nómina ${createdPayroll.id})` : ''} — cuenta ${ar.id}`,
            userId: session?.user?.id ?? 'unknown',
            // Una llave por cuenta: el servidor deduplica por la llave sola y
            // compartirla haria pasar el 2do descuento por duplicado.
            clientRequestId: paymentRequestIdRef.current
              ? `${paymentRequestIdRef.current}-${ar.id}`
              : undefined,
          });
        }
      };

      for (const ar of selectedAR) {
        await aplicarDescuento(
          ar,
          consumptions.cobroFor(ar),
          undefined,
          consumptions.staffTargetFor(ar),
        );
      }

      const payDateStr = new Date().toLocaleDateString('es-VE');
      for (const ar of externalAR.externalAR) {
        await aplicarDescuento(ar, externalAR.externalPendingOf(ar), {
          description: `${ar.description ?? ar.invoiceNumber} — Asumida y descontada en nómina de ${fullName} (${payDateStr})`,
        });
      }

      for (const loan of loans.selectedLoans) {
        const abonoAmount = loans.loanAbonoMap.get(loan.id) ?? 0;
        if (abonoAmount > 0) {
          await loans.abonoLoan.mutateAsync({
            id: loan.id,
            data: {
              amount: abonoAmount,
              payrollId: createdPayroll?.id,
            },
          });
        }
      }

      // Mark orders as paid if AR was settled
      const quedoSaldada = (ar: AccountReceivable, abono: number) =>
        payrollSettlement(ar, abono).isSettled;
      const settledOrderIds = [
        ...selectedAR.filter((ar) =>
          quedoSaldada(ar, consumptions.cobroFor(ar)),
        ),
        ...externalAR.externalAR.filter((ar) =>
          quedoSaldada(ar, externalAR.externalPendingOf(ar)),
        ),
      ].flatMap((ar) => [
        ...(ar.orderId ? [ar.orderId] : []),
        ...((ar.mergedOrderIds as string[] | undefined) ?? []),
      ]);

      for (const oid of settledOrderIds) {
        try {
          await api.patch(`/api/orders/${oid}`, {
            paymentStatus: PaymentStatusEnum.PAID,
            status: OrderStatusEnum.PAID,
          });
        } catch {
          // Silent fail
        }
      }

      onPaid(employee.id, finalNetUSD, {
        earnings: earnings.earnings,
        commissions: earnings.commissions,
        tips: earnings.tips,
        consumos: consumptions.consumosTotal,
        net: finalNetUSD,
      });
      // Limpiar clientRequestId tras éxito
      clearClientRequestId(`payroll:${employee.id}:${weekStart.getTime()}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error al procesar el pago';
      setError(msg);
      // NO limpiar el ID en error: permitir reintentos con el mismo ID
    } finally {
      setIsProcessing(false);
    }
  };

  // Already paid UI
  if (alreadyPaid) {
    return (
      <>
        <tr className="border-b border-line/30 bg-ok/5">
          <td className="px-4 py-3">
            <p className="font-medium text-sm text-content">{fullName}</p>
            <p className="text-xs text-dim">{employee.position}</p>
          </td>
          <td className="px-4 py-3 text-sm text-dim">{employee.department}</td>
          <td className="px-4 py-3" colSpan={6}>
            <span className="inline-flex items-center gap-2 text-xs text-ok font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Pagado esta semana
              {paidAmount > 0 && (
                <span className="text-sm font-bold text-content">
                  {formatUSD(paidAmount)}
                  <span className="text-[10px] text-dim font-normal ml-1">
                    ({formatBs(paidAmount, bcvRate)})
                  </span>
                </span>
              )}
              {weekPayroll && (
                <button
                  onClick={() => setShowReceipt(true)}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 underline underline-offset-2 transition-colors"
                  title="Ver recibo con el desglose completo"
                >
                  Ver recibo
                </button>
              )}
            </span>
          </td>
        </tr>
        {showReceipt && weekPayroll && (
          <PayrollReceiptModal
            payroll={weekPayroll}
            nombre={fullName}
            onClose={() => setShowReceipt(false)}
          />
        )}
      </>
    );
  }

  // Unpaid row with modal
  return (
    <>
      <PayrollRowCompact
        employee={employee}
        isWaiter={isWaiter}
        daysWorked={earnings.daysWorked}
        onDaysChange={earnings.setDaysWorked}
        dailyRate={earnings.dailyRate}
        isWaiterEditable={isWaiter}
        onWaiterRateChange={earnings.setWaiterRate}
        waiterRate={earnings.waiterRate}
        earnings={earnings.earnings}
        commissions={earnings.commissions}
        tips={earnings.tips}
        waiterOrdersLength={waiterOrders.length}
        consumos={{
          pendingAR: consumptions.pendingAR,
          selectedARIds: consumptions.selectedARIds,
          onToggleAR: consumptions.toggleAR,
          consumoNetFor: consumptions.consumoNetFor,
          staffPendingOf: consumptions.staffPendingOf,
          cobroFor: consumptions.cobroFor,
          onCobroChange: consumptions.setArCobro,
        }}
        finalNetUSD={finalNetUSD}
        bcvRate={bcvRate}
        adjustmentsCount={
          adjustmentsState.adjustments.length + externalAR.externalAR.length
        }
        externalARCount={externalAR.externalAR.length}
        proofPreview={proofPreview}
        onProofSelect={aceptarComprobante}
        onProofRemove={() => {
          setProofFile(null);
          setProofPreview(null);
        }}
        onPayClick={() => setShowConfirm(true)}
        isProcessing={isProcessing}
        error={error}
        diasAsistencia={diasAsistencia}
        semanaAsistencia={semanaAsistencia}
      />
      <PayrollConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        employeeName={fullName}
        state={{
          daysWorked: earnings.daysWorked,
          dailyRate: earnings.dailyRate,
          earnings: earnings.earnings,
          commissions: earnings.commissions,
          tips: earnings.tips,
          consumosSeleccionados: consumptions.pendingAR
            .filter((ar) => consumptions.selectedARIds.has(ar.id))
            .map((ar) => ({
              id: ar.id,
              concepto: ar.description ?? ar.invoiceNumber,
              monto: consumptions.cobroFor(ar),
            })),
          finalNetUSD,
          grossUSD,
          adjustments: adjustmentsState.adjustments,
          effectiveAdjustments,
          draftAdjustment: adjustmentsState.draftAdjustment,
          selectedLoans: loans.selectedLoans,
          loanAbonoMap: loans.loanAbonoMap,
          externalAR: externalAR.externalAR,
          externalPendingOf: externalAR.externalPendingOf,
          externalTotal: externalAR.externalTotal,
          pendingLoans: loans.pendingLoans,
          proofFile,
          proofPreview,
        }}
        bcvRate={bcvRate}
        adjType={adjustmentsState.adjType}
        onAdjTypeChange={adjustmentsState.setAdjType}
        adjConcept={adjustmentsState.adjConcept}
        onAdjConceptChange={adjustmentsState.setAdjConcept}
        adjAmount={adjustmentsState.adjAmount}
        onAdjAmountChange={adjustmentsState.setAdjAmount}
        adjCurrency={adjustmentsState.adjCurrency}
        onAdjCurrencyChange={adjustmentsState.setAdjCurrency}
        draftUsd={adjustmentsState.draftUsd}
        draftMissingConcept={adjustmentsState.draftMissingConcept}
        onAddAdjustment={adjustmentsState.addAdjustment}
        onRemoveAdjustment={adjustmentsState.removeAdjustment}
        isAddAdjDisabled={
          !adjustmentsState.adjConcept.trim() ||
          !(parseFloat(adjustmentsState.adjAmount) > 0)
        }
        loanAbonoMap={loans.loanAbonoMap}
        onLoanAbonoChange={(loanId, amount) => {
          if (amount < 0) {
            const next = new Map(loans.loanAbonoMap);
            next.delete(loanId);
            loans.setLoanAbonoMap(next);
          } else {
            const next = new Map(loans.loanAbonoMap);
            next.set(loanId, amount);
            loans.setLoanAbonoMap(next);
          }
        }}
        externalARState={{
          showLinkAR: externalAR.showLinkAR,
          onShowLinkARChange: externalAR.setShowLinkAR,
          arSearch: externalAR.arSearch,
          onArSearchChange: externalAR.setArSearch,
          externalCandidates: externalAR.externalCandidates,
          onLinkAR: externalAR.linkExternalAR,
          onUnlinkAR: externalAR.unlinkExternalAR,
          externalItems: externalAR.externalItems,
        }}
        proofFile={proofFile}
        proofPreview={proofPreview}
        onProofAccept={aceptarComprobante}
        onProofRemove={() => {
          setProofFile(null);
          setProofPreview(null);
        }}
        isProcessing={isProcessing}
        onConfirmPay={() => {
          setShowConfirm(false);
          void handlePay();
        }}
      />
    </>
  );
}

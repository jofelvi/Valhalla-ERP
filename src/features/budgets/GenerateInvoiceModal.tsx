'use client';
import Modal from '@/components/shared/modal';
import { useTarifas } from '@/shared/config';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { Budget } from '@odin6/types';
import { Invoice } from '@odin6/types';
import {
  CUSTOMER_TYPES,
  PAYMENT_CONDITIONS,
} from '@/shared/constants/facturaFiscal';
import {
  CurrencyEnum,
  InvoiceStatusEnum,
  PaymentTypeEnum,
  PRIVATE_ROUTES,
} from '@/shared';
import { api } from '@/services/api/apiClient';
import { useCreateInvoice } from '@/hooks/useInvoices';
import { useUpdateBudget } from '@/hooks/useBudgets';
import { useUpdateCustomer } from '@/hooks/useCustomers';
import { useCreateAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { useToast } from '@/components/hooks/useToast';
import { formatearUsd } from '@/shared/utils/dinero';

interface Props {
  budget: Budget;
  customerId?: string | null;
  customerInitial?: {
    rif?: string | null;
    address?: string | null;
    email?: string | null;
  };
  onClose: () => void;
  onGenerated?: (invoice: Invoice) => void;
}

export default function GenerateInvoiceModal({
  budget,
  customerId,
  customerInitial,
  onClose,
  onGenerated,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const createInvoice = useCreateInvoice();
  const updateBudget = useUpdateBudget();
  const updateCustomer = useUpdateCustomer();
  const createAR = useCreateAccountsReceivable();

  // Datos del cliente
  const [razonSocial, setRazonSocial] = useState(budget.customerName ?? '');
  const [idType, setIdType] = useState(budget.customerIdType ?? 'V');
  const [rif, setRif] = useState(
    budget.customerRif ?? customerInitial?.rif ?? '',
  );
  const [address, setAddress] = useState(
    budget.customerAddress ?? customerInitial?.address ?? '',
  );
  const [phone] = useState(budget.customerPhone ?? '');
  const [email, setEmail] = useState(
    budget.customerEmail ?? customerInitial?.email ?? '',
  );
  const [customerType, setCustomerType] = useState(
    budget.customerType ?? 'no_contribuyente',
  );

  // Datos fiscales de la factura
  const [controlNumber, setControlNumber] = useState('');
  const [loadingControl, setLoadingControl] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [issueDate, setIssueDate] = useState(today);
  const [paymentCondition, setPaymentCondition] = useState('contado');
  const [discount, setDiscount] = useState(0);
  // Tasa de impuesto inicial según la configuración (0 si el impuesto está apagado). Editable.
  const tarifas = useTarifas();
  const [taxRate, setTaxRate] = useState(
    tarifas.tax.enabled ? tarifas.tax.rate * 100 : 0,
  );
  const [observations, setObservations] = useState('');
  const [updateCustomerData, setUpdateCustomerData] = useState(true);
  const [createReceivable, setCreateReceivable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pedir el siguiente número de control al abrir el modal
  useEffect(() => {
    let cancelled = false;
    const loadNextControl = async () => {
      setLoadingControl(true);
      try {
        const res = await api.get<{ controlNumber: string; seq: number }>(
          '/api/invoices/next-control-number',
        );
        if (!cancelled && res?.controlNumber) {
          setControlNumber(res.controlNumber);
        }
      } catch (err) {
        console.warn('[GenerateInvoice] no se pudo obtener control:', err);
        if (!cancelled) {
          setControlNumber('00-00000001');
        }
      } finally {
        if (!cancelled) setLoadingControl(false);
      }
    };
    void loadNextControl();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cálculos
  const subtotal = budget.subtotal ?? 0;
  const subtotalConDescuento = Math.max(0, subtotal - (discount || 0));
  const taxAmount = +(subtotalConDescuento * (taxRate / 100)).toFixed(2);
  const total = +(subtotalConDescuento + taxAmount).toFixed(2);

  // Vencimiento auto-calculado según condición de pago
  const computeDueDate = (issue: string, condition: string): string => {
    const d = PAYMENT_CONDITIONS.find((c) => c.value === condition);
    if (!d) return issue;
    const dt = new Date(`${issue}T12:00:00.000Z`);
    dt.setDate(dt.getDate() + d.days);
    return dt.toISOString().slice(0, 10);
  };
  const dueDate = computeDueDate(issueDate, paymentCondition);

  const handleGenerate = async () => {
    setError(null);

    if (!razonSocial.trim()) {
      setError('La razón social es obligatoria.');
      return;
    }
    if (!rif.trim()) {
      setError('El RIF / cédula es obligatorio para una factura fiscal.');
      return;
    }
    if (!address.trim()) {
      setError('La dirección fiscal es obligatoria.');
      return;
    }
    if (!controlNumber.trim()) {
      setError('Falta el número de control fiscal.');
      return;
    }

    setIsSaving(true);
    try {
      const invoiceNumber = `FAC-${Date.now().toString().slice(-8)}-${budget.id ? String(budget.id).slice(-4).toUpperCase() : 'EVNT'}`;

      const invoiceData: Partial<Invoice> = {
        invoiceNumber,
        controlNumber: controlNumber.trim(),
        ...(customerId ? { customerId } : {}),
        customerName: razonSocial.trim(),
        customerRif: `${idType}-${rif.trim()}`,
        customerIdType: idType,
        customerAddress: address.trim(),
        customerPhone: phone || undefined,
        customerEmail: email.trim() || undefined,
        customerType,
        paymentCondition,
        issueDate: new Date(`${issueDate}T12:00:00.000Z`),
        dueDate: new Date(`${dueDate}T12:00:00.000Z`),
        observations: observations.trim() || undefined,
        discount: discount || 0,
        subtotal,
        serviceCharge: 0,
        tax: taxAmount,
        total,
        totalAmount: total,
        paymentType: PaymentTypeEnum.CASH,
        currency: CurrencyEnum.USD,
        status: InvoiceStatusEnum.PENDING,
        budgetId: budget.id,
        items: budget.items?.map((item) => ({
          productId: item.productId,
          name: item.name,
          description: item.description ?? item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
        notes: `Factura fiscal generada desde presupuesto ${budget.budgetNumber}`,
        createdAt: new Date(),
      };

      const invoice = await createInvoice.mutateAsync(invoiceData);

      // Cuenta por cobrar
      if (createReceivable) {
        try {
          await createAR.mutateAsync({
            ...(customerId && { customerId }),
            customerName: razonSocial.trim(),
            invoiceNumber,
            description: `Factura fiscal ${invoiceNumber} - ${budget.eventName}`,
            amount: total,
            paidAmount: 0,
            status: InvoiceStatusEnum.PENDING,
            dueDate: new Date(`${dueDate}T12:00:00.000Z`),
          });
        } catch (err) {
          console.warn('[GenerateInvoice] AR fallo (no bloqueante):', err);
        }
      }

      // Actualizar customer
      if (updateCustomerData && customerId) {
        try {
          await updateCustomer.mutateAsync({
            id: customerId,
            data: {
              rif: `${idType}-${rif.trim()}`,
              ...(address.trim() && { address: address.trim() }),
              ...(email.trim() && { email: email.trim() }),
            },
          });
        } catch (err) {
          console.warn('[GenerateInvoice] update customer fallo:', err);
        }
      }

      // Linkear invoice al budget + persistir datos fiscales
      try {
        await updateBudget.mutateAsync({
          id: budget.id,
          data: {
            invoiceId: invoice.id,
            // Persistir tambien los datos fiscales en el budget (para reusar)
            customerRif: `${idType}-${rif.trim()}`,
            customerIdType: idType,
            customerAddress: address.trim(),
            customerType,
          },
        });
      } catch (err) {
        console.warn('[GenerateInvoice] linkear budget fallo:', err);
      }

      toast.success({
        title: 'Factura generada',
        description: `${invoiceNumber} (control ${controlNumber}) creada por ${formatearUsd(total)}`,
      });

      onGenerated?.(invoice);

      router.push(PRIVATE_ROUTES.INVOICES_DETAILS(invoice.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      toast.error({
        title: 'No se pudo generar la factura',
        description: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/60 backdrop-blur-sm"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-line">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand" />
          <h2 className="text-lg font-bold text-content">
            Generar Factura Fiscal
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="p-1 hover:bg-elevated rounded text-dim hover:text-content"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Datos del cliente */}
        <div>
          <h3 className="text-sm font-semibold text-content mb-2">
            Datos fiscales del cliente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-dim block mb-1">
                Razón social / Nombre <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-elevated border border-line rounded-lg text-content focus:border-brand focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-dim block mb-1">Tipo</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full px-2 py-2 text-sm bg-elevated border border-line rounded-lg text-content focus:border-brand focus:outline-none"
                >
                  {['V', 'E', 'J', 'G', 'P'].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-dim block mb-1">
                  RIF / Cédula <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={rif}
                  onChange={(e) => setRif(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-elevated border border-line rounded-lg text-content focus:border-brand focus:outline-none"
                  placeholder="12345678 o 40123456-7"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-dim block mb-1">
                Tipo de cliente (SENIAT)
              </label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-elevated border border-line rounded-lg text-content focus:border-brand focus:outline-none"
              >
                {CUSTOMER_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-dim block mb-1">
                Dirección fiscal <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-elevated border border-line rounded-lg text-content focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-dim block mb-1">Teléfono</label>
              <input
                type="text"
                value={phone}
                readOnly
                className="w-full px-3 py-2 text-sm bg-elevated/40 border border-line rounded-lg text-dim"
              />
            </div>
            <div>
              <label className="text-xs text-dim block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-elevated border border-line rounded-lg text-content focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Datos fiscales de la factura */}
        <div>
          <h3 className="text-sm font-semibold text-content mb-2">
            Datos de la factura
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-dim block mb-1">
                N° de control fiscal <span className="text-danger">*</span>
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={controlNumber}
                  onChange={(e) => setControlNumber(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-elevated border border-line rounded-lg text-content font-mono focus:border-brand focus:outline-none"
                  placeholder={loadingControl ? 'Cargando...' : '00-00000001'}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-dim block mb-1">
                Fecha de emisión
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-elevated border border-line rounded-lg text-content focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-dim block mb-1">
                Forma / condición de pago
              </label>
              <select
                value={paymentCondition}
                onChange={(e) => setPaymentCondition(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-elevated border border-line rounded-lg text-content focus:border-brand focus:outline-none"
              >
                {PAYMENT_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-dim block mb-1">Vencimiento</label>
              <input
                type="date"
                value={dueDate}
                readOnly
                className="w-full px-3 py-2 text-sm bg-elevated/40 border border-line rounded-lg text-dim cursor-not-allowed"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-dim block mb-1">
                Observaciones
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm bg-elevated border border-line rounded-lg text-content focus:border-brand focus:outline-none resize-none"
                placeholder="Notas adicionales (opcional)"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div>
          <h3 className="text-sm font-semibold text-content mb-2">
            Items del presupuesto ({budget.items?.length ?? 0})
          </h3>
          <div className="bg-elevated/40 border border-line rounded-lg overflow-hidden">
            {(budget.items ?? []).map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 text-xs border-b border-line last:border-0"
              >
                <div className="flex-1">
                  <div className="text-content">
                    {item.quantity}× {item.name}
                  </div>
                  <div className="text-dim">
                    ${item.unitPrice.toFixed(2)} c/u
                  </div>
                </div>
                <div className="font-semibold text-content">
                  ${(item.quantity * item.unitPrice).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cálculos */}
        <div>
          <h3 className="text-sm font-semibold text-content mb-2">Cálculos</h3>
          <div className="bg-elevated/40 border border-line rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-dim">Subtotal:</span>
              <span className="text-content font-mono">
                {formatearUsd(subtotal)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm gap-2">
              <span className="text-dim">Descuento:</span>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                min={0}
                step={0.01}
                className="w-24 px-2 py-1 text-sm text-right bg-surface border border-line rounded font-mono"
              />
            </div>
            <div className="flex justify-between items-center text-sm gap-2">
              <span className="text-dim">{tarifas.tax.label} (%):</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-16 px-2 py-1 text-sm text-right bg-surface border border-line rounded"
                />
                <span className="font-mono text-content w-20 text-right">
                  {formatearUsd(taxAmount)}
                </span>
              </div>
            </div>
            <div className="border-t border-line pt-1.5 flex justify-between text-base font-bold">
              <span className="text-content">TOTAL:</span>
              <span className="text-brand font-mono">
                {formatearUsd(total)}
              </span>
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={createReceivable}
              onChange={(e) => setCreateReceivable(e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <span className="text-content">
              Crear cuenta por cobrar (recomendado para trackear el cobro)
            </span>
          </label>
          {customerId && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={updateCustomerData}
                onChange={(e) => setUpdateCustomerData(e.target.checked)}
                className="w-4 h-4 accent-brand"
              />
              <span className="text-content">
                Guardar RIF / dirección / email en el cliente
              </span>
            </label>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg p-2">
            <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 p-4 border-t border-line">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={isSaving}
          className="min-w-[160px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Generando...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Generar Factura
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}

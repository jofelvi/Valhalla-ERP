import { PaymentMethodEnum } from '@/shared/types/enumShared';
import { VENEZUELAN_BANKS } from '@/shared/constants/banks';
import { usePagoMovilDestino } from '@/shared/hooks/usePagoMovilDestino';
import { formatearUsdConMiles } from '@/shared/utils/dinero';

const paymentMethodLabels: Record<PaymentMethodEnum, string> = {
  [PaymentMethodEnum.CASH_USD]: 'Efectivo USD',
  [PaymentMethodEnum.CASH_BS]: 'Efectivo Bs',
  [PaymentMethodEnum.TRANSFER]: 'Transferencia',
  [PaymentMethodEnum.PAGO_MOVIL]: 'Pago Movil',
  [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: 'Pago Movil Manual',
  [PaymentMethodEnum.CARD]: 'Tarjeta',
  [PaymentMethodEnum.MIXED]: 'Mixto',
  [PaymentMethodEnum.PENDING]: 'Pendiente',
  [PaymentMethodEnum.PAYROLL_DEDUCTION]: 'Descuento de Nómina',
};

interface PaymentFormFieldsProps {
  method: PaymentMethodEnum;
  onMethodChange: (method: PaymentMethodEnum) => void;
  amountUsd: string;
  onAmountUsdChange: (value: string) => void;
  amountBs: string;
  onAmountBsChange: (value: string) => void;
  currency: 'USD' | 'BS';
  onCurrencyChange: (currency: 'USD' | 'BS') => void;
  bcvRate: number;
  pendingAmount: number;
  onPayFull: () => void;
  paidAt: string;
  onPaidAtChange: (date: string) => void;
  reference: string;
  onReferenceChange: (ref: string) => void;
  needsReference: boolean;
  destinationAccount: string;
  onDestinationAccountChange: (account: string) => void;
  isPagoMovil: boolean;
  phone: string;
  onPhoneChange: (phone: string) => void;
  cedula: string;
  onCedulaChange: (cedula: string) => void;
  banco: string;
  onBancoChange: (banco: string) => void;
  usesBs: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  reporterName: string;
  onReporterNameChange: (name: string) => void;
  reporterPhone: string;
  onReporterPhoneChange: (phone: string) => void;
}

export function PaymentFormFields({
  method,
  onMethodChange,
  amountUsd,
  onAmountUsdChange,
  amountBs,
  onAmountBsChange,
  currency,
  onCurrencyChange,
  bcvRate,
  pendingAmount,
  onPayFull,
  paidAt,
  onPaidAtChange,
  reference,
  onReferenceChange,
  needsReference,
  destinationAccount,
  onDestinationAccountChange,
  isPagoMovil,
  phone,
  onPhoneChange,
  cedula,
  onCedulaChange,
  banco,
  onBancoChange,
  usesBs,
  notes,
  onNotesChange,
  reporterName,
  onReporterNameChange,
  reporterPhone,
  onReporterPhoneChange,
}: PaymentFormFieldsProps) {
  const PAGO_MOVIL_DESTINO = usePagoMovilDestino() ?? { banco: '', telefono: '', cedula: '' };
  return (
    <>
      {/* Payment method */}
      <div>
        <label className="block text-xs font-semibold text-dim mb-1.5">
          Método de pago *
        </label>
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as PaymentMethodEnum)}
          className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-surface"
          required
        >
          {Object.entries(paymentMethodLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Amount with dual input USD/Bs */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-dim">
            Monto a pagar *
          </label>
          <button
            type="button"
            onClick={onPayFull}
            className="text-[10px] text-brand hover:text-amber-800 font-semibold underline"
          >
            Pagar todo ({formatearUsdConMiles(pendingAmount)})
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim text-sm">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={pendingAmount}
                value={amountUsd}
                onChange={(e) => onAmountUsdChange(e.target.value)}
                className={`w-full border rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                  currency === 'USD'
                    ? 'border-brand ring-2 ring-amber-200'
                    : 'border-line focus:ring-amber-500'
                }`}
                placeholder="0.00"
                required={currency === 'USD'}
                onFocus={() => onCurrencyChange('USD')}
              />
            </div>
            <p className="text-[10px] text-dim mt-0.5 text-center">USD</p>
          </div>
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dim text-sm">
                Bs
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountBs}
                onChange={(e) => onAmountBsChange(e.target.value)}
                disabled={bcvRate <= 0}
                className={`w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:bg-elevated disabled:cursor-not-allowed ${
                  currency === 'BS'
                    ? 'border-brand ring-2 ring-amber-200'
                    : 'border-line focus:ring-amber-500'
                }`}
                placeholder="0.00"
                onFocus={() => onCurrencyChange('BS')}
              />
            </div>
            <p className="text-[10px] text-dim mt-0.5 text-center">Bolívares</p>
          </div>
        </div>
        {usesBs && bcvRate <= 0 && (
          <p className="text-[10px] text-danger mt-1">
            Se requiere la tasa BCV para este metodo de pago
          </p>
        )}
      </div>

      {/* Payment date */}
      <div>
        <label className="block text-xs font-semibold text-dim mb-1.5">
          Fecha del pago *
        </label>
        <input
          type="date"
          value={paidAt}
          onChange={(e) => onPaidAtChange(e.target.value)}
          className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          required
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      {/* Reference number */}
      {needsReference && (
        <div>
          <label className="block text-xs font-semibold text-dim mb-1.5">
            Número de referencia *
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
            placeholder="Ej: 123456789"
          />
          <p className="text-[10px] text-dim mt-0.5">
            La referencia debe ser unica (no haberse usado en otro pago)
          </p>
        </div>
      )}

      {/* Destination account (pago movil only) */}
      {isPagoMovil && (
        <div>
          <label className="block text-xs font-semibold text-dim mb-1.5">
            ¿A que cuenta pagó? *
          </label>
          <select
            value={destinationAccount}
            onChange={(e) => onDestinationAccountChange(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-surface"
            required
          >
            <option value={PAGO_MOVIL_DESTINO.telefono}>
              {PAGO_MOVIL_DESTINO.telefono} — Banco de Venezuela (Principal)
            </option>
          </select>
        </div>
      )}

      {/* Pago movil origin details */}
      {isPagoMovil && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-dim mb-1.5">
              Tu teléfono *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="04XX-XXXXXXX"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-dim mb-1.5">
              Tu cédula
            </label>
            <input
              type="text"
              value={cedula}
              onChange={(e) => onCedulaChange(e.target.value.toUpperCase())}
              className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="V12345678"
            />
          </div>
        </div>
      )}

      {/* Origin bank */}
      {(isPagoMovil ||
        method === PaymentMethodEnum.TRANSFER) && (
        <div>
          <label className="block text-xs font-semibold text-dim mb-1.5">
            Banco origen *
          </label>
          <select
            value={banco}
            onChange={(e) => onBancoChange(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-surface"
            required
          >
            <option value="">Seleccionar banco...</option>
            {VENEZUELAN_BANKS.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.code} - {bank.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-dim mb-1.5">
          Notas (opcional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          placeholder="Información adicional..."
        />
      </div>

      {/* Reporter contact info */}
      <div className="pt-3 border-t border-amber-100">
        <p className="text-xs font-semibold text-dim mb-2">
          Tus datos de contacto
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={reporterName}
            onChange={(e) => onReporterNameChange(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Tu nombre"
          />
          <input
            type="tel"
            value={reporterPhone}
            onChange={(e) => onReporterPhoneChange(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Tu teléfono (WhatsApp)"
          />
        </div>
      </div>
    </>
  );
}

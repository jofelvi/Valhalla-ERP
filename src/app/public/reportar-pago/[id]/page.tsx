'use client';

import { useNegocio, useNombreApp } from '@/shared/config';

import { use } from 'react';
import { DollarSign } from 'lucide-react';
import {
  useAccountData,
  useBcvRate,
  usePaymentForm,
  usePaymentSubmit,
} from './hooks';
import {
  AccountSummary,
  BcvRateDisplay,
  ErrorState,
  FormError,
  LoadingState,
  PagoMovilDetails,
  PaymentFormFields,
  PaidAccountState,
  ProofImageUpload,
  SubmitButton,
  SubmittedState,
} from './components';

export default function ReportPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const nombre = useNombreApp();
  const negocio = useNegocio();
  const { id } = use(params);

  // Data loading
  const { account, loading, error: loadError } = useAccountData(id);
  const { bcvRate, loading: loadingBcv, loadBcvRate } = useBcvRate();

  // Form state
  const form = usePaymentForm(account, bcvRate);

  // Submission logic
  const {
    submitting,
    submitted,
    error: submitError,
    setError: setSubmitError,
    handleSubmit: onSubmit,
  } = usePaymentSubmit();

  // Handle image error display
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const result = form.handleImageChange(e);
    if (result?.error) {
      setSubmitError(result.error);
    }
  };

  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      accountId: id,
      account: account!,
      method: form.method,
      amountUsd: form.amountUsd,
      amountBs: form.amountBs,
      reference: form.reference,
      phone: form.phone,
      cedula: form.cedula,
      banco: form.banco,
      destinationAccount: form.destinationAccount,
      paidAt: form.paidAt,
      notes: form.notes,
      reporterName: form.reporterName,
      reporterPhone: form.reporterPhone,
      imageFile: form.imageFile,
    });
  };

  // ──────────── Loading ────────────
  if (loading) {
    return <LoadingState />;
  }

  // ──────────── Error cargando cuenta ────────────
  if (loadError || !account) {
    return <ErrorState message={loadError} />;
  }

  // ──────────── Cuenta ya pagada ────────────
  if (account.pending <= 0.01) {
    return <PaidAccountState invoiceNumber={account.invoiceNumber} />;
  }

  // ──────────── Reporte enviado ────────────
  if (submitted) {
    return (
      <SubmittedState
        invoiceNumber={account.invoiceNumber}
        amountUsd={form.amountUsd}
        amountBs={form.amountBs}
        method={form.method}
      />
    );
  }

  // ──────────── Formulario ────────────
  return (
    <div className="min-h-screen bg-page py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
            <DollarSign className="w-9 h-9 text-on-brand" />
          </div>
          <h1 className="text-2xl font-bold text-brand">
            Reportar Pago
          </h1>
          <p className="text-dim text-sm mt-1">{nombre}</p>
        </div>

        {/* Account info */}
        <AccountSummary account={account} />

        {/* BCV Rate */}
        <BcvRateDisplay
          bcvRate={bcvRate}
          loading={loadingBcv}
          onRefresh={loadBcvRate}
        />

        {/* Pago Movil details */}
        {form.isPagoMovil && (
          <PagoMovilDetails
            amountBs={form.amountBs}
            amountUsd={form.amountUsd}
            bcvRate={bcvRate}
            copied={form.copied}
            onCopy={form.handleCopy}
          />
        )}

        {/* Form */}
        <form
          onSubmit={handleFormSubmit}
          className="bg-surface/90 backdrop-blur-sm rounded-2xl shadow-lg border border-line p-5 space-y-4"
        >
          <PaymentFormFields
            method={form.method}
            onMethodChange={form.setMethod}
            amountUsd={form.amountUsd}
            onAmountUsdChange={form.setAmountUsd}
            amountBs={form.amountBs}
            onAmountBsChange={form.setAmountBs}
            currency={form.currency}
            onCurrencyChange={form.setCurrency}
            bcvRate={bcvRate}
            pendingAmount={account.pending}
            onPayFull={form.handlePayFull}
            paidAt={form.paidAt}
            onPaidAtChange={form.setPaidAt}
            reference={form.reference}
            onReferenceChange={form.setReference}
            needsReference={form.needsReference}
            destinationAccount={form.destinationAccount}
            onDestinationAccountChange={form.setDestinationAccount}
            isPagoMovil={form.isPagoMovil}
            phone={form.phone}
            onPhoneChange={form.setPhone}
            cedula={form.cedula}
            onCedulaChange={form.setCedula}
            banco={form.banco}
            onBancoChange={form.setBanco}
            usesBs={form.usesBs}
            notes={form.notes}
            onNotesChange={form.setNotes}
            reporterName={form.reporterName}
            onReporterNameChange={form.setReporterName}
            reporterPhone={form.reporterPhone}
            onReporterPhoneChange={form.setReporterPhone}
          />

          <ProofImageUpload
            imagePreview={form.imagePreview}
            onChange={handleImageChange}
          />

          {/* Error */}
          {submitError && <FormError message={submitError} />}

          {/* Submit */}
          <SubmitButton loading={submitting} />
        </form>

        <p className="text-center text-xs text-brand/60 mt-6">
          {nombre} · {negocio.address}
        </p>
      </div>
    </div>
  );
}

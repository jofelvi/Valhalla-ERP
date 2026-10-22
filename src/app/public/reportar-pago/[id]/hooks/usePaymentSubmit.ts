import { useCallback, useState } from 'react';
import { PaymentMethodEnum } from '@/shared/types/enumShared';
import { api } from '@/services/api/apiClient';
import { subirComprobanteDePago } from '@/services/uploads/uploadImage';

interface PublicAccountData {
  pending: number;
}

interface SubmitPayload {
  accountId: string;
  account: PublicAccountData;
  method: PaymentMethodEnum;
  amountUsd: string;
  amountBs: string;
  reference: string;
  phone: string;
  cedula: string;
  banco: string;
  destinationAccount: string;
  paidAt: string;
  notes: string;
  reporterName: string;
  reporterPhone: string;
  imageFile: File | null;
}

export function usePaymentSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = useCallback(
    (payload: SubmitPayload): string | null => {
      const {
        account,
        amountUsd,
        method,
        reference,
        phone,
        imageFile,
      } = payload;

      if (!imageFile) {
        return 'Debe adjuntar la imagen del comprobante';
      }

      const parsedAmountUsd = parseFloat(amountUsd);
      if (!parsedAmountUsd || parsedAmountUsd <= 0) {
        return 'Ingrese un monto valido';
      }

      if (parsedAmountUsd > account.pending + 0.01) {
        return `El monto ($${parsedAmountUsd.toFixed(2)}) supera el pendiente ($${account.pending.toFixed(2)})`;
      }

      const isPagoMovil = method === PaymentMethodEnum.PAGO_MOVIL;
      const isTransfer = method === PaymentMethodEnum.TRANSFER;

      if ((isPagoMovil || isTransfer) && !reference.trim()) {
        return 'La referencia es obligatoria para pago movil y transferencias';
      }

      if (isPagoMovil && !phone.trim()) {
        return 'El telefono del pago movil es obligatorio';
      }

      return null;
    },
    [],
  );

  const handleSubmit = useCallback(
    async (payload: SubmitPayload) => {
      setError(null);

      const validationError = validateForm(payload);
      if (validationError) {
        setError(validationError);
        return false;
      }

      const {
        accountId,
        method,
        amountUsd,
        amountBs,
        reference,
        phone,
        cedula,
        banco,
        destinationAccount,
        paidAt,
        notes,
        reporterName,
        reporterPhone,
        imageFile,
      } = payload;

      const isPagoMovil = method === PaymentMethodEnum.PAGO_MOVIL;

      if (!imageFile) {
        setError('Debe adjuntar la imagen del comprobante');
        return false;
      }

      setSubmitting(true);
      try {
        // 1. Upload proof image
        const proofImageUrl = await subirComprobanteDePago(imageFile, accountId);

        // 2. Create payment report
        const parsedAmountBs = parseFloat(amountBs);
        await api.post('/api/payment-reports/public', {
          accountReceivableId: accountId,
          amount: parseFloat(amountUsd),
          amountBs: !isNaN(parsedAmountBs) ? parsedAmountBs : undefined,
          method,
          reference: reference || undefined,
          phone: phone || undefined,
          cedula: cedula || undefined,
          banco: banco || undefined,
          destinationAccount: isPagoMovil ? destinationAccount : undefined,
          paidAt,
          notes: notes || undefined,
          proofImageUrl,
          reporterName: reporterName || undefined,
          reporterPhone: reporterPhone || undefined,
        });
        setSubmitted(true);
        return true;
      } catch (err) {
        setError(
          'Error al enviar el reporte: ' +
            (err instanceof Error ? err.message : 'desconocido'),
        );
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [validateForm],
  );

  return {
    submitting,
    submitted,
    error,
    setError,
    handleSubmit,
  };
}

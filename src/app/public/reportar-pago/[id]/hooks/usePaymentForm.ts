import { useCallback, useEffect, useMemo, useState } from 'react';
import { PaymentMethodEnum } from '@/shared/types/enumShared';
import { usePagoMovilDestino } from '@/shared/hooks/usePagoMovilDestino';

interface PublicAccountData {
  pending: number;
}

export function usePaymentForm(account: PublicAccountData | null, bcvRate: number) {
  const destino = usePagoMovilDestino();
  const [method, setMethod] = useState<PaymentMethodEnum>(PaymentMethodEnum.PAGO_MOVIL);
  const [amountUsd, setAmountUsd] = useState('');
  const [amountBs, setAmountBs] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'BS'>('BS');
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [cedula, setCedula] = useState('');
  const [banco, setBanco] = useState('');
  const [destinationAccount, setDestinationAccount] = useState<string>(
    destino?.telefono ?? '',
  );
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Prellenar monto con el pendiente cuando se carga la cuenta
  useEffect(() => {
    if (account && bcvRate > 0 && !amountUsd && !amountBs) {
      setAmountUsd(account.pending.toFixed(2));
      setAmountBs((account.pending * bcvRate).toFixed(2));
    }
  }, [account, bcvRate, amountUsd, amountBs]);

  // Sincronizar montos USD <-> Bs
  const handleAmountUsdChange = useCallback((value: string) => {
    setAmountUsd(value);
    const num = parseFloat(value);
    if (!isNaN(num) && bcvRate > 0) {
      setAmountBs((num * bcvRate).toFixed(2));
    } else {
      setAmountBs('');
    }
  }, [bcvRate]);

  const handleAmountBsChange = useCallback((value: string) => {
    setAmountBs(value);
    const num = parseFloat(value);
    if (!isNaN(num) && bcvRate > 0) {
      setAmountUsd((num / bcvRate).toFixed(2));
    } else {
      setAmountUsd('');
    }
  }, [bcvRate]);

  const handlePayFull = useCallback(() => {
    if (!account || bcvRate <= 0) return;
    setAmountUsd(account.pending.toFixed(2));
    setAmountBs((account.pending * bcvRate).toFixed(2));
  }, [account, bcvRate]);

  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        return { error: 'Solo se aceptan imagenes' };
      }
      if (file.size > 5 * 1024 * 1024) {
        return { error: 'La imagen no puede pesar mas de 5MB' };
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      return { error: null };
    },
    [],
  );

  const handleMethodChange = useCallback((newMethod: PaymentMethodEnum) => {
    setMethod(newMethod);
    setCurrency(
      newMethod === PaymentMethodEnum.PAGO_MOVIL ||
        newMethod === PaymentMethodEnum.CASH_BS ||
        newMethod === PaymentMethodEnum.TRANSFER
        ? 'BS'
        : 'USD',
    );
  }, []);

  const needsReference = useMemo(
    () =>
      method === PaymentMethodEnum.PAGO_MOVIL ||
      method === PaymentMethodEnum.TRANSFER ||
      method === PaymentMethodEnum.CARD,
    [method],
  );

  const isPagoMovil = useMemo(
    () => method === PaymentMethodEnum.PAGO_MOVIL,
    [method],
  );

  const usesBs = useMemo(
    () =>
      method === PaymentMethodEnum.PAGO_MOVIL ||
      method === PaymentMethodEnum.CASH_BS ||
      method === PaymentMethodEnum.TRANSFER,
    [method],
  );

  return {
    // State
    method,
    amountUsd,
    amountBs,
    currency,
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
    imagePreview,
    copied,
    // Setters
    setMethod: handleMethodChange,
    setAmountUsd: handleAmountUsdChange,
    setAmountBs: handleAmountBsChange,
    setCurrency,
    setReference,
    setPhone,
    setCedula,
    setBanco,
    setDestinationAccount,
    setPaidAt,
    setNotes,
    setReporterName,
    setReporterPhone,
    // Computed
    needsReference,
    isPagoMovil,
    usesBs,
    // Handlers
    handlePayFull,
    handleCopy,
    handleImageChange,
  };
}

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/shared/button/Button';
import { Input } from '@/components/shared/input/input';
import Modal from '@/components/shared/modal';
import {
  useUpdateAccountsReceivable,
  useCreatePayment,
  useUpdateOrder,
} from '@/hooks';
import {
  InvoiceStatusEnum,
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
} from '@/shared';
import {
  Banknote,
  CircleDollarSign,
  CheckCircle2,
  RefreshCw,
  ImagePlus,
  X as XIcon,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  getBcvRateFromCache,
  saveBcvRateToCache,
} from '@/shared/utils/bcvRateCache';
import {
  getOrGenerateClientRequestId,
  clearClientRequestId,
} from '@/shared/utils/clientRequestIdManager';
import { api } from '@/services/api/apiClient';
import { formatearUsd, formatearBs } from '@/shared/utils/dinero';

type Currency = 'USD' | 'BS';

const PAYMENT_METHODS = [
  {
    value: PaymentMethodEnum.CASH_USD,
    label: 'Efectivo USD',
    currency: 'USD' as Currency,
  },
  {
    value: PaymentMethodEnum.CASH_BS,
    label: 'Efectivo Bs',
    currency: 'BS' as Currency,
  },
  {
    value: PaymentMethodEnum.TRANSFER,
    label: 'Transferencia',
    currency: 'BS' as Currency,
  },
  {
    value: PaymentMethodEnum.PAGO_MOVIL,
    label: 'Pago Movil',
    currency: 'BS' as Currency,
  },
  {
    value: PaymentMethodEnum.PAGO_MOVIL_MANUAL,
    label: 'Pago Movil Manual',
    currency: 'BS' as Currency,
  },
  {
    value: PaymentMethodEnum.CARD,
    label: 'Tarjeta',
    currency: 'BS' as Currency,
  },
];

/**
 * Metodos que dejan rastro en el banco: sin la referencia no hay forma de
 * cotejar el cobro contra el extracto. Hasta el 28/08/2026 este formulario no
 * la pedia y los 14 cobros de cartera de los ultimos 60 dias quedaron sin
 * numero -- uno de $88,99 no se pudo confirmar si entro o no.
 */
const METODOS_CON_REFERENCIA: PaymentMethodEnum[] = [
  PaymentMethodEnum.PAGO_MOVIL,
  PaymentMethodEnum.PAGO_MOVIL_MANUAL,
  PaymentMethodEnum.TRANSFER,
  PaymentMethodEnum.CARD,
];

function exigeReferencia(metodo: PaymentMethodEnum): boolean {
  return METODOS_CON_REFERENCIA.includes(metodo);
}

interface RecordPaymentButtonProps {
  accountId: string;
  orderId: string | null;
  amount: number;
  paidAmount: number;
}

export default function RecordPaymentButton({
  accountId,
  orderId,
  amount,
  paidAmount,
}: RecordPaymentButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const updateAccountReceivable = useUpdateAccountsReceivable();
  const createPayment = useCreatePayment();
  const updateOrder = useUpdateOrder();
  const [showModal, setShowModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodEnum>(
    PaymentMethodEnum.CASH_USD,
  );
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().split('T')[0],
  );
  const [reference, setReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paymentRequestIdRef = useRef<string | undefined>(undefined);

  const isSubmitting =
    updateAccountReceivable.isPending ||
    createPayment.isPending ||
    updateOrder.isPending;

  const pendingAmount = amount - paidAmount;
  const pendingBs = bcvRate > 0 ? pendingAmount * bcvRate : 0;

  const fetchBcvRate = useCallback(async (date?: string) => {
    setIsLoadingRate(true);
    try {
      // Si hay fecha, intentar la API de rafnixg con fecha especifica
      if (date) {
        const res = await fetch(`https://bcv-api.rafnixg.dev/rates/${date}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.dollar && !isNaN(parseFloat(String(data.dollar)))) {
            const rate = parseFloat(String(data.dollar));
            setBcvRate(rate);
            return;
          }
        }
      }
      // Fallback: API interna (tasa del dia)
      const res = await fetch('/api/bcv-rate');
      const data = await res.json();
      if (data.success && data.rate) {
        setBcvRate(data.rate);
        saveBcvRateToCache(data.rate, data.source);
      }
    } catch {
      const cached = getBcvRateFromCache();
      if (cached) setBcvRate(cached.rate);
    } finally {
      setIsLoadingRate(false);
    }
  }, []);

  useEffect(() => {
    if (showModal && bcvRate === 0) {
      const cached = getBcvRateFromCache();
      if (cached) {
        setBcvRate(cached.rate);
      }
      void fetchBcvRate(paymentDate);
    }
  }, [showModal, bcvRate, fetchBcvRate, paymentDate]);

  const handleDateChange = (newDate: string) => {
    setPaymentDate(newDate);
    void fetchBcvRate(newDate);
  };

  const handleOpen = () => {
    const today = new Date().toISOString().split('T')[0];
    setPaymentDate(today);
    setPaymentAmount(pendingAmount.toFixed(2));
    setCurrency('USD');
    setPaymentMethod(PaymentMethodEnum.CASH_USD);
    setReference('');
    setError('');
    setSuccess(false);
    setBcvRate(0);
    setProofFile(null);
    setProofPreview(null);
    setIsUploadingProof(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowModal(true);
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El comprobante debe ser una imagen');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen excede 10MB');
      e.target.value = '';
      return;
    }
    setError('');
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setProofPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const clearProof = () => {
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadProof = async (): Promise<string | null> => {
    if (!proofFile) return null;
    setIsUploadingProof(true);
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          if (typeof res !== 'string') return reject(new Error('reader error'));
          resolve(res.split(',')[1] ?? '');
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(proofFile);
      });
      const extMatch = proofFile.name.match(/\.(jpg|jpeg|png|webp)$/i);
      const extension = (extMatch?.[1]?.toLowerCase() ?? 'jpg') as
        | 'jpg'
        | 'jpeg'
        | 'png'
        | 'webp';
      const res = await api.post<{ url: string }>('/api/uploads/image', {
        category: 'payment-proofs',
        subPath: accountId,
        imageBase64,
        extension,
      });
      return res?.url ?? null;
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handlePayFull = () => {
    if (currency === 'BS' && bcvRate > 0) {
      setPaymentAmount(pendingBs.toFixed(2));
    } else {
      setPaymentAmount(pendingAmount.toFixed(2));
    }
    setError('');
  };

  const handleMethodChange = (method: PaymentMethodEnum) => {
    setPaymentMethod(method);
    const methodDef = PAYMENT_METHODS.find((m) => m.value === method);
    if (methodDef) {
      const newCurrency = methodDef.currency;
      if (newCurrency !== currency) {
        setCurrency(newCurrency);
        // Convertir monto actual a nueva moneda
        const currentValue = parseFloat(paymentAmount);
        if (!isNaN(currentValue) && currentValue > 0 && bcvRate > 0) {
          if (newCurrency === 'BS') {
            setPaymentAmount((currentValue * bcvRate).toFixed(2));
          } else {
            setPaymentAmount((currentValue / bcvRate).toFixed(2));
          }
        } else {
          // Poner monto pendiente en nueva moneda
          if (newCurrency === 'BS') {
            setPaymentAmount(pendingBs.toFixed(2));
          } else {
            setPaymentAmount(pendingAmount.toFixed(2));
          }
        }
      }
    }
    setError('');
  };

  const getAmountInUsd = (): number => {
    const value = parseFloat(paymentAmount);
    if (isNaN(value) || value <= 0) return 0;
    if (currency === 'BS' && bcvRate > 0) {
      return value / bcvRate;
    }
    return value;
  };

  const handleSubmit = async () => {
    const value = parseFloat(paymentAmount);

    if (isNaN(value) || value <= 0) {
      setError('Ingresa un monto valido mayor a 0');
      return;
    }

    if (currency === 'BS' && bcvRate <= 0) {
      setError('No se pudo obtener la tasa BCV. Intenta actualizar.');
      return;
    }

    if (exigeReferencia(paymentMethod) && !reference.trim()) {
      setError(
        'Falta el numero de referencia: sin el no se puede cotejar el cobro contra el banco',
      );
      return;
    }

    const usdValue = getAmountInUsd();

    if (usdValue > pendingAmount + 0.01) {
      setError(
        `El monto equivale a ${formatearUsd(usdValue)} y supera el pendiente (${formatearUsd(pendingAmount)})`,
      );
      return;
    }

    setError('');

    try {
      // Subir comprobante ANTES de registrar el pago — si falla el upload, no
      // se registra el pago (el usuario puede reintentar o quitar la imagen).
      let proofImageUrl: string | null = null;
      if (proofFile) {
        try {
          proofImageUrl = await uploadProof();
        } catch {
          setError(
            'No se pudo subir la imagen del comprobante. Intenta de nuevo o quitala.',
          );
          return;
        }
      }

      const newPaidAmount = Math.min(paidAmount + usdValue, amount);
      const remaining = amount - newPaidAmount;

      let newStatus: InvoiceStatusEnum;
      if (remaining <= 0.01) {
        newStatus = InvoiceStatusEnum.PAID;
      } else if (newPaidAmount > 0) {
        newStatus = InvoiceStatusEnum.PARTIALLY_PAID;
      } else {
        newStatus = InvoiceStatusEnum.PENDING;
      }

      await updateAccountReceivable.mutateAsync({
        id: accountId,
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      // Generar clientRequestId una sola vez (estable en reintentos)
      if (!paymentRequestIdRef.current) {
        paymentRequestIdRef.current = getOrGenerateClientRequestId(
          `payment:ar:${accountId}`,
        );
      }

      // Crear registro de pago para auditoria
      const isBs = currency === 'BS';
      await createPayment.mutateAsync({
        orderId: orderId ?? accountId,
        amount: usdValue,
        method: paymentMethod,
        status: PaymentStatusEnum.PAID,
        notes: `Pago cuenta por cobrar ${accountId}`,
        createdAt: paymentDate
          ? new Date(paymentDate + 'T12:00:00')
          : new Date(),
        userId: session?.user?.id ?? 'unknown',
        clientRequestId: paymentRequestIdRef.current,
        ...(isBs && bcvRate > 0 ? { bcvRate, expectedAmountBS: value } : {}),
        ...(reference.trim() ? { transactionId: reference.trim() } : {}),
        ...(proofImageUrl ? { proofImageUrl } : {}),
      });

      // Si la cuenta por cobrar fue pagada completamente, actualizar la orden
      // para que su comision sea elegible (paymentStatus debe ser 'paid')
      if (newStatus === InvoiceStatusEnum.PAID && orderId) {
        try {
          await updateOrder.mutateAsync({
            id: orderId,
            data: {
              paymentStatus: PaymentStatusEnum.PAID,
              status: OrderStatusEnum.PAID,
              updatedAt: new Date(),
            },
          });
        } catch (orderErr) {
          console.warn(
            '[RecordPayment] No se pudo actualizar la orden:',
            orderErr,
          );
        }
      }

      setSuccess(true);
      // Limpiar clientRequestId tras éxito
      clearClientRequestId(`payment:ar:${accountId}`);
      setTimeout(() => {
        setShowModal(false);
        router.refresh();
      }, 1200);
    } catch (_err) {
      setError('Error al registrar el pago. Intenta de nuevo.');
      // NO limpiar el ID en error: permitir reintentos con el mismo ID
    }
  };

  if (pendingAmount <= 0) return null;

  const usdPreview = currency === 'BS' ? getAmountInUsd() : 0;

  return (
    <>
      <Button
        onClick={handleOpen}
        className="bg-gradient-to-r from-ok to-ok hover:from-ok hover:to-ok text-on-brand shadow-lg shadow-ok/30"
        size="sm"
      >
        <Banknote className="w-4 h-4 mr-1.5" />
        Registrar Pago
      </Button>

      <Modal
        isOpen={showModal}
        onClose={() => !isSubmitting && setShowModal(false)}
      >
        <div className="p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-ok/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-ok" />
              </div>
              <h3 className="text-lg font-bold text-content mb-1">
                Pago registrado
              </h3>
              <p className="text-sm text-dim">
                El pago se registro correctamente
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-ok to-ok rounded-xl flex items-center justify-center">
                  <CircleDollarSign className="w-5 h-5 text-on-brand" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-content">
                    Registrar Pago
                  </h3>
                  <p className="text-sm text-dim">
                    Pendiente:{' '}
                    <span className="font-semibold text-danger">
                      {formatearUsd(pendingAmount)}
                    </span>
                    {bcvRate > 0 && (
                      <span className="text-dim">
                        {' '}
                        / {formatearBs(pendingBs)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Fecha del pago + Tasa BCV */}
              <div className="bg-elevated rounded-lg p-3 mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-brand font-medium">
                    Fecha del pago:
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="text-sm rounded-lg border border-brand/30 py-1 px-2 font-medium text-content focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand font-medium">
                    Tasa BCV:
                  </span>
                  <div className="flex items-center gap-2">
                    {isLoadingRate ? (
                      <span className="text-sm text-brand/60">Cargando...</span>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={bcvRate > 0 ? bcvRate : ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0) setBcvRate(val);
                          else if (e.target.value === '') setBcvRate(0);
                        }}
                        className="w-28 text-right font-bold text-content text-sm rounded-lg border border-brand/30 py-1 px-2 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                        placeholder="0.00"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => void fetchBcvRate(paymentDate)}
                      disabled={isLoadingRate}
                      className="text-brand hover:text-brand disabled:opacity-50"
                      title="Obtener tasa BCV de la fecha seleccionada"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${isLoadingRate ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-brand/60 mt-1">
                  Cambia la fecha para cargar la tasa BCV de ese dia
                  automaticamente
                </p>
              </div>

              {/* Resumen */}
              <div className="bg-elevated rounded-xl p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-dim">Total factura</span>
                  <span className="font-medium text-content">
                    {formatearUsd(amount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dim">Ya pagado</span>
                  <span className="font-medium text-ok">
                    {formatearUsd(paidAmount)}
                  </span>
                </div>
                <div className="border-t border-line pt-2 flex justify-between text-sm">
                  <span className="text-dim font-medium">Pendiente</span>
                  <span className="font-bold text-danger">
                    {formatearUsd(pendingAmount)}
                  </span>
                </div>
              </div>

              {/* Metodo de pago */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-dim mb-2">
                  Metodo de pago
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => handleMethodChange(m.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                        paymentMethod === m.value
                          ? 'bg-ok/10 border-ok text-ok ring-1 ring-ok/30'
                          : 'bg-surface border-line text-dim hover:border-line'
                      }`}
                    >
                      {m.label}
                      <span className="block text-[10px] opacity-60 mt-0.5">
                        {m.currency === 'USD' ? 'Dolares' : 'Bolivares'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Monto */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-dim mb-1.5">
                  Monto a pagar ({currency === 'USD' ? 'USD $' : 'Bs.'})
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentAmount}
                    onChange={(e) => {
                      setPaymentAmount(e.target.value);
                      setError('');
                    }}
                    placeholder="0.00"
                    className="flex-1 text-lg font-semibold"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePayFull}
                    className="whitespace-nowrap text-xs"
                  >
                    Pago total
                  </Button>
                </div>

                {/* Preview de conversion */}
                {currency === 'BS' && bcvRate > 0 && usdPreview > 0 && (
                  <p className="text-xs text-brand mt-1.5">
                    Equivale a{' '}
                    <span className="font-semibold">
                      {formatearUsd(usdPreview)} USD
                    </span>{' '}
                    (tasa {bcvRate.toFixed(2)})
                  </p>
                )}

                {error && <p className="text-sm text-danger mt-1.5">{error}</p>}
              </div>

              {/* Referencia: obligatoria en los metodos que pasan por el banco */}
              {exigeReferencia(paymentMethod) && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-dim mb-1.5">
                    Número de referencia
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={reference}
                    onChange={(e) => {
                      setReference(e.target.value);
                      setError('');
                    }}
                    placeholder="Últimos dígitos de la referencia"
                    className="text-lg font-semibold tracking-wide"
                  />
                  <p className="text-xs text-dim mt-1.5">
                    Sin la referencia este cobro no se puede buscar en el
                    extracto del banco.
                  </p>
                </div>
              )}

              {/* Comprobante de pago (opcional) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-dim mb-1.5">
                  Comprobante de pago (opcional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProofFileChange}
                  className="hidden"
                />
                {!proofPreview ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-line rounded-xl py-4 px-3 flex flex-col items-center justify-center gap-1 text-dim hover:border-brand hover:text-brand transition-colors"
                  >
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-xs font-medium">
                      Subir imagen del comprobante
                    </span>
                    <span className="text-[10px] text-dim/70">
                      JPG, PNG o WebP · max 10MB
                    </span>
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proofPreview}
                      alt="Comprobante"
                      className="w-full max-h-48 object-contain bg-elevated"
                    />
                    <button
                      type="button"
                      onClick={clearProof}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-danger text-on-brand flex items-center justify-center transition-colors"
                      title="Quitar imagen"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                    {isUploadingProof && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-on-brand text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Subiendo...
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-ok to-ok hover:from-ok hover:to-ok text-on-brand"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Procesando...
                    </span>
                  ) : (
                    <>
                      <Banknote className="w-4 h-4 mr-1.5" />
                      Confirmar Pago
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

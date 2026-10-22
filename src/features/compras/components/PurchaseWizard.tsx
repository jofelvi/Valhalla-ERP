'use client';

import React, { useState, useMemo } from 'react';
import { AlertCircle, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useCreatePurchaseFlow } from '../hooks/useCreatePurchaseFlow';
import { Step1Invoice } from './Step1Invoice';
import { Step2Items } from './Step2Items';
import { Step3Closure } from './Step3Closure';
import {
  PurchaseWizardFormData,
  CreatePurchaseRequest,
  MarginAlert,
} from '../types';
import { CurrencyType } from '@odin6/types';
import { cn } from '@/shared/utils/utils';

interface PurchaseWizardProps {
  warehouseId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type StepType = 1 | 2 | 3;

export function PurchaseWizard({
  warehouseId,
  onSuccess,
  onCancel,
}: PurchaseWizardProps) {
  const [step, setStep] = useState<StepType>(1);
  const [formData, setFormData] = useState<PurchaseWizardFormData>({
    hasInvoice: false,
    items: [],
    supplierId: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    currency: 'USD',
    warehouseId,
  });
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<MarginAlert[]>([]);

  const createPurchase = useCreatePurchaseFlow();

  const total = useMemo(
    () => formData.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0),
    [formData.items],
  );

  const isStepValid = useMemo(() => {
    switch (step) {
      case 1:
        return true; // Step 1 is always valid (invoice is optional)
      case 2:
        return (
          formData.items.length > 0 &&
          formData.items.every(
            (item) => item.productId && item.quantity > 0 && item.lineTotal > 0,
          )
        );
      case 3:
        return (
          formData.supplierId &&
          formData.purchaseDate &&
          (formData.currency === 'USD' ||
            (formData.currency === 'BS' && (formData.bcvRate || 0) > 0))
        );
      default:
        return false;
    }
  }, [step, formData]);

  const canProceed = isStepValid;

  const handlePrevious = () => {
    if (step > 1) setStep((step - 1) as StepType);
  };

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as StepType);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!isStepValid) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      setError(null);

      const request: CreatePurchaseRequest = {
        placeId: formData.supplierId,
        items: formData.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.purchaseUnit,
          lineTotal: item.lineTotal,
          purchaseUnit: item.purchaseUnit,
        })),
        currency: formData.currency,
        bcvRate: formData.currency === 'BS' ? formData.bcvRate : undefined,
        invoiceUrls: formData.invoiceUrls,
        warehouseId: formData.warehouseId,
      };

      const response = await createPurchase.mutateAsync(request);

      // Show alerts if any
      if (response.alertasMargen && response.alertasMargen.length > 0) {
        setAlerts(response.alertasMargen);
      }

      // Success
      onSuccess?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al guardar la compra: ${errorMsg}`);
    }
  };

  const isSubmitting = createPurchase.isPending;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-surface rounded-xl border border-line shadow-lg">
      {/* Error Messages */}
      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger rounded-lg flex gap-3">
          <AlertCircle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Success Alerts Display */}
      {alerts.length > 0 && (
        <div className="mb-6 p-4 bg-warn/10 border border-warn rounded-lg">
          <h4 className="font-semibold text-warn mb-2">Alertas de Margen:</h4>
          <div className="space-y-1 text-sm text-content">
            {alerts.map((alert, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-warn">•</span>
                <span>
                  {alert.name}: {alert.marginPct.toFixed(1)}% ({alert.nivel})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="mb-8">
        {step === 1 && (
          <Step1Invoice
            hasInvoice={formData.hasInvoice}
            onHasInvoiceChange={(v) =>
              setFormData({ ...formData, hasInvoice: v })
            }
            invoiceNumber={formData.invoiceNumber}
            onInvoiceNumberChange={(v) =>
              setFormData({ ...formData, invoiceNumber: v })
            }
            invoiceDate={formData.invoiceDate}
            onInvoiceDateChange={(v) =>
              setFormData({ ...formData, invoiceDate: v })
            }
            invoiceUrls={formData.invoiceUrls}
            onInvoiceUrlsChange={(v) =>
              setFormData({ ...formData, invoiceUrls: v })
            }
          />
        )}

        {step === 2 && (
          <Step2Items
            items={formData.items}
            onItemsChange={(v) => setFormData({ ...formData, items: v })}
          />
        )}

        {step === 3 && (
          <Step3Closure
            supplierId={formData.supplierId}
            onSupplierIdChange={(v) =>
              setFormData({ ...formData, supplierId: v })
            }
            purchaseDate={formData.purchaseDate}
            onPurchaseDateChange={(v) =>
              setFormData({ ...formData, purchaseDate: v })
            }
            currency={formData.currency}
            onCurrencyChange={(v) =>
              setFormData({ ...formData, currency: v as CurrencyType })
            }
            bcvRate={formData.bcvRate}
            onBcvRateChange={(v) => setFormData({ ...formData, bcvRate: v })}
            total={total}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 justify-between items-center border-t border-line pt-6">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={step === 1 || isSubmitting}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm',
              step === 1 || isSubmitting
                ? 'bg-elevated text-dim cursor-not-allowed opacity-50'
                : 'bg-elevated text-content hover:bg-elevated/80',
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Anterior
          </button>

          {step < 3 && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed || isSubmitting}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm',
                !canProceed || isSubmitting
                  ? 'bg-brand/50 text-on-brand cursor-not-allowed opacity-50'
                  : 'bg-brand text-on-brand hover:bg-brand/90',
              )}
            >
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {step === 3 && (
          <>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors text-sm',
                isSubmitting
                  ? 'bg-elevated text-dim cursor-not-allowed opacity-50'
                  : 'bg-elevated text-content hover:bg-elevated/80',
              )}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed || isSubmitting}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm',
                !canProceed || isSubmitting
                  ? 'bg-ok/50 text-white cursor-not-allowed opacity-50'
                  : 'bg-ok text-white hover:bg-ok/90',
              )}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar Compra
            </button>
          </>
        )}
      </div>

      {/* Step Indicator */}
      <div className="mt-6 flex gap-2 justify-center">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              'h-2 rounded-full transition-all',
              s <= step ? 'bg-brand w-8' : 'bg-line w-2',
            )}
          />
        ))}
      </div>
    </div>
  );
}

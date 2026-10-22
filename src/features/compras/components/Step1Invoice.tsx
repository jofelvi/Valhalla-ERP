'use client';

import React, { useState } from 'react';
import { Upload, XIcon } from 'lucide-react';
import { cn } from '@/shared/utils/utils';

interface Step1InvoiceProps {
  hasInvoice: boolean;
  onHasInvoiceChange: (value: boolean) => void;
  invoiceNumber?: string;
  onInvoiceNumberChange: (value: string) => void;
  invoiceDate?: string;
  onInvoiceDateChange: (value: string) => void;
  invoiceUrls?: string[];
  onInvoiceUrlsChange: (urls: string[]) => void;
}

export function Step1Invoice({
  hasInvoice,
  onHasInvoiceChange,
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  invoiceUrls = [],
  onInvoiceUrlsChange,
}: Step1InvoiceProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newUrls: string[] = [...invoiceUrls];
    const newPreviews: string[] = [...previews];

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setError('Por favor selecciona solo imágenes');
        return;
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Las imágenes no deben superar 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        newUrls.push(dataUrl);
        newPreviews.push(dataUrl);
        onInvoiceUrlsChange(newUrls);
        setPreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    });

    setError(null);
  };

  const handleRemoveInvoice = (index: number) => {
    const newUrls = invoiceUrls.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    onInvoiceUrlsChange(newUrls);
    setPreviews(newPreviews);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-content">
        Paso 1: Factura (Opcional)
      </h3>

      {/* Has Invoice Toggle */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onHasInvoiceChange(true)}
          className={cn(
            'flex-1 px-4 py-3 rounded-lg font-medium transition-all',
            hasInvoice
              ? 'bg-brand text-on-brand'
              : 'bg-elevated text-dim hover:bg-elevated/80',
          )}
        >
          ✓ Tengo Factura
        </button>
        <button
          type="button"
          onClick={() => onHasInvoiceChange(false)}
          className={cn(
            'flex-1 px-4 py-3 rounded-lg font-medium transition-all',
            !hasInvoice
              ? 'bg-brand text-on-brand'
              : 'bg-elevated text-dim hover:bg-elevated/80',
          )}
        >
          Sin Factura
        </button>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger rounded-lg text-sm text-danger">
          {error}
        </div>
      )}

      {/* Invoice Details */}
      {hasInvoice && (
        <div className="space-y-3 border-t border-line pt-4">
          <div>
            <label className="block text-sm font-medium text-dim mb-2">
              Número de Factura
            </label>
            <input
              type="text"
              value={invoiceNumber || ''}
              onChange={(e) => onInvoiceNumberChange(e.target.value)}
              placeholder="Ej: FAC-2024-001"
              className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dim mb-2">
              Fecha de Factura
            </label>
            <input
              type="date"
              value={invoiceDate || ''}
              onChange={(e) => onInvoiceDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-elevated border border-line rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Invoice Photos */}
          <div>
            <label className="block text-sm font-medium text-dim mb-2">
              Fotos de Factura
            </label>
            <div className="border-2 border-dashed border-line rounded-lg p-4 hover:border-brand/50 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                id="invoice-upload"
              />
              <label
                htmlFor="invoice-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-6 w-6 text-brand" />
                <span className="text-sm text-content">
                  Haz clic o arrastra imágenes aquí
                </span>
              </label>
            </div>

            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {previews.map((preview, idx) => (
                  <div key={idx} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={`invoice-${idx}`}
                      className="w-full h-24 object-cover rounded border border-line"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveInvoice(idx)}
                      className="absolute top-1 right-1 bg-danger/90 text-on-brand rounded p-1 hover:bg-danger transition-colors"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

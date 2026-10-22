'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Smartphone, X } from 'lucide-react';
import { Input } from '@/components/shared/input/input';
import { Button } from '@/components/shared/button/Button';
import Modal from '@/components/shared/modal';
import { VENEZUELAN_BANKS } from '@/shared/constants/banks';
import { bsToUsd } from '@odin6/types';

export interface PagoMovilFormData {
  amount: string;
  reference: string;
  phone: string;
  cedula: string;
  banco: string;
  fechaPago: string;
}

interface ModalPagoMovilProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'manual' | 'auto';
  onModeChange: (mode: 'manual' | 'auto') => void;
  data: PagoMovilFormData;
  onDataChange: Dispatch<SetStateAction<PagoMovilFormData>>;
  bcvRate: number;
  onManualSubmit: () => void;
  onAutoSubmit: () => void;
}

/** Modal de Pago Móvil: registro manual o verificación BDV automática. */
export function ModalPagoMovil({
  isOpen,
  onClose,
  mode,
  onModeChange,
  data,
  onDataChange,
  bcvRate,
  onManualSubmit,
  onAutoSubmit,
}: ModalPagoMovilProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-content flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-brand" />
            Pago Móvil
          </h3>
          <button
            onClick={onClose}
            className="text-dim hover:text-dim transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Toggle Manual / Automático */}
        <div className="flex bg-elevated rounded-lg p-1 mb-4">
          <button
            onClick={() => onModeChange('manual')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
              mode === 'manual'
                ? 'bg-surface text-dim shadow-sm'
                : 'text-dim hover:text-dim'
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => onModeChange('auto')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
              mode === 'auto'
                ? 'bg-surface text-dim shadow-sm'
                : 'text-dim hover:text-dim'
            }`}
          >
            Verificación BDV
          </button>
        </div>

        <div className="space-y-4">
          {/* Monto - siempre visible */}
          <div>
            <label className="block text-sm font-medium text-dim mb-2">
              Monto (Bs)
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={data.amount}
              onChange={(e) =>
                onDataChange((prev) => ({
                  ...prev,
                  amount: e.target.value,
                }))
              }
              onBlur={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value > 0) {
                  onDataChange((prev) => ({
                    ...prev,
                    amount: value.toFixed(2),
                  }));
                }
              }}
              className="w-full h-12 text-lg border-line focus:border-brand focus:ring-brand/30"
              step="0.01"
              min="0"
            />
            <div className="text-xs text-dim mt-1">
              Equivalente: $
              {bcvRate > 0
                ? bsToUsd(parseFloat(data.amount || '0'), bcvRate).toFixed(2)
                : '0.00'}{' '}
              USD
            </div>
          </div>

          {/* Referencia - siempre visible */}
          <div>
            <label className="block text-sm font-medium text-dim mb-2">
              Número de Referencia
            </label>
            <Input
              type="text"
              placeholder="123456789"
              value={data.reference}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                onDataChange((prev) => ({ ...prev, reference: value }));
              }}
              className="w-full h-12 text-lg border-line focus:border-brand focus:ring-brand/30"
            />
          </div>

          {/* Campos adicionales solo en modo automático */}
          {mode === 'auto' && (
            <>
              <div>
                <label className="block text-sm font-medium text-dim mb-2">
                  Fecha del Pago
                </label>
                <Input
                  type="date"
                  value={data.fechaPago}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) =>
                    onDataChange((prev) => ({
                      ...prev,
                      fechaPago: e.target.value,
                    }))
                  }
                  className="w-full h-12 text-lg border-line focus:border-brand focus:ring-brand/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dim mb-2">
                  Cédula del Pagador
                </label>
                <Input
                  type="text"
                  placeholder="V12345678"
                  value={data.cedula}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    onDataChange((prev) => ({ ...prev, cedula: value }));
                  }}
                  className="w-full h-12 text-lg border-line focus:border-brand focus:ring-brand/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dim mb-2">
                  Banco Origen
                </label>
                <select
                  value={data.banco}
                  onChange={(e) =>
                    onDataChange((prev) => ({
                      ...prev,
                      banco: e.target.value,
                    }))
                  }
                  className="w-full h-12 text-base border border-line focus:border-brand focus:ring-brand/30 rounded-md px-3 bg-surface text-content"
                >
                  <option value="">Seleccionar banco...</option>
                  {VENEZUELAN_BANKS.map((bank) => (
                    <option key={bank.code} value={bank.code}>
                      {bank.code} - {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dim mb-2">
                  Número de Teléfono
                </label>
                <Input
                  type="tel"
                  placeholder="04123456789"
                  value={data.phone}
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(/\D/g, '')
                      .slice(0, 11);
                    onDataChange((prev) => ({ ...prev, phone: value }));
                  }}
                  className="w-full h-12 text-lg border-line focus:border-brand focus:ring-brand/30"
                  maxLength={11}
                />
              </div>
            </>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3 mt-8">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 h-12 border-line text-dim hover:bg-elevated"
          >
            Cancelar
          </Button>
          <Button
            onClick={mode === 'manual' ? onManualSubmit : onAutoSubmit}
            className="flex-1 h-12 bg-brand hover:bg-brand text-on-brand"
            disabled={
              !data.amount ||
              parseFloat(data.amount) <= 0 ||
              data.reference.trim().length === 0 ||
              (mode === 'auto' &&
                (data.phone.length < 10 ||
                  data.cedula.trim().length < 4 ||
                  !data.banco ||
                  !data.fechaPago))
            }
          >
            {mode === 'manual' ? 'Registrar' : 'Verificar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

'use client';

import { useState } from 'react';
import { QrCode, ChevronUp } from 'lucide-react';
import { useNegocio } from '@/shared/config';
import {
  bancoPagoMovil,
  payloadPagoMovil,
  titularPagoMovil,
  urlQrPagoMovil,
} from './utils/pagoMovil';

interface PagoMovilQrPanelProps {
  /** Monto pendiente en USD (para referencia). */
  amountUsd: number;
  /** Monto pendiente en Bs (lo que el cliente paga por Pago Móvil). */
  amountBs: number;
  /** Tasa BCV usada para la conversión. */
  bcvRate: number;
}

const bsFormat = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Botón "QR Pago Móvil" en la página de cobro: despliega el monto en Bs y el QR con los
 * datos del negocio junto a esos datos. El cajero voltea la pantalla y el cliente escanea
 * con su banco. Si el negocio no tiene Pago Móvil configurado, no se muestra nada.
 */
export default function PagoMovilQrPanel({
  amountUsd,
  amountBs,
  bcvRate,
}: PagoMovilQrPanelProps) {
  const negocio = useNegocio();
  const [open, setOpen] = useState(false);
  const pm = negocio.mobilePayment;
  if (!pm) return null;

  const titular = titularPagoMovil(negocio);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mb-2 flex items-center justify-center gap-2 py-2 rounded-xl border border-brand/40 bg-brand/10 text-brand text-sm font-semibold hover:bg-brand/20 transition-colors"
      >
        <QrCode className="w-4 h-4" />
        Mostrar QR Pago Móvil
      </button>
    );
  }

  return (
    <div className="mb-2 rounded-xl border border-brand/40 bg-elevated p-3 text-center">
      <div className="text-[11px] uppercase tracking-wide text-dim font-semibold">
        Pago Móvil — monto a pagar
      </div>
      <div className="text-2xl font-bold text-ok mt-0.5">
        Bs {bsFormat.format(amountBs)}
      </div>
      <div className="text-[11px] text-dim mb-2">
        ${amountUsd.toFixed(2)} · tasa BCV {bcvRate.toFixed(2)}
      </div>

      {/* Fondo blanco alrededor del QR para que escanee bien en tema oscuro */}
      <div className="inline-block bg-white rounded-xl p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urlQrPagoMovil(payloadPagoMovil(pm, titular))}
          alt="QR Pago Móvil"
          width={220}
          height={220}
          className="w-56 h-56 object-contain"
        />
      </div>

      <div className="mt-2 text-xs text-content leading-relaxed">
        <span className="font-semibold">{bancoPagoMovil(pm)}</span>
        <br />
        Tlf: <span className="font-mono font-semibold">{pm.phone}</span> · CI:{' '}
        <span className="font-mono font-semibold">{pm.documentId}</span>
        <br />
        <span className="text-dim">
          Titular: {titular} — el cliente escanea con la app de su banco
        </span>
      </div>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-line text-dim text-xs hover:bg-hover transition-colors"
      >
        <ChevronUp className="w-3.5 h-3.5" />
        Ocultar QR
      </button>
    </div>
  );
}

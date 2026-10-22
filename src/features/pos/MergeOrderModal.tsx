'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Merge } from 'lucide-react';
import Modal from '@/components/shared/modal';
import {
  fetchOrdenesFusionables,
  fusionarOrden,
  type OrdenFusionable,
} from './services/mergeOrders';
import { tokenDeSesion } from '@/services/api/apiClient';
import { formatearUsdConMiles } from '@/shared/utils/dinero';

interface Props {
  isOpen: boolean;
  destinoId: string;
  destinoEtiqueta: string;
  destinoTotal: number;
  onClose: () => void;
  onMerged: () => void;
}

const etiquetaDe = (o: OrdenFusionable) =>
  o.tableName || o.sector || `Orden ${o.orderNumber ?? o.id.slice(-6)}`;

/**
 * Fusiona otra orden dentro de esta: sus items pasan acá y su mesa se libera.
 *
 * Pide PIN de gerencia porque mover consumo entre cuentas sirve para hacer
 * desaparecer una mesa dentro de otra. La validación real vive en el servidor.
 */
export default function MergeOrderModal({
  isOpen,
  destinoId,
  destinoEtiqueta,
  destinoTotal,
  onClose,
  onMerged,
}: Props) {
  const [ordenes, setOrdenes] = useState<OrdenFusionable[]>([]);
  const [cargando, setCargando] = useState(false);
  const [elegida, setElegida] = useState<OrdenFusionable | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;
    setElegida(null);
    setPin('');
    setError(null);
    setEnviando(false);
    setCargando(true);

    // El token de la API vive en la sesion de NextAuth, no en la pagina: se
    // resuelve aca para que quien use el modal no tenga que pasarlo.
    void (async () => {
      try {
        const t = await tokenDeSesion();
        setToken(t);
        setOrdenes(await fetchOrdenesFusionables(destinoId, t));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error cargando órdenes');
      } finally {
        setCargando(false);
      }
    })();
  }, [isOpen, destinoId]);

  const confirmar = async () => {
    if (!elegida || !pin.trim() || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await fusionarOrden(destinoId, elegida.id, pin.trim(), token);
      onMerged();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo fusionar');
      setPin('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex-shrink-0 w-10 h-10 bg-brand/15 rounded-full flex items-center justify-center">
            <Merge className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-content">
              Fusionar otra orden aquí
            </h3>
            <p className="text-sm text-dim">
              Todo pasa a {destinoEtiqueta} ·{' '}
              {formatearUsdConMiles(destinoTotal)}
            </p>
          </div>
        </div>

        {cargando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-dim" />
          </div>
        ) : ordenes.length === 0 ? (
          <p className="text-sm text-dim py-8 text-center">
            No hay otras órdenes abiertas que se puedan fusionar. Una orden con
            pagos, crédito o comisión ya pagada no se puede mover.
          </p>
        ) : (
          <>
            <p className="text-xs text-dim mt-4 mb-2">
              Elegí la orden que se va a absorber. Su mesa queda libre.
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {ordenes.map((o) => {
                const activa = elegida?.id === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setElegida(o)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      activa
                        ? 'border-brand bg-brand/10'
                        : 'border-line hover:bg-elevated'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-content truncate">
                        {etiquetaDe(o)}
                      </span>
                      <span className="text-content font-semibold shrink-0">
                        {formatearUsdConMiles(o.total)}
                      </span>
                    </div>
                    <div className="text-xs text-dim">
                      {o.itemsCount} ítem{o.itemsCount === 1 ? '' : 's'}
                      {o.waiterName ? ` · ${o.waiterName}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {elegida && (
          <div className="mt-4 p-3 rounded-lg bg-elevated border border-line">
            <p className="text-sm text-content">
              Van a quedar{' '}
              <strong>
                {formatearUsdConMiles(destinoTotal + elegida.total)}
              </strong>{' '}
              en {destinoEtiqueta}, y {etiquetaDe(elegida)} se cierra.
            </p>
            <p className="text-xs text-dim mt-1">
              Esta acción no se puede deshacer desde la pantalla.
            </p>
            <label className="block text-xs text-dim mt-3 mb-1">
              PIN de admin o gerente
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmar();
              }}
              disabled={enviando}
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-content tracking-widest text-center"
              placeholder="••••"
            />
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-danger">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="flex-1 px-4 py-2 rounded-lg border border-line text-content hover:bg-elevated disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={!elegida || !pin.trim() || enviando}
            className="flex-1 px-4 py-2 rounded-lg bg-brand text-on-brand font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Merge className="w-4 h-4" />
            )}
            Fusionar
          </button>
        </div>
      </div>
    </Modal>
  );
}

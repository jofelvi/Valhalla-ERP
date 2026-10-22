'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Modal from '@/components/shared/modal';
import {
  ReleaseAmbitoEnum,
  type Release,
  type ReleaseAmbito,
} from '@odin6/types';
import { useRevertir, useEstadoRollback } from '@/hooks/useReleases';

interface Props {
  abierto: boolean;
  release: Release | null;
  ambito: ReleaseAmbito | null;
  onCerrar: () => void;
}

const ETIQUETA: Record<string, string> = {
  web: 'la web',
  api: 'el servidor',
  apk: 'la app',
};

export const ModalRevertir = ({
  abierto,
  release,
  ambito,
  onCerrar,
}: Props) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const revertir = useRevertir();
  const { data: estado } = useEstadoRollback(revertir.isPending);

  useEffect(() => {
    if (abierto) {
      setPin('');
      setError('');
    }
  }, [abierto]);

  if (!release || !ambito) return null;

  const esWeb = ambito === ReleaseAmbitoEnum.WEB;
  const sha = esWeb ? release.shas?.web : release.shas?.api;
  const cuantoTarda = esWeb
    ? 'La web tarda varios minutos: hay que reconstruirla entera.'
    : 'El servidor tarda unos segundos.';

  const confirmar = async () => {
    setError('');
    try {
      await revertir.mutateAsync({ id: release.id, ambito, pin });
      onCerrar();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo revertir');
    }
  };

  return (
    <Modal isOpen={abierto} onClose={onCerrar} className="max-w-lg">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={18} className="text-warn" />
          Revertir {ETIQUETA[ambito]}
        </h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar">
          <X size={18} className="text-dim" />
        </button>
      </div>

      <div className="space-y-3 px-5 py-4">
        <p className="text-sm">
          Se va a volver a la versión del{' '}
          <strong>{new Date(release.fecha).toLocaleDateString('es-VE')}</strong>
          :
        </p>
        <p className="rounded border border-line bg-elevated/40 p-3 text-sm">
          {release.titulo}
          {sha && (
            <span className="mt-1 block font-mono text-xs text-dim">{sha}</span>
          )}
        </p>
        <p className="text-sm text-dim">{cuantoTarda}</p>

        {revertir.isPending ? (
          <p className="rounded border border-line p-3 text-sm">
            Revirtiendo…{' '}
            <span className="text-dim">{estado?.paso ?? 'iniciando'}</span>
            <span className="mt-1 block text-xs text-dim">
              No cierres esta ventana.
            </span>
          </p>
        ) : (
          <>
            <label className="block text-sm">
              PIN de administrador
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="off"
                className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
          </>
        )}
      </div>

      {!revertir.isPending && (
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded border border-line px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!pin}
            onClick={confirmar}
            className="rounded bg-danger px-4 py-2 text-sm text-on-brand disabled:opacity-40"
          >
            Revertir
          </button>
        </div>
      )}
    </Modal>
  );
};

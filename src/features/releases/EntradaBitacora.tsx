'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import type { Release, ReleaseAmbito } from '@odin6/types';
import { useRelease } from '@/hooks/useReleases';

interface Props {
  release: Release;
  esAdmin: boolean;
  onRevertir: (release: Release, ambito: ReleaseAmbito) => void;
  onEditar: (release: Release) => void;
}

const ETIQUETA_AMBITO: Record<string, string> = {
  web: 'Web',
  api: 'Servidor',
  apk: 'App',
};

const COLOR_AMBITO: Record<string, string> = {
  web: 'bg-brand/10 text-brand',
  api: 'bg-accent/10 text-accent',
  apk: 'bg-ok/10 text-ok',
};

export const EntradaBitacora = ({
  release,
  esAdmin,
  onRevertir,
  onEditar,
}: Props) => {
  const [abierta, setAbierta] = useState(false);

  // El detalle (que incluye el veredicto de reversion) solo se pide al abrir:
  // la lista no paga el calculo de todas las entradas.
  const { data: detalle } = useRelease(abierta ? release.id : null);

  return (
    <li className="border-b border-line">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-start gap-3 py-3 text-left hover:bg-elevated/40"
      >
        <span className="mt-0.5 text-dim">
          {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="w-20 shrink-0 text-sm text-dim">
          {new Date(release.fecha).toLocaleDateString('es-VE', {
            day: '2-digit',
            month: '2-digit',
          })}
        </span>
        <span className="flex shrink-0 gap-1">
          {release.ambito.map((a) => (
            <span
              key={a}
              className={`rounded px-2 py-0.5 text-xs ${COLOR_AMBITO[a] ?? 'bg-elevated text-dim'}`}
            >
              {ETIQUETA_AMBITO[a] ?? a}
            </span>
          ))}
        </span>
        <span className="flex-1 font-medium">{release.titulo}</span>
        {release.version && (
          <span className="shrink-0 font-mono text-xs text-dim">
            {release.version}
          </span>
        )}
      </button>

      {abierta && (
        <div className="pb-4 pl-[8.5rem] pr-2">
          {release.cambios.length > 0 && (
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-content">
              {release.cambios.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}

          {release.commits && release.commits.length > 0 && (
            <p className="mt-3 font-mono text-xs text-dim">
              {release.commits.join(' · ')}
            </p>
          )}

          {esAdmin && (
            <div className="mt-4 flex flex-wrap items-start gap-4">
              {(detalle?.reversion ?? []).map((r) => (
                <div key={r.ambito} className="max-w-sm">
                  <button
                    type="button"
                    disabled={!r.reversible}
                    onClick={() => onRevertir(release, r.ambito)}
                    className="flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-sm hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw size={14} />
                    Revertir {ETIQUETA_AMBITO[r.ambito]}
                  </button>
                  {/* El motivo se muestra siempre que no se pueda: saber POR QUE
                      no se puede revertir es justo el valor de la pantalla. */}
                  {!r.reversible && r.motivo && (
                    <p className="mt-1.5 text-xs leading-snug text-danger">
                      {r.motivo}
                    </p>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => onEditar(release)}
                className="rounded border border-line px-3 py-1.5 text-sm text-dim hover:bg-elevated"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

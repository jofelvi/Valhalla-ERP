'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Release, ReleaseAmbito } from '@odin6/types';
import { UserRoleEnum } from '@/shared/types/enumShared';
import { useUserStore } from '@/shared/store/useUserStore';
import { useReleases } from '@/hooks/useReleases';
import { CorriendoAhora } from '@/features/releases/CorriendoAhora';
import { EntradaBitacora } from '@/features/releases/EntradaBitacora';
import { ModalEntrada } from '@/features/releases/ModalEntrada';
import { ModalRevertir } from '@/features/releases/ModalRevertir';

interface AReventir {
  release: Release;
  ambito: ReleaseAmbito;
}

const mesDe = (fecha: string) => {
  const d = new Date(fecha);
  return d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
};

const BitacoraPage = () => {
  const user = useUserStore((s) => s.user);
  const esAdmin = user?.role === UserRoleEnum.ADMIN;

  const { data: releases, isLoading } = useReleases();
  const [editando, setEditando] = useState<Release | null>(null);
  const [creando, setCreando] = useState(false);
  const [aRevertir, setARevertir] = useState<AReventir | null>(null);

  // Agrupado por mes: derivado, con useMemo. Nada de useState + useEffect.
  const porMes = useMemo(() => {
    const mapa = new Map<string, Release[]>();
    (releases ?? []).forEach((r) => {
      const clave = mesDe(r.fecha);
      const lista = mapa.get(clave) ?? [];
      lista.push(r);
      mapa.set(clave, lista);
    });
    return [...mapa.entries()];
  }, [releases]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bitácora</h1>
          <p className="mt-1 text-sm text-dim">
            Todo lo que se ha subido al sistema, y qué traía cada subida.
          </p>
        </div>
        {esAdmin && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex shrink-0 items-center gap-1.5 rounded bg-brand px-4 py-2 text-sm text-on-brand hover:bg-brand-dark"
          >
            <Plus size={16} />
            Nueva entrada
          </button>
        )}
      </div>

      <CorriendoAhora />

      {isLoading && <p className="text-dim">Cargando…</p>}

      {!isLoading && porMes.length === 0 && (
        <p className="text-dim">
          Todavía no hay entradas. La primera se crea con “Nueva entrada”.
        </p>
      )}

      {porMes.map(([mes, entradas]) => (
        <section key={mes} className="mb-8">
          <h2 className="mb-1 text-xs uppercase tracking-wide text-dim">
            {mes}
          </h2>
          <ul className="border-t border-line">
            {entradas.map((r) => (
              <EntradaBitacora
                key={r.id}
                release={r}
                esAdmin={esAdmin}
                onEditar={setEditando}
                onRevertir={(release, ambito) =>
                  setARevertir({ release, ambito })
                }
              />
            ))}
          </ul>
        </section>
      ))}

      <ModalEntrada
        abierto={creando || !!editando}
        entrada={editando}
        onCerrar={() => {
          setCreando(false);
          setEditando(null);
        }}
      />

      <ModalRevertir
        abierto={!!aRevertir}
        release={aRevertir?.release ?? null}
        ambito={aRevertir?.ambito ?? null}
        onCerrar={() => setARevertir(null)}
      />
    </div>
  );
};

export default BitacoraPage;

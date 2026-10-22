'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Modal from '@/components/shared/modal';
import {
  ReleaseAmbitoEnum,
  type Release,
  type ReleaseAmbito,
} from '@odin6/types';
import { useCreateRelease, useUpdateRelease } from '@/hooks/useReleases';

interface Props {
  abierto: boolean;
  entrada: Release | null;
  onCerrar: () => void;
}

const AMBITOS: { valor: ReleaseAmbito; etiqueta: string }[] = [
  { valor: ReleaseAmbitoEnum.API, etiqueta: 'Servidor (API)' },
  { valor: ReleaseAmbitoEnum.WEB, etiqueta: 'Web' },
  { valor: ReleaseAmbitoEnum.APK, etiqueta: 'App (APK)' },
];

const hoy = () => new Date().toISOString().slice(0, 10);

export const ModalEntrada = ({ abierto, entrada, onCerrar }: Props) => {
  const crear = useCreateRelease();
  const actualizar = useUpdateRelease();

  const [fecha, setFecha] = useState(hoy());
  const [ambito, setAmbito] = useState<ReleaseAmbito[]>([]);
  const [version, setVersion] = useState('');
  const [titulo, setTitulo] = useState('');
  const [cambios, setCambios] = useState('');
  const [commits, setCommits] = useState('');
  const [shaWeb, setShaWeb] = useState('');
  const [shaApi, setShaApi] = useState('');
  const [migroDatos, setMigroDatos] = useState(false);
  /** Si la persona ya decidio a mano, dejamos de autocompletar la casilla. */
  const [decidioMigro, setDecidioMigro] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setError('');
    setFecha(entrada ? entrada.fecha.slice(0, 10) : hoy());
    setAmbito(entrada?.ambito ?? []);
    setVersion(entrada?.version ?? '');
    setTitulo(entrada?.titulo ?? '');
    setCambios((entrada?.cambios ?? []).join('\n'));
    setCommits((entrada?.commits ?? []).join(', '));
    setShaWeb(entrada?.shas?.web ?? '');
    setShaApi(entrada?.shas?.api ?? '');
    setMigroDatos(entrada?.migroDatos ?? false);
    setDecidioMigro(!!entrada);
  }, [abierto, entrada]);

  const alternarAmbito = (a: ReleaseAmbito) => {
    setAmbito((prev) => {
      const nuevo = prev.includes(a)
        ? prev.filter((x) => x !== a)
        : [...prev, a];
      // Si toca la API y nadie decidio a mano, se asume que movio datos: el
      // descuido debe bloquear de mas, nunca de menos.
      if (!decidioMigro) {
        setMigroDatos(nuevo.includes(ReleaseAmbitoEnum.API));
      }
      return nuevo;
    });
  };

  const guardar = async () => {
    setError('');
    if (!titulo.trim()) return setError('Falta el título.');
    if (ambito.length === 0) return setError('Elige al menos un ámbito.');

    const datos: Partial<Release> = {
      fecha: new Date(`${fecha}T18:00:00.000Z`).toISOString(),
      ambito,
      titulo: titulo.trim(),
      cambios: cambios
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      commits: commits
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      shas: {
        ...(shaWeb.trim() ? { web: shaWeb.trim() } : {}),
        ...(shaApi.trim() ? { api: shaApi.trim() } : {}),
      },
      migroDatos,
    };
    if (version.trim()) datos.version = version.trim();

    try {
      if (entrada) {
        await actualizar.mutateAsync({ id: entrada.id, data: datos });
      } else {
        await crear.mutateAsync(datos);
      }
      onCerrar();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  const campo =
    'mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-sm';
  const enviando = crear.isPending || actualizar.isPending;

  return (
    <Modal isOpen={abierto} onClose={onCerrar} className="max-w-2xl">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-semibold">
          {entrada ? 'Editar entrada' : 'Nueva entrada'}
        </h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar">
          <X size={18} className="text-dim" />
        </button>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
        <div className="flex gap-4">
          <label className="block text-sm">
            Fecha del despliegue
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={campo}
            />
          </label>
          {ambito.includes(ReleaseAmbitoEnum.APK) && (
            <label className="block text-sm">
              Versión de la app
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.2.1"
                className={campo}
              />
            </label>
          )}
        </div>

        <div className="text-sm">
          Ámbitos
          <div className="mt-1 flex flex-wrap gap-3">
            {AMBITOS.map((a) => (
              <label key={a.valor} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={ambito.includes(a.valor)}
                  onChange={() => alternarAmbito(a.valor)}
                />
                {a.etiqueta}
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          Título
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="El descuento con PIN ya no se revierte"
            className={campo}
          />
        </label>

        <label className="block text-sm">
          Cambios
          <span className="ml-1 text-xs text-dim">(una línea por viñeta)</span>
          <textarea
            value={cambios}
            onChange={(e) => setCambios(e.target.value)}
            rows={5}
            className={campo}
          />
        </label>

        {ambito.includes(ReleaseAmbitoEnum.API) && (
          <label className="block text-sm">
            Commit desplegado en el servidor
            <span className="ml-1 text-xs text-dim">
              (sin esto no se podrá revertir)
            </span>
            <input
              value={shaApi}
              onChange={(e) => setShaApi(e.target.value)}
              placeholder="6755ac2"
              className={`${campo} font-mono`}
            />
          </label>
        )}

        {ambito.includes(ReleaseAmbitoEnum.WEB) && (
          <label className="block text-sm">
            Commit desplegado en la web
            <span className="ml-1 text-xs text-dim">
              (sin esto no se podrá revertir)
            </span>
            <input
              value={shaWeb}
              onChange={(e) => setShaWeb(e.target.value)}
              placeholder="043c571"
              className={`${campo} font-mono`}
            />
          </label>
        )}

        <label className="block text-sm">
          Commits que entraron
          <span className="ml-1 text-xs text-dim">(separados por coma)</span>
          <input
            value={commits}
            onChange={(e) => setCommits(e.target.value)}
            className={`${campo} font-mono`}
          />
        </label>

        <label className="flex items-start gap-2 rounded border border-line bg-elevated/40 p-3">
          <input
            type="checkbox"
            checked={migroDatos}
            onChange={(e) => {
              setDecidioMigro(true);
              setMigroDatos(e.target.checked);
            }}
            className="mt-0.5"
          />
          <span className="text-sm">
            Este despliegue movió datos
            <span className="mt-0.5 block text-xs text-dim">
              Marcarlo impide revertir a versiones anteriores a esta, porque la
              base de datos no vuelve atrás con el código.
            </span>
          </span>
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

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
          onClick={guardar}
          disabled={enviando}
          className="rounded bg-brand px-4 py-2 text-sm text-on-brand disabled:opacity-50"
        >
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
};

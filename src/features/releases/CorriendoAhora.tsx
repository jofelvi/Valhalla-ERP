'use client';

import { useApiVersion } from '@/hooks/useApiVersion';
import {
  formatBuildTime,
  webVersionInfo,
  type AppVersionInfo,
} from '@/shared/utils/appVersion';

/**
 * Lo que esta corriendo AHORA, para contrastarlo contra la ultima entrada de la
 * bitacora.
 *
 * La bitacora dice lo que se quiso desplegar; esto dice lo que el servidor
 * responde. Cuando las dos cosas no coinciden hay un deploy que no entro — que
 * es exactamente lo que paso cuando la PWA sirvio 14 dias un build viejo sin
 * que nada diera error.
 */

const Fila = ({
  etiqueta,
  info,
  estado,
}: {
  etiqueta: string;
  info?: AppVersionInfo;
  estado?: 'cargando' | 'error';
}) => {
  const build = info ? formatBuildTime(info.buildTime) : '';

  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs uppercase tracking-wide text-dim">
        {etiqueta}
      </span>

      {estado === 'cargando' && <span className="text-sm text-dim">…</span>}

      {estado === 'error' && (
        <span className="text-sm text-danger">sin respuesta</span>
      )}

      {info && (
        <span className="min-w-0 truncate text-right">
          <span className="text-sm font-medium">{info.version}</span>
          <span className="ml-2 font-mono text-xs text-dim">{info.sha}</span>
          {!!build && <span className="ml-2 text-xs text-dim/70">{build}</span>}
        </span>
      )}
    </div>
  );
};

export const CorriendoAhora = () => {
  const { data: apiInfo, isLoading, isError } = useApiVersion();

  return (
    <section className="mb-6 rounded-lg border border-line bg-elevated p-4">
      <h2 className="mb-2 text-xs uppercase tracking-wide text-dim">
        Corriendo ahora
      </h2>
      <div className="divide-y divide-line">
        <Fila etiqueta="Web" info={webVersionInfo} />
        <Fila
          etiqueta="API"
          info={apiInfo}
          estado={isLoading ? 'cargando' : isError ? 'error' : undefined}
        />
      </div>
    </section>
  );
};

'use client';

import Link from 'next/link';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { useConfig, useConfigDoc } from '@/shared/config';
import { useAcceso } from './hooks/useAcceso';
import {
  AJUSTES_RUTA,
  PASOS_PRIMER_ARRANQUE,
  SECCIONES_AJUSTES,
  type SeccionAjustes,
} from './secciones';

export default function AjustesPage() {
  const { configured, isLoading } = useConfig();
  const { cargandoSesion, puedeVer } = useAcceso();

  if (cargandoSesion) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <p role="status" className="text-sm text-dim">
          Cargando…
        </p>
      </main>
    );
  }

  if (!puedeVer) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-3 px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold text-content">Ajustes</h1>
        <p className="text-dim">Esta sección es solo para administradores.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-content">Ajustes</h1>
        <p className="text-dim">
          Configure el negocio desde aquí. Cada sección se guarda por separado
          con su botón «Guardar cambios».
        </p>
      </header>

      {!configured && !isLoading && <GuiaPrimerArranque />}

      <section aria-labelledby="titulo-secciones" className="space-y-4">
        <h2
          id="titulo-secciones"
          className="text-xl font-semibold text-content"
        >
          Secciones
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SECCIONES_AJUSTES.map((seccion) => (
            <TarjetaSeccion key={seccion.id} seccion={seccion} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-otros" className="space-y-3">
        <h2 id="titulo-otros" className="text-xl font-semibold text-content">
          Otros ajustes
        </h2>
        <ul className="flex flex-wrap gap-3 text-sm">
          <li>
            <Link
              className="rounded-lg text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              href={PRIVATE_ROUTES.SETTINGS_BRANCHES}
            >
              Sucursales
            </Link>
          </li>
          <li>
            <Link
              className="rounded-lg text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              href={`${AJUSTES_RUTA}/attendance`}
            >
              Asistencia (área y horario de entrada)
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}

/** Una tarjeta por sección con su estado real: "Configurado" cuando alguien ya la guardó. */
function TarjetaSeccion({ seccion }: { seccion: SeccionAjustes }) {
  const doc = useConfigDoc(seccion.id);
  const configurado = doc.data?.configured === true;
  const estado = doc.isPending
    ? 'Cargando…'
    : configurado
      ? 'Configurado'
      : 'Falta';
  const colorEstado = configurado ? 'text-success' : 'text-warning';

  return (
    <li>
      <Link
        href={seccion.ruta}
        className="block h-full rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-content">
            {seccion.titulo}
          </h3>
          <span className={`text-sm font-semibold ${colorEstado}`}>
            <span className="sr-only">Estado: </span>
            {estado}
          </span>
        </div>
        <p className="mt-2 text-sm text-dim">{seccion.descripcion}</p>
      </Link>
    </li>
  );
}

function GuiaPrimerArranque() {
  return (
    <section
      aria-labelledby="titulo-guia"
      className="space-y-3 rounded-2xl border border-brand bg-surface p-5"
    >
      <h2 id="titulo-guia" className="text-xl font-semibold text-content">
        Primer arranque
      </h2>
      <p className="text-sm text-dim">
        Esta instalación todavía no tiene los datos de su negocio. Configúrelo
        en este orden:
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-content">
        {PASOS_PRIMER_ARRANQUE.map((paso) => (
          <li key={paso.id}>
            <Link
              href={paso.ruta}
              className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand"
            >
              {paso.titulo}
            </Link>
            <span className="text-dim"> · {paso.descripcion}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

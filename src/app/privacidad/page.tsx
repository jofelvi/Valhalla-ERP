import type { Metadata } from 'next';
import { nombreVisible } from '@odin6/types';
import { obtenerConfigPublica } from '@/lib/configServidor';

/**
 * Política de privacidad genérica. El texto legal y los datos de contacto son los que el
 * negocio cargó en Ajustes (`negocio.legalText`): aquí no hay nada escrito a mano de un local.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { marca, negocio } = await obtenerConfigPublica();
  const nombre = nombreVisible(marca, negocio);
  return {
    title: `Política de Privacidad | ${nombre}`,
    description: `Política de privacidad de ${nombre} para el manejo de datos personales.`,
    robots: { index: true, follow: true },
  };
}

export default async function PrivacidadPage() {
  const { marca, negocio, configured } = await obtenerConfigPublica();
  const nombre = nombreVisible(marca, negocio);
  const parrafos = negocio.legalText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-content">
      <h1 className="mb-2 text-3xl font-bold">Política de privacidad</h1>
      <p className="mb-8 text-sm text-dim">{nombre}</p>

      {configured && parrafos.length > 0 ? (
        parrafos.map((p, i) => (
          <p key={i} className="mb-4 leading-relaxed text-content">
            {p}
          </p>
        ))
      ) : (
        <p className="mb-4 text-dim">
          Este negocio todavía no publicó su política de privacidad.
        </p>
      )}

      <section className="mt-10 border-t border-line pt-6 text-sm text-dim">
        <h2 className="mb-2 font-semibold text-content">Contacto</h2>
        {negocio.legalName && <p>Responsable: {negocio.legalName}</p>}
        {negocio.taxId && <p>Identificación fiscal: {negocio.taxId}</p>}
        {negocio.address && <p>Dirección: {negocio.address}</p>}
        {negocio.email && <p>Correo: {negocio.email}</p>}
        {negocio.phone && <p>Teléfono: {negocio.phone}</p>}
      </section>
    </main>
  );
}

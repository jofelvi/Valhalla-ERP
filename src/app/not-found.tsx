import Link from 'next/link';

/**
 * 404 propio. Sin este archivo Next sirve su pagina por defecto, que se sale
 * del diseno y deja al usuario sin una salida clara de vuelta al sistema.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center">
        <p className="text-5xl font-bold text-brand">404</p>
        <h1 className="mt-3 text-lg font-semibold text-content">
          Esta página no existe
        </h1>
        <p className="mt-2 text-sm text-dim">
          Puede que el enlace esté viejo o que la pantalla se haya movido.
        </p>
        <Link
          href="/private/dashboard"
          className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-dark"
        >
          Volver al panel
        </Link>
      </div>
    </div>
  );
}

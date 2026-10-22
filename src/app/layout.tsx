import type { Metadata } from 'next';
import { headers } from 'next/headers';
import {
  Geist_Mono,
  Bricolage_Grotesque,
  Instrument_Sans,
} from 'next/font/google';
import { nombreVisible } from '@odin6/types';
import { Providers } from '@/components/providers/Providers';
import { obtenerConfigPublica } from '@/lib/configServidor';
import { resolverUrlMarca } from '@/shared/config/logoUrl';
import { paletaCss } from '@/lib/paleta';
import './globals.css';

/**
 * Tipografías del design system: títulos y cifras (Bricolage Grotesque), cuerpo (Instrument
 * Sans) y monoespaciado (Geist Mono). Se sirven con `display: 'swap'`.
 */
const bricolageGrotesque = Bricolage_Grotesque({
  variable: '--font-display',
  weight: 'variable',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

const instrumentSans = Instrument_Sans({
  variable: '--font-sans',
  weight: 'variable',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

/**
 * Base de las URL absolutas (Open Graph, íconos). Sale de `NEXT_PUBLIC_SITE_URL` o, si no
 * está, del host de la petición: la misma imagen sirve en cualquier dominio del cliente.
 */
async function baseDelSitio(): Promise<URL> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return new URL(env);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  try {
    return new URL(`${proto}://${host ?? 'localhost:3000'}`);
  } catch {
    return new URL('http://localhost:3000');
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { marca, negocio } = await obtenerConfigPublica();
  const nombre = nombreVisible(marca, negocio);
  const descripcion =
    'Sistema de gestión para restaurantes: punto de venta, inventario, comisiones y más.';
  const icono = resolverUrlMarca(marca.iconUrl) || '/icono.svg';
  return {
    metadataBase: await baseDelSitio(),
    title: nombre,
    description: descripcion,
    applicationName: nombre,
    icons: { icon: icono, apple: icono },
    openGraph: {
      title: nombre,
      description: descripcion,
      type: 'website',
      siteName: nombre,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Una sola lectura por petición: `generateMetadata` y el layout comparten el fetch.
  const configInicial = await obtenerConfigPublica();
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Paleta del negocio antes del primer pintado: ver src/lib/paleta.ts */}
        <style
          dangerouslySetInnerHTML={{ __html: paletaCss(configInicial.marca) }}
        />
        <meta
          name="theme-color"
          content={configInicial.marca.palette.dark.page}
        />
      </head>
      <body
        className={`${instrumentSans.variable} ${bricolageGrotesque.variable} ${geistMono.variable} antialiased`}
      >
        <Providers configInicial={configInicial}>{children}</Providers>
      </body>
    </html>
  );
}

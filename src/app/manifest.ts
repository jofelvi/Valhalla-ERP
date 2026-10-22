import type { MetadataRoute } from 'next';
import { nombreVisible } from '@odin6/types';
import { obtenerConfigPublica } from '@/lib/configServidor';
import { resolverUrlMarca } from '@/shared/config/logoUrl';

/** Manifest de la PWA: nombre, ícono y color salen de la configuración del negocio. */
export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { marca, negocio } = await obtenerConfigPublica();
  const nombre = nombreVisible(marca, negocio);
  const icono = resolverUrlMarca(marca.iconUrl) || '/icono.svg';
  return {
    name: nombre,
    short_name: nombre.slice(0, 12),
    description: 'Sistema de gestión para restaurantes',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: marca.palette.dark.page,
    theme_color: marca.palette.dark.page,
    icons: [{ src: icono, sizes: '512x512', purpose: 'any' }],
  };
}

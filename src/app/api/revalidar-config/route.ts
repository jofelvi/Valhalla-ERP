import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { TAG_CONFIG_PUBLICA } from '@/lib/configServidor';

/**
 * Invalida la caché del servidor con la configuración pública (título, manifest, tema).
 * Ajustes lo llama tras guardar: sin esto el dueño cambia el nombre y durante un minuto
 * sigue viendo el anterior al recargar. Solo descarta caché, no expone ni cambia datos.
 */
export async function POST() {
  revalidateTag(TAG_CONFIG_PUBLICA, { expire: 0 });
  return NextResponse.json({ ok: true });
}

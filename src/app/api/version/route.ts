import { NextResponse } from 'next/server';
import { webVersionInfo } from '@/shared/utils/appVersion';

// Devuelve el build ID actual del servidor. El cliente hace poll cada 2 min
// y si detecta que cambió, muestra un banner "Nueva versión — recargar".
// Evita el problema de JS obsoleto tras un deploy.

export const dynamic = 'force-dynamic';

let cachedBuildId: string | null = null;

function getBuildId(): string {
  if (cachedBuildId) return cachedBuildId;
  try {
    // En standalone, Next.js escribe el buildId en .next/BUILD_ID
    // que queda junto al server.js ejecutable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync, existsSync } = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolve } = require('node:path');
    const candidates = [
      resolve(process.cwd(), '.next/BUILD_ID'),
      resolve(process.cwd(), '../.next/BUILD_ID'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        cachedBuildId = readFileSync(p, 'utf8').trim();
        return cachedBuildId!;
      }
    }
  } catch {
    // ignore
  }
  cachedBuildId = process.env.BUILD_ID ?? 'dev';
  return cachedBuildId;
}

// `buildId` es el contrato que consume VersionBanner para ofrecer recargar tras
// un deploy: NO se toca. Lo que se agrega al lado es la identidad del build
// (version, commit y hora), para poder verificar desde afuera QUE codigo esta
// sirviendo este proceso — con un curl, sin token y sin entrar por SSH.
// El buildId de Next cambia en cada compilacion pero no dice de que commit salio.
export async function GET() {
  return NextResponse.json(
    { buildId: getBuildId(), ...webVersionInfo },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

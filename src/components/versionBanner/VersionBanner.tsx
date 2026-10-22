'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

// Detecta nuevos deploys comparando el buildId del servidor con el que cargo
// la pagina inicialmente. Si hay mismatch, ofrece recargar. No fuerza —
// el usuario decide cuando (ej: tras cerrar una orden), evitando perder trabajo.

const POLL_MS = 2 * 60 * 1000; // 2 minutos

async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string };
    return data.buildId ?? null;
  } catch {
    return null;
  }
}

export default function VersionBanner() {
  const initialBuildIdRef = useRef<string | null>(null);
  const [newBuildAvailable, setNewBuildAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const current = await fetchBuildId();
      if (cancelled || !current) return;
      if (initialBuildIdRef.current === null) {
        initialBuildIdRef.current = current;
        return;
      }
      if (current !== initialBuildIdRef.current) {
        setNewBuildAvailable(true);
      }
    };

    void check();
    const interval = setInterval(check, POLL_MS);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!newBuildAvailable || dismissed) return null;

  const reload = () => {
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm bg-brand text-on-brand rounded-xl shadow-2xl border border-brand-dark p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      <RefreshCw className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight">
          Nueva versión disponible
        </p>
        <p className="text-xs text-on-brand/85 mt-1">
          Recarga cuando termines lo que estás haciendo para ver los cambios.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={reload}
            className="px-3 py-1.5 bg-white text-brand rounded-lg text-xs font-semibold hover:bg-white/90 transition-colors"
          >
            Recargar ahora
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 bg-transparent border border-white/40 rounded-lg text-xs font-medium hover:bg-white/10 transition-colors"
          >
            Luego
          </button>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-on-brand/70 hover:text-on-brand flex-shrink-0"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { UserRoleEnum } from '@/shared/types/enumShared';
import { AlertTriangle, Bell, Info } from 'lucide-react';
import { api } from '@/services/api/apiClient';

interface Alerta {
  tipo: string;
  nivel: 'grave' | 'aviso';
  titulo: string;
  detalle: string;
  ruta: string;
  cantidad: number;
}

interface ResumenAlertas {
  total: number;
  graves: number;
  alertas: Alerta[];
}

/**
 * La campana del header.
 *
 * Antes llevaba un punto rojo FIJO, encendido siempre: decía "hay algo" tanto
 * cuando lo había como cuando no, así que dejó de significar nada y nadie la
 * miraba. Ahora solo se enciende si hay algo, y el rojo se reserva para lo que
 * cuesta dinero ahora mismo (vender por debajo del costo); lo demás va en
 * ámbar.
 */
export default function CampanaAlertas() {
  const router = useRouter();
  const { data: session } = useSession();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // `/api/alerts` es de gerencia (@Roles ADMIN, MANAGER). Se pedia con
  // cualquier rol: el mesonero, el cajero y las tres estaciones se comian un
  // 403 en CADA pantalla, y otro cada dos minutos por el refetch. Se pide
  // solo cuando el rol puede leerlo, y la campana no se pinta si no.
  const rol = session?.user?.role as UserRoleEnum | undefined;
  const esGerencia = rol === UserRoleEnum.ADMIN || rol === UserRoleEnum.MANAGER;

  const { data } = useQuery({
    queryKey: ['alerts', 'resumen'],
    queryFn: () => api.get<ResumenAlertas>('/api/alerts'),
    enabled: esGerencia,
    // Cada dos minutos: son avisos de gestión, no de servicio.
    staleTime: 120_000,
    refetchInterval: 120_000,
    // Un fallo aquí no puede ensuciar la pantalla con un error rojo.
    retry: false,
  });

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const alertas = data?.alertas ?? [];
  const hayAlgo = alertas.length > 0;
  const grave = (data?.graves ?? 0) > 0;

  // Sin permiso no hay nada que mostrar: una campana que nunca se enciende
  // solo ocupa sitio y confunde.
  if (!esGerencia) return null;

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={
          hayAlgo ? `${alertas.length} avisos` : 'Sin avisos pendientes'
        }
        className="relative p-3 rounded-xl bg-elevated border border-line text-brand hover:text-brand-light hover:bg-brand/10 hover:border-brand/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-sm"
      >
        <Bell size={20} />
        {hayAlgo && (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-sm ${
              grave ? 'bg-danger' : 'bg-warn'
            }`}
          >
            {alertas.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-line bg-surface shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-bold text-content">Avisos</p>
            <p className="text-xs text-dim">
              {hayAlgo
                ? 'Lo que cuesta dinero si no se mira'
                : 'Nada pendiente por ahora'}
            </p>
          </div>

          {!hayAlgo ? (
            <p className="px-4 py-6 text-sm text-dim text-center">
              Todo en orden.
            </p>
          ) : (
            <div className="divide-y divide-line max-h-96 overflow-y-auto">
              {alertas.map((a) => (
                <button
                  key={a.tipo}
                  type="button"
                  onClick={() => {
                    setAbierto(false);
                    router.push(a.ruta);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-elevated transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    {a.nivel === 'grave' ? (
                      <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content">
                        {a.titulo}
                      </p>
                      <p className="text-xs text-dim mt-0.5 line-clamp-2">
                        {a.detalle}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

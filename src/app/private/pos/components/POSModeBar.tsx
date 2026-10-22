'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Utensils, ShoppingCart, DollarSign, Settings } from 'lucide-react';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { redireccionPorAcceso } from '@/shared/constantsRoutes/accesoPorRol';
import { formatearUsd } from '@/shared/utils/dinero';

interface POSModeBarProps {
  totalTablesAmount: number;
  totalZonesAmount: number;
  takeawayOrdersCount: number;
}

const modeStyles: Record<
  string,
  {
    link: string;
  }
> = {
  salon: {
    link: 'bg-brand text-on-brand hover:bg-brand/90',
  },
  pedidos: {
    link: 'bg-accent text-on-brand hover:bg-accent/90',
  },
  caja: {
    link: 'bg-warn text-on-brand hover:bg-warn/90',
  },
  admin: {
    link: 'bg-info text-on-brand hover:bg-info/90',
  },
};

const modes = [
  {
    id: 'salon',
    label: 'Salón',
    icon: Utensils,
    href: PRIVATE_ROUTES.POS,
  },
  {
    id: 'pedidos',
    label: 'Pedidos',
    icon: ShoppingCart,
    href: PRIVATE_ROUTES.ORDERS,
  },
  {
    id: 'caja',
    label: 'Caja',
    icon: DollarSign,
    href: PRIVATE_ROUTES.VERIFY_PAYMENTS,
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: Settings,
    href: PRIVATE_ROUTES.DASHBOARD,
  },
];

export function POSModeBar({
  totalTablesAmount,
  totalZonesAmount,
  takeawayOrdersCount,
}: POSModeBarProps) {
  const totalAmount = useMemo(
    () => totalTablesAmount + totalZonesAmount,
    [totalTablesAmount, totalZonesAmount],
  );
  const { data: session } = useSession();
  const rol = session?.user?.role;
  // Solo los modos que el rol puede abrir, con el mismo criterio del
  // middleware: un mesonero no ve Caja ni Administracion.
  const modosVisibles = useMemo(
    () => modes.filter((m) => redireccionPorAcceso(m.href, rol) === null),
    [rol],
  );

  return (
    <div className="w-full bg-surface border-b border-line">
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        {/* Modos */}
        <div className="flex gap-2">
          {modosVisibles.map((mode) => {
            const ModeIcon = mode.icon;
            const style = modeStyles[mode.id];
            return (
              <Link
                key={mode.id}
                href={mode.href}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${style.link}`}
              >
                <ModeIcon className="w-4 h-4" />
                <span>{mode.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Totales del turno */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-brand/10 text-brand rounded-lg text-xs font-semibold">
            <Utensils className="w-3.5 h-3.5" />
            <span>{formatearUsd(totalTablesAmount)}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-semibold">
            <ShoppingCart className="w-3.5 h-3.5" />
            {takeawayOrdersCount > 0 && (
              <span className="bg-accent/30 px-1.5 rounded text-[10px]">
                {takeawayOrdersCount}
              </span>
            )}
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-ok/10 text-ok rounded-lg text-xs font-semibold">
            <span className="font-display text-sm font-bold">
              {formatearUsd(totalAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

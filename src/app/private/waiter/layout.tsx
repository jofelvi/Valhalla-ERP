'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, MapPin, User, Utensils } from 'lucide-react';
import { PRIVATE_ROUTES } from '@/shared';

interface TabItem {
  href: string;
  label: string;
  icon: typeof Utensils;
  matchPrefix?: boolean;
}

const TABS: TabItem[] = [
  { href: PRIVATE_ROUTES.WAITER_TABLES, label: 'Mesas', icon: Utensils },
  { href: PRIVATE_ROUTES.WAITER_ZONES, label: 'Zonas', icon: MapPin },
  { href: PRIVATE_ROUTES.WAITER_ORDERS, label: 'Pedidos', icon: ClipboardList },
  { href: PRIVATE_ROUTES.WAITER_PROFILE, label: 'Perfil', icon: User },
];

export default function WaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // El tab "Mesas" hace match exacto con /private/waiter (sin trailing path)
  const isActive = (href: string) => {
    if (href === PRIVATE_ROUTES.WAITER_TABLES) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Este layout solo aplica a /private/waiter/*. Las rutas /private/pos/*
  // (crear-orden, cobrar, recibo) no pasan por aqui, asi que alli no hay
  // bottom tabs. Mantenemos el flag por si extendemos con sub-rutas modales.
  const hideTabs = false;

  return (
    <div className="min-h-[100dvh] bg-page flex flex-col">
      <main
        className={`flex-1 w-full max-w-md mx-auto ${
          hideTabs ? '' : 'pb-[calc(env(safe-area-inset-bottom)+64px)]'
        }`}
      >
        {children}
      </main>

      {!hideTabs && (
        <nav
          className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur-md border-t border-line z-40"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-md mx-auto grid grid-cols-4">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center justify-center py-2.5 gap-0.5 active:scale-95 transition-transform ${
                    active ? 'text-brand' : 'text-dim'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

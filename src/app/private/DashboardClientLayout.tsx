'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { UserRoleEnum } from '@/shared';
import { AUTH_ROUTES, CUSTOMER_ROUTES } from '@/shared';
import ProtectedLayout from '@/components/protectedLayout/ProtectedLayout';
import { useRealtimePos } from '@/hooks/useRealtimePos';
import { useUserStore } from '@/shared/store/useUserStore';

function WaiterLayoutShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { setUser } = useUserStore();
  useEffect(() => {
    setUser(session?.user ?? null);
  }, [session, setUser]);
  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Suscripcion WebSocket al namespace /pos del backend. Invalida las
  // React Queries de tables/orders en tiempo real (mismo canal que usa
  // el mobile). Evita que la web quede con cache stale vs mobile.
  useRealtimePos();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push(AUTH_ROUTES.SIGNIN);
      return;
    }

    // Check if user is customer (should go to customer area)
    const userRole = session?.user?.role;
    if (userRole === UserRoleEnum.CUSTOMER) {
      router.push(CUSTOMER_ROUTES.HOME);
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }
  const userRole = session?.user?.role;
  if (userRole === UserRoleEnum.CUSTOMER) {
    return null;
  }

  // Vista mobile-style sin Sidebar ni Header para:
  // - Cualquier waiter (uso la app entera en modo "mesonero")
  // - Cualquiera que entre a /private/waiter/*
  if (
    userRole === UserRoleEnum.WAITER ||
    pathname.startsWith('/private/waiter')
  ) {
    return <WaiterLayoutShell>{children}</WaiterLayoutShell>;
  }

  return <ProtectedLayout>{children}</ProtectedLayout>;
}

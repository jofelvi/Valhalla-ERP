'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AUTH_ROUTES, getDefaultRouteByRole } from '@/shared';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (status === 'authenticated' && session?.user) {
      // Redirect based on user role using centralized routes
      const userRole = session.user.role;
      const defaultRoute = getDefaultRouteByRole(userRole);
      router.push(defaultRoute);
    } else {
      // Not authenticated, redirect to login
      router.push(AUTH_ROUTES.SIGNIN);
    }
  }, [session, status, router]);

  // Show loading while determining auth status
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  return null;
}

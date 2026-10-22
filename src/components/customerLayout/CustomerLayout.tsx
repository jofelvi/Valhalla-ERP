'use client';
import { useUserStore } from '@/shared/store/useUserStore';
import { CustomerSidebar } from '@/components/customerSidebar/CustomerSidebar';
import { CustomerHeader } from '@/components/customerHeader/CustomerHeader';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { UserRoleEnum } from '@/shared';
import { useRouter } from 'next/navigation';
import { PRIVATE_ROUTES } from '@/shared';

function SyncSessionToZustand() {
  const { data: session } = useSession();
  const { setUser, user } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    setUser(session?.user ?? null);
  }, [session, setUser]);

  useEffect(() => {
    if (user && user.role !== UserRoleEnum.CUSTOMER) {
      router.push(PRIVATE_ROUTES.DASHBOARD);
    }
  }, [user, router]);

  return null;
}

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SyncSessionToZustand />
      <div className="flex h-screen bg-gradient-to-br from-teal-50 to-elevated">
        <CustomerSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <CustomerHeader />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </>
  );
}

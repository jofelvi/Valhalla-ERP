'use client';
import { usePathname } from 'next/navigation';
import { ClipboardList, Clock, Home, ShoppingBag } from 'lucide-react';
import { CUSTOMER_ROUTES } from '@/shared';
import { useSidebarStore } from '@/shared/store/useSidebarStore';
import { useEffect } from 'react';
import { cn } from '@/shared/utils/utils';
import { SafeNavAnchor } from '@/shared/ui/navigation/SafeNavAnchor';
import { BrandLogo } from '@/shared/ui/brand/BrandLogo';

const customerMenuItems = [
  {
    name: 'Inicio',
    href: CUSTOMER_ROUTES.HOME,
    icon: Home,
  },
  {
    name: 'Catálogo',
    href: CUSTOMER_ROUTES.CATALOG,
    icon: ShoppingBag,
  },
  {
    name: 'Mis Pedidos',
    href: CUSTOMER_ROUTES.HISTORY,
    icon: ClipboardList,
  },
  {
    name: 'Estado Actual',
    href: CUSTOMER_ROUTES.CURRENT_ORDER,
    icon: Clock,
  },
];

export function CustomerSidebar() {
  const pathname = usePathname();
  const { isMobileOpen, setMobileOpen } = useSidebarStore();

  // Close mobile sidebar when clicking outside or changing route
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setMobileOpen]);

  useEffect(() => {
    if (isMobileOpen) {
      setMobileOpen(false);
    }
  }, [pathname]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'w-72 h-screen bg-sidebar border-r border-line backdrop-blur-xl flex flex-col shadow-2xl',
          // Desktop behavior
          'hidden md:flex',
          // Mobile behavior
          'md:relative fixed top-0 left-0 z-50',
          isMobileOpen ? 'flex' : 'hidden md:flex',
        )}
      >
        {/* Header */}
        <div className="flex flex-col gap-1 p-6 border-b border-line">
          <BrandLogo />
          <span className="text-xs font-medium text-dim">Portal Cliente</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2 mt-6 px-4 flex-grow">
          {customerMenuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <SafeNavAnchor
                key={item.name}
                href={item.href}
                debugLabel={`customerSidebar:${item.name}`}
                className={`group flex items-center gap-3 rounded-xl px-4 py-4 text-sm font-medium transition-all duration-200 relative overflow-hidden ${
                  isActive
                    ? 'bg-brand/10 text-brand shadow-lg shadow-brand/10 border border-brand/20'
                    : 'text-dim hover:text-brand hover:bg-elevated'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-brand/5 rounded-xl"></div>
                )}
                <div
                  className={`flex items-center justify-center relative z-10 ${
                    isActive
                      ? 'text-brand-light'
                      : 'text-dim group-hover:text-brand'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="relative z-10 transition-colors duration-200">
                  {item.name}
                </span>
                {isActive && (
                  <div className="absolute right-0 w-1 h-8 bg-brand rounded-l-full"></div>
                )}
              </SafeNavAnchor>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto p-4 border-t border-line">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-elevated border border-line">
            <div className="w-2 h-2 bg-brand rounded-full animate-pulse"></div>
            <div className="text-xs text-dim font-medium">
              Cliente Conectado
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

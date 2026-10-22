'use client';

import { useRouter } from 'next/navigation';
import { useUserStore } from '@/shared/store/useUserStore';
import { useSidebarStore } from '@/shared/store/useSidebarStore';
import { ChevronDown, LogOut, Menu, Settings, User, X } from 'lucide-react';
import { useState } from 'react';
import { PRIVATE_ROUTES, PUBLIC_ROUTES } from '@/shared';
import CampanaAlertas from '@/features/alerts/CampanaAlertas';
import { cn } from '@/shared/utils/utils';
import { useLogout } from '@/hooks/useLogout';

// Header.jsx
export function Header() {
  const { user, logout } = useUserStore();
  const { isMobileOpen, toggleCollapsed, toggleMobile } = useSidebarStore();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const limpiarSesion = useLogout();

  // La PC de caja la comparten varias personas: al salir se borran las
  // consultas persistidas y el cache del service worker.
  const handleLogout = async () => {
    await limpiarSesion();
    logout();
    router.push(PUBLIC_ROUTES.LOGIN);
  };

  if (!user) return null;

  return (
    <header className="relative z-30 bg-surface/95 backdrop-blur-xl border-b border-line shadow-lg shadow-black/20">
      <div className="flex items-center justify-between px-6 h-[80px]">
        {/* Left side - Hamburger & Title */}
        <div className="flex items-center gap-4">
          {/* Hamburger Menu */}
          <button
            onClick={() =>
              window.innerWidth >= 768 ? toggleCollapsed() : toggleMobile()
            }
            className="p-2 rounded-xl bg-elevated border border-line text-brand hover:text-brand-light hover:bg-brand/10 hover:border-brand/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-sm"
          >
            {isMobileOpen && window.innerWidth < 768 ? (
              <X size={20} />
            ) : (
              <Menu size={20} />
            )}
          </button>

          <div className="hidden sm:block w-px h-8 bg-gradient-to-b from-brand to-brand-dark"></div>
          <div>
            <h1 className="text-xl font-bold text-content">Dashboard</h1>
            <p className="text-xs text-dim font-medium">
              Panel de Administración
            </p>
          </div>
        </div>

        {/* Right side - Actions & User */}
        <div className="flex items-center gap-4">
          {/* Avisos. El punto rojo de antes estaba SIEMPRE encendido, dijera
              algo o no, asi que dejo de significar nada. */}
          <CampanaAlertas />

          {/* User Menu */}
          <div className="relative">
            <button
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-elevated border border-line hover:bg-brand/10 hover:border-brand/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-sm"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center ring-2 ring-brand ring-offset-1 ring-offset-surface">
                  <User className="h-4 w-4 text-brand" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full border-2 border-white shadow-sm"></div>
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-semibold text-content">
                  {user.name}
                </div>
                <div className="text-xs text-dim font-medium capitalize">
                  {user.role}
                </div>
              </div>
              <ChevronDown
                size={16}
                className={cn(
                  'text-brand transition-transform duration-200',
                  showDropdown && 'rotate-180',
                )}
              />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-surface backdrop-blur-xl rounded-2xl shadow-xl border border-line z-50 overflow-hidden">
                <div className="p-2">
                  <div className="px-4 py-3 border-b border-line">
                    <div className="text-sm font-semibold text-content">
                      {user.name}
                    </div>
                    <div className="text-xs text-dim">{user.email}</div>
                  </div>

                  <div className="py-2 space-y-1">
                    <button
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-dim hover:bg-elevated hover:text-brand rounded-xl transition-all duration-200"
                      onClick={() => router.push(PRIVATE_ROUTES.SETTINGS)}
                    >
                      <Settings size={16} />
                      <span>Configuración</span>
                    </button>

                    <div className="h-px bg-line my-2"></div>

                    <button
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-danger hover:bg-danger/10 hover:text-danger rounded-xl transition-all duration-200"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

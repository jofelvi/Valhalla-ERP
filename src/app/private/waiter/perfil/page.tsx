'use client';
export const dynamic = 'force-dynamic';

import { signOut } from 'next-auth/react';
import { useUserStore } from '@/shared/store/useUserStore';
import { useLogout } from '@/hooks/useLogout';
import { User, LogOut, Mail, Shield } from 'lucide-react';
import { Panel } from '@/components/shared/panel/Panel';

export default function WaiterProfilePage() {
  const user = useUserStore((s) => s.user);
  const handleLogout = useLogout();

  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <div className="p-3">
      <Panel className="p-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center">
            <User className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-base font-bold text-content">Mi Perfil</h1>
            <p className="text-xs text-dim">Informacion de tu cuenta</p>
          </div>
        </div>
      </Panel>

      {/* Avatar + nombre */}
      <div className="bg-surface rounded-xl border border-line p-5 mb-3 flex flex-col items-center">
        <div className="w-20 h-20 bg-gradient-to-br from-brand to-brand-light rounded-full flex items-center justify-center shadow-lg mb-2">
          <span className="text-3xl font-bold text-on-brand">{initial}</span>
        </div>
        <h2 className="text-lg font-bold text-content">
          {user?.name || 'Sin nombre'}
        </h2>
        <span className="mt-1 px-2.5 py-0.5 bg-brand/10 text-brand rounded-full text-[11px] font-semibold uppercase tracking-wide">
          {user?.role || 'usuario'}
        </span>
      </div>

      {/* Detalles */}
      <div className="bg-surface rounded-xl border border-line divide-y divide-line mb-3">
        <div className="p-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-elevated rounded-lg flex items-center justify-center">
            <Mail className="w-4 h-4 text-dim" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-dim font-semibold">
              Email
            </p>
            <p className="text-sm text-content truncate">
              {user?.email || '—'}
            </p>
          </div>
        </div>
        <div className="p-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-elevated rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-dim" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-dim font-semibold">
              Rol
            </p>
            <p className="text-sm text-content capitalize">
              {user?.role || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={async () => {
          await handleLogout();
          await signOut({ callbackUrl: '/public/login' });
        }}
        className="w-full flex items-center justify-center gap-2 py-3 bg-danger/10 border border-danger/30 text-danger rounded-xl font-semibold hover:bg-danger/20 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesion
      </button>
    </div>
  );
}

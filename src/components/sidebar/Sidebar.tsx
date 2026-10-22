'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils/utils';
import { useSidebarStore } from '@/shared/store/useSidebarStore';
import { PRIVATE_ROUTES } from '@/shared';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { BrandLogo } from '@/shared/ui/brand/BrandLogo';
import { useConfig, useNombreApp, useVocab } from '@/shared/config';
import type { ModuloKey, VocabKey } from '@odin6/types';
import { UserRoleEnum } from '@/shared/types/enumShared';
import { hasPermission } from '@/shared/constantsRoutes/sidebarPermissions';
import { Moon, Sun } from 'lucide-react';
import { SafeNavAnchor } from '@/shared/ui/navigation/SafeNavAnchor';
import {
  WEB_BUILD_TIME,
  formatBuildTime,
  formatVersionTag,
  webVersionInfo,
} from '@/shared/utils/appVersion';

/** Constante de build: no cambia entre renders. */
const buildLegible = formatBuildTime(WEB_BUILD_TIME);

import {
  FiBarChart,
  FiCalendar,
  FiClipboard,
  FiUploadCloud,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiFolder,
  FiGrid,
  FiLayout,
  FiPackage,
  FiShoppingCart,
  FiTruck,
  FiUserCheck,
  FiUsers,
  FiBox,
  FiCheckSquare,
  FiClock,
  FiArchive,
  FiBookOpen,
} from 'react-icons/fi';

interface ItemMenu {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Si está apagado en `modulos`, el ítem no se muestra. */
  modulo?: ModuloKey;
}

/** Las etiquetas de rol y de estación salen de `vocabulario` (el negocio las renombra). */
const construirMenu = (t: (k: VocabKey) => string): ItemMenu[] => [
  {
    label: 'Panel',
    path: PRIVATE_ROUTES.DASHBOARD,
    icon: <FiLayout size={20} />,
  },
  {
    label: 'Categorías',
    path: PRIVATE_ROUTES.CATEGORIES,
    icon: <FiFolder size={20} />,
  },
  {
    label: 'Productos',
    path: PRIVATE_ROUTES.PRODUCTS,
    icon: <FiPackage size={20} />,
  },
  {
    label: 'Órdenes',
    path: PRIVATE_ROUTES.ORDERS,
    icon: <FiShoppingCart size={20} />,
  },
  {
    label: `Pedidos por ${t('waiters')}`,
    path: PRIVATE_ROUTES.ORDERS_BY_WAITER,
    icon: <FiClock size={20} />,
  },
  {
    label: 'Facturas',
    path: PRIVATE_ROUTES.INVOICES,
    icon: <FiFileText size={20} />,
  },
  {
    label: 'Proveedores',
    path: PRIVATE_ROUTES.SUPPLIERS,
    icon: <FiTruck size={20} />,
  },
  {
    label: t('tables'),
    path: PRIVATE_ROUTES.TABLES,
    icon: <FiGrid size={20} />,
  },
  {
    label: 'Órdenes de Compra',
    path: PRIVATE_ROUTES.PURCHASE_ORDERS,
    icon: <FiClipboard size={20} />,
  },
  {
    label: 'Clientes',
    path: PRIVATE_ROUTES.CUSTOMERS,
    icon: <FiUsers size={20} />,
  },
  {
    label: 'Empleados',
    path: PRIVATE_ROUTES.EMPLOYEES,
    icon: <FiUserCheck size={20} />,
  },
  {
    label: 'Usuarios',
    path: PRIVATE_ROUTES.USERS,
    icon: <FiUsers size={20} />,
  },
  {
    label: 'Nóminas',
    path: '/private/payroll',
    icon: <FiCalendar size={20} />,
  },
  {
    label: 'Reportes',
    path: '/private/reports',
    icon: <FiBarChart size={20} />,
  },
  {
    label: 'Cuentas por Cobrar',
    path: PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE,
    icon: <FiDollarSign size={20} />,
  },
  {
    label: 'WhatsApp Logs',
    path: PRIVATE_ROUTES.WHATSAPP_LOGS,
    icon: <FiFileText size={20} />,
  },
  {
    label: 'Verificar Pagos',
    path: PRIVATE_ROUTES.VERIFY_PAYMENTS,
    icon: <FiCheckSquare size={20} />,
  },
  {
    label: 'Punto de Venta',
    path: PRIVATE_ROUTES.POS,
    icon: <FiCreditCard size={20} />,
  },
  {
    // El mesonero pide el credito desde el APK y esta es la UNICA pantalla
    // que lo aprueba o lo rechaza. Se perdio del menu al cambiar de sidebar
    // (solo quedaba en el viejo, que ya no se usa): al medirlo habia 21
    // solicitudes en espera sin forma de llegar a ellas salvo escribiendo la
    // URL a mano.
    label: 'Solicitudes de Crédito',
    path: PRIVATE_ROUTES.CREDIT_REQUESTS,
    icon: <FiClipboard size={20} />,
  },
  {
    label: 'Caja Diario',
    path: PRIVATE_ROUTES.ALMACEN_DIARIO,
    icon: <FiBox size={20} />,
  },
  {
    label: 'Reservas Evento',
    path: PRIVATE_ROUTES.EVENT_RESERVATIONS,
    icon: <FiCheckSquare size={20} />,
    modulo: 'reservations',
  },
  {
    label: 'Presupuestos',
    path: PRIVATE_ROUTES.BUDGETS,
    icon: <FiFileText size={20} />,
  },
  {
    label: 'Calendario',
    path: PRIVATE_ROUTES.CALENDARIO,
    icon: <FiCalendar size={20} />,
  },
  // Inventario y Recetas EXISTÍAN y funcionaban, pero no estaban en el menú:
  // solo se llegaba escribiendo la URL. Por eso el dueño cargaba stock en el
  // campo del formulario de producto (que no mueve nada) y por eso Recetas
  // llevaba 0 recetas cargadas por el personal — no es que no quisieran usarla,
  // es que no había cómo llegar (22/08/2026).
  {
    label: 'Inventario',
    path: PRIVATE_ROUTES.INVENTORY,
    icon: <FiArchive size={20} />,
  },
  {
    label: 'Compras',
    path: PRIVATE_ROUTES.COMPRAS,
    icon: <FiShoppingCart size={20} />,
  },
  {
    label: 'Recetas',
    path: PRIVATE_ROUTES.RECIPES,
    icon: <FiBookOpen size={20} />,
  },
  {
    label: 'Bitácora',
    path: PRIVATE_ROUTES.RELEASES,
    icon: <FiUploadCloud size={20} />,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebarStore();
  const { theme, setTheme } = useTheme();
  const nombre = useNombreApp();
  const t = useVocab();

  // Obtener el rol del usuario
  const userRole = session?.user?.role as UserRoleEnum | undefined;

  // Filtrar elementos del menú según permisos del rol
  // Un módulo apagado en Ajustes no aparece en el menú (ver docs/contrato-config.md)
  const modulos = useConfig().modulos;
  const filteredMenuItems = construirMenu(t).filter(
    (item) =>
      hasPermission(item.path, userRole) &&
      (item.modulo === undefined || modulos[item.modulo]),
  );

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
          'h-screen bg-sidebar border-r border-line transition-all duration-300 flex flex-col shadow-2xl',
          // Desktop behavior
          'hidden md:flex',
          isCollapsed ? 'md:w-20' : 'md:w-72',
          // Mobile behavior
          'md:relative fixed top-0 left-0 z-50',
          isMobileOpen ? 'flex w-72' : 'hidden md:flex',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center px-6 h-[80px] border-b border-line flex-shrink-0',
            isCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <BrandLogo soloIcono={isCollapsed} />
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2 mt-6 px-4 pb-4 flex-grow overflow-y-auto sidebar-scroll">
          {filteredMenuItems.map(({ label, path, icon }) => {
            const isActive = pathname === path;
            return (
              <SafeNavAnchor
                key={path}
                href={path}
                debugLabel={`sidebar:${label}`}
                className={cn(
                  'group flex items-center rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden cursor-pointer',
                  isCollapsed ? 'justify-center p-3 mx-1' : 'gap-3 px-4 py-3',
                  isActive
                    ? 'bg-brand/10 text-brand shadow-lg shadow-brand/10 border border-brand/20'
                    : 'text-dim hover:text-brand hover:bg-elevated',
                )}
                title={isCollapsed ? label : undefined}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-brand/5 to-transparent rounded-xl"></div>
                )}
                <div
                  className={cn(
                    'flex items-center justify-center relative z-10',
                    isCollapsed ? 'w-full' : 'min-w-[24px]',
                    isActive ? 'text-brand' : 'text-dim group-hover:text-brand',
                  )}
                >
                  {icon}
                </div>
                {!isCollapsed && (
                  <span className="relative z-10 transition-colors duration-200">
                    {label}
                  </span>
                )}
                {isActive && (
                  <div className="absolute right-0 w-1 h-8 bg-gradient-to-b from-brand to-brand-dark rounded-l-full"></div>
                )}
              </SafeNavAnchor>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-line flex-shrink-0 space-y-2">
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              'w-full flex items-center rounded-lg border border-line bg-elevated transition-all duration-200',
              'hover:border-brand/40 hover:bg-brand/10',
              isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
            )}
            title={
              theme === 'dark'
                ? 'Cambiar a modo claro'
                : 'Cambiar a modo oscuro'
            }
          >
            {theme === 'dark' ? (
              <Sun size={16} className="text-brand flex-shrink-0" />
            ) : (
              <Moon size={16} className="text-brand flex-shrink-0" />
            )}
            {!isCollapsed && (
              <span className="text-xs font-medium text-dim">
                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </span>
            )}
          </button>

          {!isCollapsed && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-elevated border border-line">
              <div className="w-2 h-2 bg-brand rounded-full animate-pulse"></div>
              <div className="min-w-0">
                <div className="text-xs text-dim font-medium truncate">
                  {nombre} {formatVersionTag(webVersionInfo)}
                </div>
                {!!buildLegible && (
                  <div className="text-[10px] text-dim/70 truncate">
                    {buildLegible}
                  </div>
                )}
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-brand rounded-full animate-pulse"></div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

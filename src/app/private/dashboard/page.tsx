'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import {
  BarChart3,
  Package,
  ShoppingCart,
  TableProperties,
  Truck,
  Users,
} from 'lucide-react';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { SalesIntervalEnum } from '@/shared/types/enumShared';
import { panelKeys, usePanelVentas } from '@/hooks/usePanel';
import MargenesEnRiesgoCard from '@/app/components/dashboard/MargenesEnRiesgoCard';
import SelectorPeriodo from '@/app/components/dashboard/panel/SelectorPeriodo';
import TarjetaVenta from '@/app/components/dashboard/panel/TarjetaVenta';
import BloqueCaja from '@/app/components/dashboard/panel/BloqueCaja';
import GraficoVenta from '@/app/components/dashboard/panel/GraficoVenta';
import RankingProductos from '@/app/components/dashboard/panel/RankingProductos';
import RankingMesoneros from '@/app/components/dashboard/panel/RankingMesoneros';
import UltimasOrdenes from '@/app/components/dashboard/panel/UltimasOrdenes';
import { formatearPeriodo } from '@/app/components/dashboard/panel/formatoPeriodo';
import { useConfig } from '@/shared/config';

/**
 * Panel de administración.
 *
 * Reescrito el 20/09/2026. Lo que habia antes: `useProducts()`,
 * `useCustomers()` y `useOrders()` sin filtro, mas `usePayments()` dentro de
 * una tarjeta — 14,35 MB y ~9 s antes de pintar un solo pixel, porque un unico
 * `isLoading` combinado tapaba la pantalla entera con un Loader. Los calculos
 * se hacian en el navegador, con un criterio distinto por tarjeta, y todos los
 * hooks caian a `= []` por defecto: si la API fallaba, las tarjetas mostraban
 * USD 0,00 — indistinguible de un dia sin ventas.
 *
 * Ahora cada tarjeta pide SU endpoint, se pinta apenas llega, y muestra su
 * propio error con su propio boton de reintentar. La pagina no espera a nadie.
 *
 * Las secciones van por PREGUNTA, no por tipo de dato: cuanto vendimos, por
 * donde entro la plata, que necesita atencion, como venimos.
 */
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { configured } = useConfig();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [periodo, setPeriodo] = useState<SalesIntervalEnum>(
    SalesIntervalEnum.TODAY,
  );

  // Solo para el rótulo del rango en el selector; la tarjeta de venta lo pide
  // igual y comparten la misma entrada de caché, así que no es una petición
  // extra.
  const { data: ventas } = usePanelVentas(periodo);
  const cargandoAlgo = useIsFetching({ queryKey: panelKeys.all }) > 0;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/public/login');
  }, [status, router]);

  const recargar = () => {
    void queryClient.invalidateQueries({ queryKey: panelKeys.all });
  };

  return (
    <div className="min-h-screen bg-page px-4 pb-10 pt-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-content sm:text-3xl">
          {saludo()}
          {session?.user?.name ? `, ${session.user.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-dim">
          Esto es lo que pasó en el restaurante.
        </p>
      </header>

      {!configured && (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-content">
            Configura tu negocio: nombre, tarifas y colores.
          </p>
          <button
            type="button"
            onClick={() => router.push(PRIVATE_ROUTES.SETTINGS)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand"
          >
            Ir a Ajustes
          </button>
        </div>
      )}

      <SelectorPeriodo
        seleccionado={periodo}
        onCambiar={setPeriodo}
        rango={ventas ? formatearPeriodo(ventas.periodo) : undefined}
        onRecargar={recargar}
        recargando={cargandoAlgo}
      />

      <div className="space-y-6">
        {/* 1. ¿Cuánto entró en caja? Va primero porque es la pregunta que el
            dueño hace al abrir el panel: punto de venta + pago móvil +
            efectivo. Lo facturado —que incluye lo que todavía no se cobró—
            va después, para que los dos números no compitan. */}
        <BloqueCaja interval={periodo} />

        {/* 2. ¿Cuánto facturamos, y cuánto de eso falta por cobrar? */}
        <TarjetaVenta interval={periodo} />

        {/* 3. ¿Qué necesita atención? Va con el dinero a propósito: un plato
            con margen negativo es plata que sale por la puerta cada vez que se
            vende, igual que un cobro incompleto. */}
        <MargenesEnRiesgoCard />

        {/* 4. ¿Cómo venimos? */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GraficoVenta interval={periodo} />
          </div>
          <UltimasOrdenes />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <RankingProductos interval={periodo} modo="top" />
          <RankingProductos interval={periodo} modo="bottom" />
          <RankingMesoneros interval={periodo} />
        </div>

        <AccesosRapidos />
      </div>
    </div>
  );
}

/**
 * Accesos directos.
 *
 * Sin los seis gradientes de colores que tenia antes: el verde de "Clientes" y
 * el ámbar de "Proveedores" no significaban nada, y el color que no significa
 * nada le resta fuerza al que sí (el rojo de un margen negativo, por ejemplo).
 */
function AccesosRapidos() {
  const router = useRouter();

  const accesos = [
    { etiqueta: 'Nueva venta', icono: ShoppingCart, ruta: PRIVATE_ROUTES.POS },
    { etiqueta: 'Órdenes', icono: BarChart3, ruta: PRIVATE_ROUTES.ORDERS },
    { etiqueta: 'Mesas', icono: TableProperties, ruta: PRIVATE_ROUTES.TABLES },
    { etiqueta: 'Productos', icono: Package, ruta: PRIVATE_ROUTES.PRODUCTS },
    { etiqueta: 'Clientes', icono: Users, ruta: PRIVATE_ROUTES.CUSTOMERS },
    { etiqueta: 'Proveedores', icono: Truck, ruta: PRIVATE_ROUTES.SUPPLIERS },
  ];

  return (
    <nav aria-label="Accesos rápidos">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-dim">
        Ir a
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {accesos.map((acceso) => (
          <button
            key={acceso.etiqueta}
            type="button"
            onClick={() => router.push(acceso.ruta)}
            className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <acceso.icono
              className="h-4 w-4 shrink-0 text-brand"
              aria-hidden="true"
            />
            <span className="truncate text-sm font-medium text-content">
              {acceso.etiqueta}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/** El saludo sigue la jornada, no el reloj: a la 1 AM todavía es "buenas noches". */
function saludo(): string {
  const hora = new Date().getHours();
  if (hora >= 6 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

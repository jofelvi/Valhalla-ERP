'use client';
export const dynamic = 'force-dynamic';

import { Button } from '@/components/shared/button/Button';
import {
  useAccountsReceivable,
  useResumenCartera,
} from '@/hooks/useAccountsReceivable';
import Link from '@/shared/ui/AppLink/AppLink';
import AccountsReceivableFilters from '@/features/accountsReceivable/AccountsReceivableFilters';
import AccountsReceivableList from '@/features/accountsReceivable/AccountsReceivableList';
import ResumenDeCartera from '@/features/accountsReceivable/components/ResumenDeCartera';
import { useFiltrosDeCartera } from '@/features/accountsReceivable/hooks/useFiltrosDeCartera';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { ArrowLeft, CreditCard, FileText, Plus, User } from 'lucide-react';
import { Panel } from '@/components/shared/panel/Panel';
import {
  IconoEnCuadro,
  TituloDePantalla,
} from '@/components/shared/cabecera/CabeceraDePantalla';
import EstadoDeBloque, {
  Esqueleto,
} from '@/components/shared/estado/EstadoDeBloque';

/**
 * Cuentas por cobrar.
 *
 * Rehecha el 20/09/2026 por tres defectos medidos en producción:
 *
 * 1. **La cifra estaba mal.** Las tarjetas se sumaban en el navegador con un
 *    criterio distinto al de la lista: apartaban las unificadas pero no las
 *    anuladas. "Pendiente" decía $9.770,55 contra $8.392,82 reales — $1.377,73
 *    de 37 cuentas anuladas que la lista escondía y el total sí sumaba. Ahora
 *    el total lo calcula el servidor con el mismo criterio, y lo apartado se
 *    enumera debajo en vez de desaparecer.
 * 2. **911 KB para mostrar 175 filas.** Se bajaban las 1.067 cuentas —627 de
 *    ellas unificadas, que se descartaban en el acto— porque el filtrado era
 *    en memoria. Ahora filtra la base.
 * 3. **Una vuelta al servidor por tecla.** El buscador hacía `router.push` en
 *    una página `force-dynamic`. Ahora es estado local y la URL se sincroniza
 *    sin navegar.
 */
export default function AccountsReceivablePage() {
  const {
    filtros,
    qDiferido,
    customerId,
    cambiar,
    limpiarFechas,
    limpiarTodo,
    hayFiltros,
    paraLaApi,
  } = useFiltrosDeCartera();

  // `soloVivas` aparta las absorbidas por una unificación y las anuladas: es
  // el mismo criterio con el que el servidor calcula el resumen.
  const lista = useAccountsReceivable({ ...paraLaApi, soloVivas: '1' });
  const resumen = useResumenCartera(paraLaApi);

  const cuentas = lista.data ?? [];
  const buscando = filtros.q.trim() !== qDiferido || lista.isFetching;

  const nombreDelCliente = customerId ? cuentas[0]?.customerName : null;
  const alcance = customerId
    ? 'de este cliente'
    : filtros.desde || filtros.hasta
      ? 'en el rango'
      : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 py-4 sm:px-4 lg:px-6 xl:px-8">
        <Panel className="mb-3 flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <IconoEnCuadro>
              <FileText className="h-5 w-5 text-brand" />
            </IconoEnCuadro>
            <TituloDePantalla
              titulo="Cuentas por Cobrar"
              subtitulo={
                nombreDelCliente
                  ? `Cliente: ${nombreDelCliente}`
                  : filtros.tab === 'history'
                    ? 'Cuentas ya pagadas'
                    : 'Lo que el negocio tiene por cobrar'
              }
            />
          </div>
          <div className="flex shrink-0 gap-2">
            {customerId && (
              <Link href="/private/accounts-receivable">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Ver Todas
                </Button>
              </Link>
            )}
            <Link href="/private/accounts-receivable/staff">
              <Button variant="outline" size="sm">
                <User className="mr-1.5 h-4 w-4" />
                Personal
              </Button>
            </Link>
            <Link href={PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE_NEW}>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Nueva Cuenta
              </Button>
            </Link>
          </div>
        </Panel>

        <div className="mb-3">
          <ResumenDeCartera
            resumen={resumen.data}
            cargando={resumen.isPending}
            error={resumen.error}
            reintentar={() => void resumen.refetch()}
            alcance={alcance}
          />
        </div>

        <AccountsReceivableFilters
          filtros={filtros}
          cambiar={cambiar}
          limpiarFechas={limpiarFechas}
          resultados={cuentas.length}
          buscando={buscando}
        />

        {/* Un solo estado vacío, y el fallo se ve como fallo: antes la lista
            devolvía `[]` ante un error de red y la pantalla decía "sin cuentas
            por cobrar", que es exactamente lo contrario de lo que pasaba. */}
        <EstadoDeBloque
          cargando={lista.isPending}
          error={lista.error}
          reintentar={() => void lista.refetch()}
          que="la lista de cuentas"
          motivoVacio="no porque no haya deuda"
          esqueleto={
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-line/50 bg-surface/60 p-4"
                >
                  <Esqueleto lineas={2} />
                </div>
              ))}
            </div>
          }
        >
          {cuentas.length > 0 ? (
            <AccountsReceivableList accounts={cuentas} tab={filtros.tab} />
          ) : (
            <Vacio
              hayFiltros={hayFiltros}
              deUnCliente={Boolean(customerId)}
              enHistorial={filtros.tab === 'history'}
              limpiar={limpiarTodo}
            />
          )}
        </EstadoDeBloque>
      </div>
    </div>
  );
}

/**
 * El vacío dice cuál de los tres vacíos es, porque el remedio es distinto:
 * no hay deuda (buena noticia), los filtros no dejan pasar nada (quitarlos),
 * o este cliente no debe nada.
 */
function Vacio({
  hayFiltros,
  deUnCliente,
  enHistorial,
  limpiar,
}: {
  hayFiltros: boolean;
  deUnCliente: boolean;
  enHistorial: boolean;
  limpiar: () => void;
}) {
  const titulo = hayFiltros
    ? 'Ningún resultado con estos filtros'
    : deUnCliente
      ? 'Este cliente no tiene cuentas'
      : enHistorial
        ? 'Todavía no hay cuentas pagadas'
        : 'No hay nada por cobrar';

  const detalle = hayFiltros
    ? 'Probá quitando la búsqueda o el rango de fechas.'
    : enHistorial
      ? 'Acá aparecen las cuentas una vez se saldan.'
      : 'Toda la cartera está al día.';

  return (
    <div className="rounded-xl border border-line/50 bg-surface/60 py-14 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-line bg-elevated">
        <CreditCard className="h-8 w-8 text-dim" />
      </div>
      <p className="mb-1 text-lg font-semibold text-content">{titulo}</p>
      <p className="mb-4 text-sm text-dim">{detalle}</p>
      {hayFiltros ? (
        <Button size="sm" variant="outline" onClick={limpiar}>
          Quitar filtros
        </Button>
      ) : (
        !enHistorial && (
          <Link href={PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE_NEW}>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Nueva cuenta
            </Button>
          </Link>
        )
      )}
    </div>
  );
}

'use client';
import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, RefreshCw } from 'lucide-react';
import Link from '@/shared/ui/AppLink/AppLink';
import Loader from '@/components/shared/Loader/Loader';
import { Button } from '@/components/shared/button/Button';
import { Panel } from '@/components/shared/panel/Panel';
import {
  IconoEnCuadro,
  TituloDePantalla,
} from '@/components/shared/cabecera/CabeceraDePantalla';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import {
  useSolicitudesDeCredito,
  type EstadoDeSolicitudes,
} from '../hooks/useSolicitudesDeCredito';
import { esPorDecidir } from '../utils/clasificarSolicitudes';
import { ModalesDeSolicitud } from './ModalesDeSolicitud';
import { TablaDeSolicitudes } from './TablaDeSolicitudes';

/** Pestaña de verificar pagos donde se deciden los creditos. */
export const PESTANA_CREDITOS = 'creditos';

interface Props {
  /**
   * - `completa`: la pantalla propia (`/private/pos/credit-requests`), con
   *   cabecera y boton de refrescar.
   * - `embebida`: la pestaña de verificar pagos; solo la tabla.
   * - `resumen`: el POS. Una linea con cuantas hay y un enlace a verificar
   *   pagos. El POS es una pantalla densa: la tabla entera le robaba el mapa
   *   de mesas, y con solicitudes de semanas colgadas no bajaba nunca de 25.
   */
  variante?: 'completa' | 'embebida' | 'resumen';
}

function Avisos({ estado }: { estado: EstadoDeSolicitudes }) {
  const { exito, error, modal } = estado;
  return (
    <>
      {exito && (
        <div
          role="status"
          className="p-3 bg-ok/15 border border-ok/30 rounded-lg flex items-center gap-3 text-ok"
        >
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">{exito}</span>
        </div>
      )}
      {/* El error del modal se muestra dentro del modal; este es el de la lista. */}
      {error && !modal.tipo && (
        <div
          role="alert"
          className="p-3 bg-danger/15 border border-danger/30 rounded-lg flex items-center gap-3 text-danger"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
    </>
  );
}

function Resumen({ estado }: { estado: EstadoDeSolicitudes }) {
  const { solicitudes } = estado;
  const porDecidir = useMemo(
    () => solicitudes.filter(esPorDecidir).length,
    [solicitudes],
  );
  const yaCobradas = solicitudes.length - porDecidir;
  if (solicitudes.length === 0) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
      <CreditCard className="h-4 w-4 text-brand" aria-hidden />
      <p className="text-sm text-content">
        <span className="font-semibold tabular-nums">
          {porDecidir} crédito{porDecidir === 1 ? '' : 's'} por decidir
        </span>
        {yaCobradas > 0 && (
          <span className="text-dim">
            {' '}
            · {yaCobradas} ya cobrada{yaCobradas === 1 ? '' : 's'} por cerrar
          </span>
        )}
      </p>
      <Link
        href={`${PRIVATE_ROUTES.VERIFY_PAYMENTS}?pestana=${PESTANA_CREDITOS}`}
        className="ml-auto text-sm font-semibold text-brand hover:underline"
      >
        Revisar solicitudes
      </Link>
    </div>
  );
}

/**
 * Las solicitudes de credito pendientes de autorizar.
 *
 * Un solo componente para las tres pantallas donde aparecen (la propia,
 * verificar pagos y el POS): copiar el PIN y los modales en tres sitios es
 * como se desincronizan. Aprobar en cualquiera invalida la misma query key,
 * asi que la solicitud desaparece de las otras sin tocar nada.
 */
export function SolicitudesDeCredito({ variante = 'completa' }: Props) {
  const estado = useSolicitudesDeCredito();
  const { solicitudes, cargando, refrescar } = estado;

  if (variante === 'resumen') {
    return cargando ? null : <Resumen estado={estado} />;
  }

  if (cargando) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader />
      </div>
    );
  }

  const cuerpo =
    solicitudes.length === 0 ? (
      <Panel className="p-12 text-center">
        <div className="w-12 h-12 bg-dim/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <CreditCard className="h-6 w-6 text-dim" />
        </div>
        <p className="text-content font-medium">
          No hay solicitudes de crédito pendientes
        </p>
        <p className="text-dim text-sm mt-1">
          Aquí aparecen las que piden los mesoneros desde el teléfono.
        </p>
      </Panel>
    ) : (
      <TablaDeSolicitudes estado={estado} />
    );

  return (
    <>
      <section className="space-y-3">
        {variante === 'completa' && (
          <Panel className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconoEnCuadro>
                <CreditCard className="w-5 h-5 text-brand" />
              </IconoEnCuadro>
              <TituloDePantalla
                titulo="Solicitudes de Crédito"
                subtitulo={`${solicitudes.length} pendiente${solicitudes.length === 1 ? '' : 's'}`}
              />
            </div>
            <Button
              onClick={refrescar}
              startIcon={<RefreshCw className="h-4 w-4" />}
              variant="outline"
            >
              Refrescar
            </Button>
          </Panel>
        )}
        <Avisos estado={estado} />
        {cuerpo}
      </section>

      <ModalesDeSolicitud estado={estado} />
    </>
  );
}

'use client';
import Modal from '@/components/shared/modal';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import {
  MOTIVO_YA_COBRADA,
  type EstadoDeSolicitudes,
} from '../hooks/useSolicitudesDeCredito';

const CLASES_DEL_MODAL =
  'bg-surface rounded-xl shadow-2xl max-w-sm w-full p-6 border border-line/50';

const CLASES_DEL_CAMPO =
  'w-full px-3 py-2 bg-elevated border border-line/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50';

function AvisoDeError({ mensaje }: { mensaje: string }) {
  return (
    <div
      role="alert"
      className="mb-4 p-3 bg-danger/15 border border-danger/30 rounded-lg flex items-center gap-2 text-danger"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm">{mensaje}</span>
    </div>
  );
}

const cuantas = (n: number) =>
  n === 1 ? 'esta solicitud' : `${n} solicitudes`;

/**
 * El modal que decide: autorizar con PIN, rechazar con motivo, o cerrar las
 * que ya se cobraron por otra via.
 *
 * El PIN se exige igual en las tres pantallas donde vive este bloque (la
 * pantalla propia, el POS y verificar pagos), y un solo PIN vale para todas
 * las marcadas. Embeber la caja NO relaja el candado: la API lo valida en
 * cada una.
 */
export function ModalesDeSolicitud({
  estado,
}: {
  estado: EstadoDeSolicitudes;
}) {
  const {
    modal,
    pin,
    motivo,
    error,
    progreso,
    trabajando,
    cerrarModal,
    setPin,
    setMotivo,
    confirmar,
  } = estado;

  if (!modal.tipo) return null;
  const n = modal.orderIds.length;

  const titulo = {
    autorizar: n === 1 ? 'Autorizar crédito' : `Autorizar ${n} créditos`,
    rechazar: n === 1 ? 'Rechazar solicitud' : `Rechazar ${n} solicitudes`,
    cerrar: n === 1 ? 'Cerrar solicitud ya cobrada' : `Cerrar ${n} ya cobradas`,
  }[modal.tipo];

  const accion = {
    autorizar: 'Autorizar',
    rechazar: 'Rechazar',
    cerrar: 'Cerrar',
  }[modal.tipo];

  const listoParaConfirmar =
    modal.tipo === 'autorizar'
      ? pin.length > 0
      : modal.tipo === 'rechazar'
        ? motivo.trim().length > 0
        : true;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={trabajando ? () => undefined : cerrarModal}
      classNameFondo="bg-black/50 backdrop-blur-sm"
      classNameWrap="p-4"
      className={CLASES_DEL_MODAL}
    >
      <h2 className="text-lg font-bold mb-2">{titulo}</h2>

      {modal.tipo === 'autorizar' && (
        <p className="text-sm text-dim mb-4">
          Se crea una cuenta por cobrar por {cuantas(n)}.
        </p>
      )}
      {modal.tipo === 'cerrar' && (
        <p className="text-sm text-dim mb-4">
          {`${n === 1 ? 'Se quita' : 'Se quitan'} de la lista con el motivo “${MOTIVO_YA_COBRADA}”. El cobro de la orden no cambia.`}
        </p>
      )}

      {error && <AvisoDeError mensaje={error} />}

      {modal.tipo === 'autorizar' && (
        <div className="mb-4">
          <label
            htmlFor="pin-credito"
            className="block text-sm font-medium text-content mb-2"
          >
            PIN de administrador
          </label>
          <input
            id="pin-credito"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && listoParaConfirmar) confirmar();
            }}
            placeholder="****"
            maxLength={6}
            disabled={trabajando}
            className={`${CLASES_DEL_CAMPO} text-center text-lg font-mono tracking-widest`}
            autoFocus
          />
        </div>
      )}

      {modal.tipo === 'rechazar' && (
        <div className="mb-4">
          <label
            htmlFor="motivo-rechazo"
            className="block text-sm font-medium text-content mb-2"
          >
            Motivo del rechazo
          </label>
          <textarea
            id="motivo-rechazo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey && listoParaConfirmar) {
                confirmar();
              }
            }}
            placeholder="Por qué no se da el crédito"
            disabled={trabajando}
            className={`${CLASES_DEL_CAMPO} resize-none h-24`}
            autoFocus
          />
        </div>
      )}

      {progreso && (
        <p className="text-sm text-dim mb-3 tabular-nums" aria-live="polite">
          Procesando {progreso.hechas} de {progreso.total}…
        </p>
      )}

      <div className="flex gap-3">
        <Button
          onClick={cerrarModal}
          variant="outline"
          className="flex-1"
          disabled={trabajando}
        >
          Cancelar
        </Button>
        <Button
          onClick={confirmar}
          variant={modal.tipo === 'autorizar' ? 'default' : 'destructive'}
          className="flex-1"
          disabled={trabajando || !listoParaConfirmar}
          startIcon={
            trabajando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : undefined
          }
        >
          {trabajando ? 'Procesando…' : accion}
        </Button>
      </div>
    </Modal>
  );
}

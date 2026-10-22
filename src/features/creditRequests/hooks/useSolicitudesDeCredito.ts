'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/services/api/apiClient';
import {
  usePendingCreditRequests,
  useApproveCreditRequest,
  useRejectCreditRequest,
} from '@/hooks/useCreditRequests';
import type { OrderWithCreditRequest } from '@odin6/types';

/**
 * Que se esta decidiendo, y sobre que ordenes.
 *
 * `cerrar` es un rechazo con motivo fijo: la solicitud se queda colgada
 * mientras la orden se cobra por otra via, y lo unico que falta es sacarla de
 * la lista dejando rastro de por que (el rechazo guarda quien y el motivo, y
 * no toca el cobro de la orden).
 */
export interface ModalDeSolicitud {
  tipo: 'autorizar' | 'rechazar' | 'cerrar' | null;
  orderIds: string[];
}

export const MOTIVO_YA_COBRADA = 'Ya cobrada por otra vía';

export interface EstadoDeSolicitudes {
  solicitudes: OrderWithCreditRequest[];
  cargando: boolean;
  refrescar: () => void;

  modal: ModalDeSolicitud;
  pin: string;
  motivo: string;
  error: string | null;
  exito: string | null;
  /** Cuantas lleva de las que se estan decidiendo en bloque. */
  progreso: { hechas: number; total: number } | null;
  trabajando: boolean;

  abrirAutorizar: (orderIds: string[]) => void;
  abrirRechazar: (orderIds: string[]) => void;
  abrirCerrar: (orderIds: string[]) => void;
  cerrarModal: () => void;
  setPin: (valor: string) => void;
  setMotivo: (valor: string) => void;
  confirmar: () => void;
}

const AVISO_VISIBLE_MS = 4000;
const MODAL_CERRADO: ModalDeSolicitud = { tipo: null, orderIds: [] };

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`;

/**
 * Todo el estado de la caja de solicitudes de credito, en un solo sitio.
 *
 * Decide una o varias a la vez: el mismo PIN autoriza todas las marcadas y el
 * mismo motivo rechaza todas. Se mandan de a una, en orden, porque cada
 * aprobacion crea su cuenta por cobrar y un PIN malo tiene que frenar en la
 * primera, no repetirse 25 veces.
 *
 * El sondeo NO vive aqui: esta en `usePendingCreditRequests`, para que montar
 * el bloque en tres pantallas siga costando una sola peticion.
 */
export function useSolicitudesDeCredito(): EstadoDeSolicitudes {
  const {
    data: solicitudes = [],
    isLoading,
    refetch,
  } = usePendingCreditRequests();
  const { mutateAsync: autorizar } = useApproveCreditRequest();
  const { mutateAsync: rechazar } = useRejectCreditRequest();

  const [modal, setModal] = useState<ModalDeSolicitud>(MODAL_CERRADO);
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<{
    hechas: number;
    total: number;
  } | null>(null);
  const temporizadorDelAviso = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Un aviso que sobreviva al desmontaje deja un setState sobre un componente
  // muerto; y en el POS esta caja se monta y desmonta sola al vaciarse.
  useEffect(
    () => () => {
      if (temporizadorDelAviso.current) {
        clearTimeout(temporizadorDelAviso.current);
      }
    },
    [],
  );

  const avisar = useCallback((mensaje: string) => {
    setExito(mensaje);
    if (temporizadorDelAviso.current) {
      clearTimeout(temporizadorDelAviso.current);
    }
    temporizadorDelAviso.current = setTimeout(
      () => setExito(null),
      AVISO_VISIBLE_MS,
    );
  }, []);

  const cerrarModal = useCallback(() => {
    setModal(MODAL_CERRADO);
    setPin('');
    setMotivo('');
    setError(null);
  }, []);

  const abrir = useCallback(
    (tipo: NonNullable<ModalDeSolicitud['tipo']>, orderIds: string[]) => {
      if (orderIds.length === 0) return;
      setPin('');
      setMotivo('');
      setError(null);
      setModal({ tipo, orderIds });
    },
    [],
  );
  const abrirAutorizar = useCallback(
    (ids: string[]) => abrir('autorizar', ids),
    [abrir],
  );
  const abrirRechazar = useCallback(
    (ids: string[]) => abrir('rechazar', ids),
    [abrir],
  );
  const abrirCerrar = useCallback(
    (ids: string[]) => abrir('cerrar', ids),
    [abrir],
  );

  /**
   * Pasa `accion` por cada orden, de a una. Devuelve cuantas salieron bien y
   * el primer error; con `frenarSi` se corta al primer error de ese tipo.
   */
  const enSerie = useCallback(
    async (
      ids: string[],
      accion: (id: string) => Promise<unknown>,
      frenarSi: (err: unknown) => boolean,
    ) => {
      let bien = 0;
      let primerError: unknown = null;
      setProgreso({ hechas: 0, total: ids.length });
      for (const id of ids) {
        try {
          await accion(id);
          bien += 1;
        } catch (err: unknown) {
          primerError = primerError ?? err;
          if (frenarSi(err)) break;
        }
        setProgreso({ hechas: bien, total: ids.length });
      }
      setProgreso(null);
      return { bien, primerError };
    },
    [],
  );

  const confirmar = useCallback(async () => {
    const { tipo, orderIds } = modal;
    if (!tipo || orderIds.length === 0) return;
    setError(null);

    if (tipo === 'autorizar') {
      if (!pin) {
        setError('El PIN es obligatorio');
        return;
      }
      // El 401 de este endpoint siempre es el PIN: si falla una, fallan todas.
      const esPinMalo = (err: unknown) =>
        err instanceof ApiError && err.status === 401;
      const { bien, primerError } = await enSerie(
        orderIds,
        (orderId) => autorizar({ orderId, pin }),
        esPinMalo,
      );
      if (esPinMalo(primerError) && bien === 0) {
        setError('PIN inválido');
        return;
      }
      if (primerError) {
        setError(
          `Se aprobaron ${bien} de ${orderIds.length}. ` +
            (primerError instanceof Error
              ? primerError.message
              : 'Revisa las que quedaron.'),
        );
        return;
      }
      avisar(
        `${plural(bien, 'crédito aprobado', 'créditos aprobados')}: cuentas por cobrar creadas`,
      );
      cerrarModal();
      return;
    }

    const razon = tipo === 'cerrar' ? MOTIVO_YA_COBRADA : motivo.trim();
    if (!razon) {
      setError('El motivo es obligatorio');
      return;
    }
    const { bien, primerError } = await enSerie(
      orderIds,
      (orderId) => rechazar({ orderId, reason: razon }),
      () => false,
    );
    if (primerError) {
      setError(
        `Se cerraron ${bien} de ${orderIds.length}. ` +
          (primerError instanceof Error ? primerError.message : ''),
      );
      return;
    }
    avisar(
      tipo === 'cerrar'
        ? `${plural(bien, 'solicitud cerrada', 'solicitudes cerradas')} como ya cobradas`
        : `${plural(bien, 'solicitud rechazada', 'solicitudes rechazadas')}`,
    );
    cerrarModal();
  }, [modal, pin, motivo, enSerie, autorizar, rechazar, avisar, cerrarModal]);

  const refrescar = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    solicitudes,
    cargando: isLoading,
    refrescar,
    modal,
    pin,
    motivo,
    error,
    exito,
    progreso,
    trabajando: progreso !== null,
    abrirAutorizar,
    abrirRechazar,
    abrirCerrar,
    cerrarModal,
    setPin,
    setMotivo,
    confirmar: () => void confirmar(),
  };
}

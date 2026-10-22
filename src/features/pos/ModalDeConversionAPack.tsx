'use client';

import React, { useState } from 'react';
import Modal from '@/components/shared/modal';
import { Button } from '@/components/shared/button/Button';
import { formatearUsd } from '@/shared/utils/dinero';
import type { OpcionConversion } from '@/hooks/usePackConversion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  opciones: OpcionConversion[];
  /** Devuelve una promesa: el modal se queda abierto mientras guarda. */
  onConfirmar: (
    opcion: OpcionConversion,
    packsToConvert: number,
  ) => Promise<void>;
  guardando?: boolean;
}

/**
 * Las conversiones disponibles, para que la PERSONA elija.
 *
 * Reemplaza el boton de "convertir todo" que tenia la web, que tomaba todas
 * las lineas elegibles de la orden y las convertia de un toque sin preguntar
 * cual ni cuantas. Regla del dueno (20/09/2026): **convertir es una opcion, no
 * una obligacion**. El sistema ofrece; nunca convierte solo.
 *
 * Los precios que se muestran vienen del servidor, que los saca del catalogo.
 * Esta pantalla no calcula dinero.
 */
const ModalDeConversionAPack: React.FC<Props> = ({
  isOpen,
  onClose,
  opciones,
  onConfirmar,
  guardando = false,
}) => {
  const [elegida, setElegida] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);

  const claveDe = (o: OpcionConversion) =>
    `${o.sourceProductId}:${o.targetPackId}`;

  const opcion = opciones.find((o) => claveDe(o) === elegida) ?? null;

  const cerrar = () => {
    setElegida(null);
    setCantidad(1);
    onClose();
  };

  const seleccionar = (o: OpcionConversion) => {
    setElegida(claveDe(o));
    setCantidad(1);
  };

  const confirmar = async () => {
    if (!opcion) return;
    await onConfirmar(opcion, cantidad);
    setElegida(null);
    setCantidad(1);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={cerrar}
      titulo="Convertir a tobo o caja"
      descripcion="Solo se puede convertir lo que ya se entregó. Elegí qué presentación y cuántas."
      hojaEnMovil
      pie={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!opcion || guardando}>
            {guardando ? 'Convirtiendo…' : 'Convertir'}
          </Button>
        </div>
      }
    >
      {opciones.length === 0 ? (
        <p className="text-dim py-6 text-center text-sm">
          No hay nada para convertir. Hacen falta al menos 12 unidades
          entregadas del mismo producto.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {opciones.map((o) => {
            const seleccionada = claveDe(o) === elegida;
            return (
              <li key={claveDe(o)}>
                <button
                  type="button"
                  onClick={() => seleccionar(o)}
                  aria-pressed={seleccionada}
                  className={`border-line w-full rounded-lg border p-3 text-left transition ${
                    seleccionada
                      ? 'border-brand bg-brand/10'
                      : 'hover:border-line-hover'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-content font-medium">
                      {o.packName}
                    </span>
                    <span className="text-content font-semibold">
                      {formatearUsd(o.packPrice)}
                    </span>
                  </div>
                  <p className="text-dim mt-1 text-xs">
                    {o.currentDeliveredQty} {o.sourceProductName} entregadas ·
                    alcanza para {o.numPacksPossible}
                    {o.numPacksPossible === 1 ? '' : ' packs'}
                    {o.savingsUsd > 0
                      ? ` · ahorra ${formatearUsd(o.savingsUsd)}`
                      : ''}
                  </p>
                </button>

                {seleccionada && o.numPacksPossible > 1 && (
                  <label className="text-dim mt-2 flex items-center gap-2 pl-3 text-xs">
                    ¿Cuántas?
                    <select
                      className="border-line bg-surface text-content rounded border px-2 py-1"
                      value={cantidad}
                      onChange={(e) => setCantidad(Number(e.target.value))}
                    >
                      {Array.from(
                        { length: o.numPacksPossible },
                        (_, i) => i + 1,
                      ).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};

export default ModalDeConversionAPack;

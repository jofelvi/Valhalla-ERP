'use client';

import { PantallaSeccion } from '../components/PantallaSeccion';
import {
  CampoCasilla,
  CampoSelect,
  CampoTexto,
  Grupo,
} from '../components/Campos';
import { useFormularioConfig } from '../hooks/useFormularioConfig';
import { ejemploServicio } from '../lib/ejemplos';
import { formatearMonto } from '../lib/formato';
import type { TarifasConfig } from '@odin6/types';
import { aFormulario, aValor, tarifasEsquema } from './tarifasFormulario';

const OPCIONES_SERVICIO = [
  { valor: 'additional', texto: 'Se suma a la cuenta' },
  { valor: 'included', texto: 'Ya viene incluido en el precio' },
  { valor: 'none', texto: 'No hay servicio' },
];

export function TarifasForm() {
  const vista = useFormularioConfig({
    id: 'tarifas',
    nombre: 'Tarifas',
    esquema: tarifasEsquema,
    aFormulario,
    aValor,
  });
  const { register, watch, formState } = vista.form;
  const { errors } = formState;
  const valores = watch();
  const impuestoActivo = watch('impuestoActivo');

  // Mientras un número esté a medias no hay ejemplo que calcular.
  const vivas: TarifasConfig | null =
    Number.isFinite(valores.servicePct) && Number.isFinite(valores.taxPct)
      ? aValor(valores)
      : null;

  return (
    <PantallaSeccion
      titulo="Tarifas"
      descripcion="Cómo se cobra la cuenta: moneda, servicio del mesonero, impuesto y propinas."
      vista={vista}
    >
      <Grupo titulo="Monedas">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            id="baseCurrency"
            etiqueta="Moneda base"
            registro={register('baseCurrency')}
            error={errors.baseCurrency}
            ayuda="Moneda en la que fija los precios. Código de 3 letras, ej. USD."
            maxLength={3}
          />
          <CampoTexto
            id="secondaryCurrency"
            etiqueta="Moneda secundaria"
            registro={register('secondaryCurrency')}
            error={errors.secondaryCurrency}
            ayuda="Opcional: moneda extra en la que también se cobra, ej. VES. Déjela vacía si cobra en una sola."
            maxLength={3}
          />
        </div>
      </Grupo>

      <Grupo
        titulo="Servicio del mesonero"
        descripcion="Es el porcentaje que se cobra por el servicio. Mire el ejemplo para ver cómo queda la cuenta."
      >
        <CampoSelect
          id="serviceMode"
          etiqueta="Cómo se cobra el servicio"
          registro={register('serviceMode')}
          opciones={OPCIONES_SERVICIO}
          error={errors.serviceMode}
          ayuda="«Se suma» agrega el porcentaje al total. «Incluido» no suma nada: el precio ya lo trae."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            id="servicePct"
            etiqueta="Porcentaje del servicio"
            registro={register('servicePct', { valueAsNumber: true })}
            error={errors.servicePct}
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={50}
            ayuda="Ej. 10 para el diez por ciento."
          />
        </div>
        <CampoCasilla
          id="serviceOnlyWithWaiter"
          etiqueta="Cobrar servicio solo si la cuenta tiene mesonero"
          descripcion="Las ventas de caja, sin mesonero, no llevan servicio."
          registro={register('serviceOnlyWithWaiter')}
        />

        <EjemploServicio vivas={vivas} />
      </Grupo>

      <Grupo titulo="Impuesto">
        <p
          role="note"
          className="rounded-xl border border-warning bg-surface p-3 text-sm text-content"
        >
          <span className="font-semibold text-warning">Decisión fiscal.</span>{' '}
          Confirme con su contador antes de activar el impuesto y su tasa.
        </p>
        <CampoCasilla
          id="impuestoActivo"
          etiqueta="Cobrar impuesto"
          registro={register('impuestoActivo')}
          interruptor
        />
        {impuestoActivo && (
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto
              id="taxLabel"
              etiqueta="Nombre del impuesto"
              registro={register('taxLabel')}
              error={errors.taxLabel}
              ayuda="Cómo sale en el ticket, ej. IVA."
            />
            <CampoTexto
              id="taxPct"
              etiqueta="Tasa del impuesto"
              registro={register('taxPct', { valueAsNumber: true })}
              error={errors.taxPct}
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0}
              max={50}
              ayuda="Ej. 16 para el dieciséis por ciento."
            />
          </div>
        )}
        {impuestoActivo && (
          <div className="space-y-3">
            <CampoCasilla
              id="impuestoIncluido"
              etiqueta="Los precios ya incluyen el impuesto"
              descripcion="Si está marcado, el impuesto se muestra pero no se suma al total."
              registro={register('impuestoIncluido')}
            />
            <CampoCasilla
              id="impuestoSobreServicio"
              etiqueta="El servicio también paga impuesto"
              descripcion="Por defecto no. Es otra decisión fiscal: confírmela con su contador."
              registro={register('impuestoSobreServicio')}
            />
          </div>
        )}
      </Grupo>

      <Grupo titulo="Propinas sugeridas">
        <CampoTexto
          id="propinas"
          etiqueta="Porcentajes sugeridos"
          registro={register('propinas')}
          error={errors.propinas}
          ayuda="Ej. 10, 15, 20. Déjelo vacío si no quiere sugerencias. Máximo 6."
        />
      </Grupo>
    </PantallaSeccion>
  );
}

/** Lo que paga el cliente según el modo elegido, calculado con la misma fórmula que la caja. */
function EjemploServicio({ vivas }: { vivas: TarifasConfig | null }) {
  if (!vivas) {
    return (
      <p role="status" className="text-sm text-dim">
        Complete el porcentaje para ver el ejemplo.
      </p>
    );
  }
  const cuenta = 100;
  const e = ejemploServicio(cuenta, vivas);
  const m = (n: number) => formatearMonto(n, vivas.baseCurrency);

  let frase: string;
  if (vivas.serviceMode === 'additional') {
    frase = `Una cuenta de ${m(cuenta)} con mesonero → el cliente paga ${m(e.pagaConMesonero)}, de los cuales ${m(e.servicio)} es servicio.`;
  } else if (vivas.serviceMode === 'included') {
    frase = `Una cuenta de ${m(cuenta)} con mesonero → el cliente paga ${m(e.pagaConMesonero)}. El servicio de ${m(e.incluido)} ya viene incluido en los precios.`;
  } else {
    frase = `Una cuenta de ${m(cuenta)} con mesonero → el cliente paga ${m(e.pagaConMesonero)}. No hay servicio.`;
  }

  const lineas = [frase];
  if (vivas.serviceMode !== 'none' && vivas.serviceOnlyWithWaiter) {
    lineas.push(
      `Sin mesonero (venta en caja) → el cliente paga ${m(e.pagaSinMesonero)}, sin servicio.`,
    );
  }
  if (vivas.tax.enabled) {
    lineas.push(
      `${vivas.tax.label} de esa cuenta: ${m(e.impuesto)}, ${vivas.tax.includedInPrice ? 'ya incluido en los precios' : 'sumado al total'}.`,
    );
  }

  return (
    <div
      aria-live="polite"
      className="space-y-2 rounded-xl border border-brand/40 bg-elevated p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        Ejemplo con su configuración
      </p>
      {lineas.map((l) => (
        <p key={l} className="text-sm text-content">
          {l}
        </p>
      ))}
    </div>
  );
}

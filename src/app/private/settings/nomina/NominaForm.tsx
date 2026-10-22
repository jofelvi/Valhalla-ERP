'use client';

import { useFieldArray } from 'react-hook-form';
import {
  TARIFAS_DEFAULT,
  type NominaConfig,
  type TarifasConfig,
} from '@odin6/types';
import { Button } from '@/shared';
import { useConfigDoc } from '@/shared/config';
import { PantallaSeccion } from '../components/PantallaSeccion';
import {
  CampoCasilla,
  CampoSelect,
  CampoTexto,
  Grupo,
} from '../components/Campos';
import { useFormularioConfig } from '../hooks/useFormularioConfig';
import { ejemploComision } from '../lib/ejemplos';
import { formatearMonto } from '../lib/formato';
import {
  aFormulario,
  aValor,
  MAX_RETENCIONES,
  nominaEsquema,
} from './nominaFormulario';

const BASES = [
  { valor: 'sales', texto: 'Sobre las ventas del mesonero' },
  { valor: 'service', texto: 'Sobre el servicio que cobró' },
];

export function NominaForm() {
  const vista = useFormularioConfig({
    id: 'nomina',
    nombre: 'Nómina',
    esquema: nominaEsquema,
    aFormulario,
    aValor,
  });
  const { register, watch, control, formState } = vista.form;
  const { errors } = formState;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'retenciones',
  });
  const valores = watch();

  // La comisión con "servicio" necesita la tasa de servicio de Tarifas: se lee de ahí.
  const tarifasQuery = useConfigDoc('tarifas');
  const tarifas = tarifasQuery.data?.valor ?? TARIFAS_DEFAULT;

  const vivas: NominaConfig | null =
    Number.isFinite(valores.comisionPct) &&
    Number.isFinite(valores.descuentoEmpleadosPct)
      ? aValor(valores)
      : null;

  return (
    <PantallaSeccion
      titulo="Nómina"
      descripcion="Cuánto gana el mesonero por sus ventas, y qué se descuenta del pago."
      vista={vista}
    >
      <Grupo titulo="Comisión del mesonero">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            id="comisionPct"
            etiqueta="Porcentaje de comisión"
            registro={register('comisionPct', { valueAsNumber: true })}
            error={errors.comisionPct}
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={100}
            ayuda="Ej. 7 para el siete por ciento."
          />
          <CampoSelect
            id="baseComision"
            etiqueta="Sobre qué se paga"
            registro={register('baseComision')}
            opciones={BASES}
            error={errors.baseComision}
          />
        </div>
        <CampoCasilla
          id="excluirCortesias"
          etiqueta="Las cortesías no generan comisión"
          descripcion="Una cortesía es algo que la casa invita: no entra dinero real que repartir."
          registro={register('excluirCortesias')}
        />
        <EjemploComision nomina={vivas} tarifas={tarifas} />
      </Grupo>

      <Grupo
        titulo="Descuento a empleados"
        descripcion="Lo que el empleado paga cuando consume en el local."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            id="descuentoEmpleadosPct"
            etiqueta="Descuento a empleados"
            registro={register('descuentoEmpleadosPct', {
              valueAsNumber: true,
            })}
            error={errors.descuentoEmpleadosPct}
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={100}
            ayuda="Ej. 10 para el diez por ciento."
          />
        </div>
      </Grupo>

      <Grupo
        titulo="Retenciones de ley"
        descripcion={`Se descuentan del pago. Puede poner hasta ${MAX_RETENCIONES}. Déjelo vacío si no aplica ninguna.`}
      >
        {fields.length === 0 && (
          <p className="text-sm text-dim">No hay retenciones configuradas.</p>
        )}
        <ul className="space-y-4">
          {fields.map((campo, i) => (
            <li
              key={campo.id}
              className="grid gap-3 rounded-xl border border-line bg-elevated/40 p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
            >
              <CampoTexto
                id={`retencion-${i}-etiqueta`}
                etiqueta={`Nombre de la retención ${i + 1}`}
                registro={register(`retenciones.${i}.etiqueta`)}
                error={errors.retenciones?.[i]?.etiqueta}
                placeholder="ej. ISLR"
              />
              <CampoTexto
                id={`retencion-${i}-porcentaje`}
                etiqueta={`Porcentaje ${i + 1}`}
                registro={register(`retenciones.${i}.porcentaje`, {
                  valueAsNumber: true,
                })}
                error={errors.retenciones?.[i]?.porcentaje}
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                max={50}
              />
              <Button type="button" variant="ghost" onClick={() => remove(i)}>
                Quitar
                <span className="sr-only"> retención {i + 1}</span>
              </Button>
            </li>
          ))}
        </ul>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={fields.length >= MAX_RETENCIONES}
            onClick={() => append({ etiqueta: '', porcentaje: 1 })}
          >
            Agregar retención
          </Button>
        </div>
      </Grupo>
    </PantallaSeccion>
  );
}

/** Ejemplo vivo: misma fórmula que la caja (`computeOrderTotals` + `calcularComision`). */
function EjemploComision({
  nomina,
  tarifas,
}: {
  nomina: NominaConfig | null;
  tarifas: TarifasConfig;
}) {
  if (!nomina) {
    return (
      <p role="status" className="text-sm text-dim">
        Complete los porcentajes para ver el ejemplo.
      </p>
    );
  }
  const e = ejemploComision(nomina, tarifas);
  const m = (n: number) => formatearMonto(n, tarifas.baseCurrency);
  const base =
    nomina.commissionBasis === 'service'
      ? 'el servicio de esas ventas'
      : 'las ventas';
  return (
    <div
      aria-live="polite"
      className="space-y-2 rounded-xl border border-brand/40 bg-elevated p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        Ejemplo con su configuración
      </p>
      <p className="text-sm text-content">
        Una cuenta de {m(e.cuenta)} con mesonero y una cortesía de{' '}
        {m(e.cortesia)}: la comisión se calcula sobre {base}, que da{' '}
        {m(e.comisionBase)}. El mesonero recibe {m(e.comision)}.
      </p>
      <p className="text-sm text-dim">
        {nomina.excludeComplimentaryFromCommission
          ? 'La cortesía no genera comisión.'
          : 'La cortesía sí genera comisión.'}
      </p>
    </div>
  );
}

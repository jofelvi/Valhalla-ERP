'use client';

import { PantallaSeccion } from '../components/PantallaSeccion';
import { CampoSelect, CampoTexto, Grupo } from '../components/Campos';
import { useFormularioConfig } from '../hooks/useFormularioConfig';
import { horaEnZona } from '../lib/formato';
import { ZONAS_COMUNES } from '../lib/zonasHorarias';
import { aFormulario, aValor, operacionEsquema } from './operacionFormulario';

const DIAS = [
  { valor: '0', texto: 'Domingo' },
  { valor: '1', texto: 'Lunes' },
  { valor: '2', texto: 'Martes' },
  { valor: '3', texto: 'Miércoles' },
  { valor: '4', texto: 'Jueves' },
  { valor: '5', texto: 'Viernes' },
  { valor: '6', texto: 'Sábado' },
];

const HORAS = Array.from({ length: 24 }, (_, h) => ({
  valor: String(h),
  texto: `${String(h).padStart(2, '0')}:00`,
}));

export function OperacionForm() {
  const vista = useFormularioConfig({
    id: 'operacion',
    nombre: 'Operación',
    esquema: operacionEsquema,
    aFormulario,
    aValor,
  });
  const { register, watch, formState } = vista.form;
  const { errors } = formState;
  const zona = watch('timezone');
  const locale = watch('locale');
  const hora = horaEnZona(zona, locale);

  return (
    <PantallaSeccion
      titulo="Operación"
      descripcion="Dónde está el negocio y cómo se cuenta el día y la semana. Los informes usan estos datos."
      vista={vista}
    >
      <Grupo titulo="Lugar">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            id="country"
            etiqueta="País"
            registro={register('country')}
            error={errors.country}
            maxLength={2}
            ayuda="Código de 2 letras, ej. VE."
          />
          <CampoTexto
            id="phonePrefix"
            etiqueta="Prefijo telefónico"
            registro={register('phonePrefix')}
            error={errors.phonePrefix}
            inputMode="numeric"
            ayuda="Sin el signo +. Ej. 58 para Venezuela."
          />
          <CampoTexto
            id="timezone"
            etiqueta="Zona horaria"
            registro={register('timezone')}
            error={errors.timezone}
            list="zonas-horarias"
            autoComplete="off"
            ayuda="Elija de la lista o escriba otra zona válida."
          />
          <CampoTexto
            id="locale"
            etiqueta="Idioma y formato"
            registro={register('locale')}
            error={errors.locale}
            ayuda="Ej. es-VE para español de Venezuela."
          />
        </div>
        <datalist id="zonas-horarias">
          {ZONAS_COMUNES.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <p role="status" aria-live="polite" className="text-sm text-dim">
          {hora
            ? `Ahora en esa zona: ${hora}.`
            : 'Revise la zona horaria para ver la hora actual.'}
        </p>
      </Grupo>

      <Grupo titulo="Día y semana">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelect
            id="businessDayStartHour"
            etiqueta="Hora en que empieza el día"
            registro={register('businessDayStartHour', { valueAsNumber: true })}
            opciones={HORAS}
            error={errors.businessDayStartHour}
            ayuda="Lo vendido antes de esta hora cuenta para el día anterior. Ej. 06:00 si cierra de madrugada."
          />
          <CampoSelect
            id="weekStartsOn"
            etiqueta="Día en que empieza la semana"
            registro={register('weekStartsOn', { valueAsNumber: true })}
            opciones={DIAS}
            error={errors.weekStartsOn}
            ayuda="Los cuadres semanales van de este día a seis días después."
          />
        </div>
      </Grupo>
    </PantallaSeccion>
  );
}

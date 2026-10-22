'use client';

import * as yup from 'yup';
import {
  VOCAB_CLAVES,
  VOCABULARIO_DEFAULT,
  type VocabKey,
  type VocabularioConfig,
} from '@odin6/types';
import { PantallaSeccion } from '../components/PantallaSeccion';
import { CampoTexto, Grupo } from '../components/Campos';
import { useFormularioConfig } from '../hooks/useFormularioConfig';

const ETIQUETAS: Readonly<Record<VocabKey, string>> = {
  waiter: 'Mesonero (una persona)',
  waiters: 'Mesoneros (varias)',
  cashier: 'Cajero (una persona)',
  cashiers: 'Cajeros (varias)',
  kitchen: 'Cocina',
  bar: 'Barra',
  table: 'Mesa (una)',
  tables: 'Mesas (varias)',
  zone: 'Zona del local',
  tab: 'Cuenta de la mesa',
  service: 'Servicio',
};

const esquema = yup.object(
  Object.fromEntries(
    VOCAB_CLAVES.map((clave) => [
      clave,
      yup
        .string()
        .defined()
        .trim()
        .required('Escriba una palabra.')
        .max(30, 'Máximo 30 caracteres.'),
    ]),
  ),
);

const aFormulario = (v: VocabularioConfig): VocabularioConfig => ({ ...v });
const aValor = (f: VocabularioConfig): VocabularioConfig => ({ ...f });

export function VocabularioForm() {
  const vista = useFormularioConfig({
    id: 'vocabulario',
    nombre: 'Vocabulario',
    esquema,
    aFormulario,
    aValor,
  });
  const { register, watch, formState } = vista.form;
  const { errors } = formState;
  const v = watch();
  const etiqueta = (clave: VocabKey) =>
    v[clave]?.trim() || VOCABULARIO_DEFAULT[clave];

  return (
    <PantallaSeccion
      titulo="Vocabulario"
      descripcion="Cambie los nombres que ve el personal en la pantalla. Solo cambia lo que se lee: la aplicación sigue funcionando igual."
      vista={vista}
    >
      <Grupo titulo="Palabras">
        <div className="grid gap-4 sm:grid-cols-2">
          {VOCAB_CLAVES.map((clave) => (
            <CampoTexto
              key={clave}
              id={`voc-${clave}`}
              etiqueta={ETIQUETAS[clave]}
              registro={register(clave)}
              error={errors[clave]}
              maxLength={30}
              ayuda={`Por defecto: ${VOCABULARIO_DEFAULT[clave]}`}
            />
          ))}
        </div>
      </Grupo>

      <Grupo
        titulo="Así se leerá"
        descripcion="Una muestra con sus palabras. Se actualiza mientras escribe."
      >
        <div
          aria-live="polite"
          className="space-y-2 rounded-xl border border-line bg-elevated p-4 text-sm text-content"
        >
          <p>
            {etiqueta('zone')}: Terraza · {etiqueta('table')} 4 ·{' '}
            {etiqueta('waiter')}: Ana
          </p>
          <p>
            {etiqueta('tab')} de {etiqueta('table').toLowerCase()} 4: $25,00
            (incluye {etiqueta('service').toLowerCase()} de $2,50)
          </p>
          <p>
            Enviar a {etiqueta('kitchen')} y a {etiqueta('bar')}. Cobra{' '}
            {etiqueta('cashier').toLowerCase()}: Luis.
          </p>
        </div>
      </Grupo>
    </PantallaSeccion>
  );
}

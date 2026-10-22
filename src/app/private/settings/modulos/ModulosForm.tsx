'use client';

import * as yup from 'yup';
import {
  MODULO_CLAVES,
  type ModuloKey,
  type ModulosConfig,
} from '@odin6/types';
import { PantallaSeccion } from '../components/PantallaSeccion';
import { CampoCasilla, Grupo } from '../components/Campos';
import { useFormularioConfig } from '../hooks/useFormularioConfig';

interface InfoModulo {
  titulo: string;
  que: string;
}

/** Qué hace cada módulo opcional, en una línea, para quien decide si lo enciende. */
const INFO_MODULOS: Readonly<Record<ModuloKey, InfoModulo>> = {
  partners: {
    titulo: 'Socios',
    que: 'Lleva la participación de los socios en las ventas y su cuadre semanal.',
  },
  packsAndBuckets: {
    titulo: 'Packs y tobos',
    que: 'Vende paquetes o cubetas de varios productos y descuenta cada unidad del inventario.',
  },
  barTokens: {
    titulo: 'Fichas de barra',
    que: 'Entrega de bebidas en barra con fichas, para controlar que cada consumo se cobre.',
  },
  telegramBot: {
    titulo: 'Bot de Telegram para gastos',
    que: 'Permite registrar gastos mandando la foto de la factura a un bot de Telegram.',
  },
  currencyWatcher: {
    titulo: 'Vigilante de divisas',
    que: 'Revisa la tasa de cambio cada día y avisa cuando sube o baja.',
  },
  bankReconciliation: {
    titulo: 'Conciliación bancaria',
    que: 'Compara los pagos recibidos con los movimientos del banco para detectar diferencias.',
  },
  productBonus: {
    titulo: 'Bono por producto',
    que: 'Paga un bono al personal por cada producto que vende.',
  },
  connectedTable: {
    titulo: 'Mesa conectada (QR)',
    que: 'El cliente abre su cuenta desde el código QR de la mesa y escribe al mesonero desde su celular.',
  },
  reservations: {
    titulo: 'Reservas',
    que: 'Muestra la agenda de reservas de mesas y eventos.',
  },
};

const esquema = yup.object(
  Object.fromEntries(
    MODULO_CLAVES.map((clave) => [clave, yup.boolean().defined()]),
  ),
);

const aFormulario = (m: ModulosConfig): ModulosConfig => ({ ...m });
const aValor = (f: ModulosConfig): ModulosConfig => ({ ...f });

export function ModulosForm() {
  const vista = useFormularioConfig({
    id: 'modulos',
    nombre: 'Módulos',
    esquema,
    aFormulario,
    aValor,
  });
  const { register, watch } = vista.form;
  const valores = watch();

  return (
    <PantallaSeccion
      titulo="Módulos"
      descripcion="Encienda solo lo que su negocio usa. Un módulo apagado no aparece en el menú."
      vista={vista}
    >
      <p className="text-sm text-dim">
        Órdenes, cobro, productos, caja, nómina e inventario están siempre
        activos: no se apagan.
      </p>

      <Grupo titulo="Funciones opcionales">
        <ul className="space-y-5">
          {MODULO_CLAVES.map((clave) => {
            const info = INFO_MODULOS[clave];
            const encendido = Boolean(valores[clave]);
            const estado = encendido
              ? 'Encendido.'
              : 'Apagado: no aparecerá en el menú.';
            return (
              <li key={clave} className="space-y-1">
                <CampoCasilla
                  id={`mod-${clave}`}
                  etiqueta={info.titulo}
                  descripcion={`${info.que} ${estado}`}
                  registro={register(clave)}
                  interruptor
                />
              </li>
            );
          })}
        </ul>
      </Grupo>
    </PantallaSeccion>
  );
}

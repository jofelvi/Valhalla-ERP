import { ReleaseAmbitoEnum, type ReleaseAmbito } from '@odin6/types';

/**
 * Decide si un despliegue se puede revertir.
 *
 * La base de datos NO vuelve atras con el codigo: revertir a antes de una
 * migracion deja dato nuevo corriendo sobre codigo viejo, que es como se
 * corrompieron inventario y dinero (el x12 de Pilsen, la herencia de
 * `inventoryConsumedQty` que no se heredaba en el PATCH). Por eso una
 * migracion posterior bloquea.
 *
 * Puro a proposito: sin Nest, sin Mongoose, testeable solo.
 */
export interface EntradaParaReversion {
  id: string;
  fecha: Date;
  ambito: ReleaseAmbito[];
  shas: { web?: string; api?: string };
  migroDatos: boolean;
  titulo: string;
  version?: string;
}

export interface VeredictoReversion {
  reversible: boolean;
  motivo?: string;
}

export const puedeRevertirse = (
  objetivo: EntradaParaReversion,
  ambito: ReleaseAmbito,
  posteriores: EntradaParaReversion[],
): VeredictoReversion => {
  if (ambito === ReleaseAmbitoEnum.APK) {
    return {
      reversible: false,
      motivo:
        'El APK esta instalado en los telefonos: no se puede revertir a distancia.',
    };
  }

  if (!objetivo.ambito.includes(ambito)) {
    return { reversible: false, motivo: `Esta entrada no toco ${ambito}.` };
  }

  const sha =
    ambito === ReleaseAmbitoEnum.WEB ? objetivo.shas?.web : objetivo.shas?.api;
  if (!sha) {
    return {
      reversible: false,
      motivo:
        'No se guardo el commit desplegado, asi que no hay a donde volver.',
    };
  }

  const bloqueante = posteriores.find(
    (e) =>
      e.fecha > objetivo.fecha && e.ambito.includes(ambito) && e.migroDatos,
  );
  if (bloqueante) {
    return {
      reversible: false,
      motivo:
        `"${bloqueante.titulo}" movio datos despues de esta version. ` +
        'Volver aqui dejaria datos nuevos corriendo sobre codigo viejo.',
    };
  }

  return { reversible: true };
};

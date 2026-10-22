import { ProductTypeEnum } from '@odin6/types';
import {
  ProductForRecipeCost,
  expandRecipeIngredients,
} from '../inventory/recipe-cost.helper';

/**
 * NATURALEZA DEL PRODUCTO — la única pregunta que decide qué sale del almacén.
 *
 * Antes convivían dos banderas que decían lo mismo por vías distintas (`type`
 * BASE/COMPUESTO e `isForInventory`) y se contradecían: el 03/09/2026 había 136
 * productos vendibles que no descontaban NADA y nadie se enteraba, y 21 con
 * receta marcados BASE que la ficha web borraba al guardar. Los tobos, marcados
 * "insumo", descontaban un stock fantasma de sí mismos en vez de las cervezas.
 *
 * Ahora `type` es la única fuente e `isForInventory` se DERIVA de él (se guarda
 * porque lo leen el consumo, los pickers de insumos y la auditoría).
 *
 *   INSUMO    (BASE)      se compra y se descuenta a sí mismo
 *   PREPARADO (COMPUESTO) receta obligatoria: salen sus ingredientes con merma
 *   SERVICIO  (SERVICIO)  no toca inventario A PROPÓSITO
 *   PENDIENTE             legacy sin decidir: no descuenta, pero deja rastro
 *
 * Regla del dueño: si al venderlo algo sale de la nevera o del depósito, no es
 * servicio (un "servicio de whisky" que incluye la botella es un PREPARADO).
 */
export type Naturaleza = 'insumo' | 'preparado' | 'servicio' | 'pendiente';

/** Lo mínimo que hace falta para clasificar un producto. */
export interface ProductoClasificable {
  _id?: string;
  name?: string;
  type?: string | null;
  isForInventory?: boolean | null;
  ingredients?: Array<{ productId?: string } | null | undefined> | null;
  presentation?: string | null;
}

/** Ingredientes reales (con productId); el array llega sucio desde clientes viejos. */
export function ingredientesValidos(
  p: ProductoClasificable,
): Array<{ productId?: string }> {
  return (p.ingredients ?? []).filter(
    (i): i is { productId?: string } => !!i && !!i.productId,
  );
}

/**
 * Naturaleza de un producto tal como está guardado hoy.
 *
 * El orden importa: la receta manda sobre `type` porque hubo 21 productos con
 * receta marcados BASE. Y `isForInventory: false` NO significa servicio: era el
 * valor por defecto del formulario viejo, así que sin `type` SERVICIO explícito
 * eso es "pendiente", no "no lleva inventario".
 */
export function naturalezaDe(p: ProductoClasificable): Naturaleza {
  if (String(p.type ?? '') === ProductTypeEnum.SERVICE) return 'servicio';
  if (ingredientesValidos(p).length > 0) return 'preparado';
  if (
    String(p.type ?? '') === ProductTypeEnum.BASE &&
    p.isForInventory === true
  ) {
    return 'insumo';
  }
  return 'pendiente';
}

export interface ResultadoNaturaleza {
  ok: boolean;
  /** Mensajes para el usuario, en español y accionables. */
  errores: string[];
  /** Lo que el servidor corrige o deriva por su cuenta. */
  cambios: {
    type?: string;
    isForInventory?: boolean;
    naturalezaPendiente?: boolean;
  };
  naturaleza: Naturaleza;
}

/** Insumo con el mínimo que necesita la validación de receta. */
export type InsumoParaValidar = ProductForRecipeCost & { isActive?: boolean };

/**
 * Valida y NORMALIZA la naturaleza del estado final de un producto.
 *
 * Se le pasa el estado ya mezclado (actual + PATCH), no el DTO suelto: así un
 * PATCH de solo precio sobre un producto legacy no lo rechaza, pero uno que
 * toca la naturaleza sí se valida entero.
 *
 * `productosById` sirve para comprobar que cada ingrediente existe, está activo
 * y su unidad es compatible con cómo se compra el insumo — una receta con un
 * ingrediente fantasma o en la unidad equivocada se guardaba igual y NUNCA
 * descontaba: el faltante aparecía después como si fuera robo del personal.
 */
export function validarNaturaleza(
  estado: ProductoClasificable,
  productosById: Map<string, InsumoParaValidar>,
): ResultadoNaturaleza {
  const errores: string[] = [];
  const cambios: ResultadoNaturaleza['cambios'] = {};
  const ingredientes = ingredientesValidos(estado);
  const tipo = String(estado.type ?? '');

  // Un producto con receta es PREPARADO aunque venga marcado BASE (pasó a
  // menudo: el APK y los scripts guardan receta sin tocar `type`).
  if (
    ingredientes.length > 0 &&
    tipo !== ProductTypeEnum.SERVICE &&
    tipo !== ProductTypeEnum.MIXED
  ) {
    cambios.type = ProductTypeEnum.MIXED;
  }

  const tipoFinal = cambios.type ?? tipo;

  if (tipoFinal === ProductTypeEnum.SERVICE) {
    if (ingredientes.length > 0) {
      errores.push(
        'Un servicio no lleva receta: si al venderlo sale algo del almacén, márcalo como Preparado.',
      );
    }
    cambios.isForInventory = false;
  } else if (tipoFinal === ProductTypeEnum.MIXED) {
    if (ingredientes.length === 0) {
      errores.push(
        'Un preparado necesita al menos un ingrediente; si no lleva nada del almacén, márcalo como Servicio.',
      );
    }
    errores.push(...erroresDeReceta(estado, productosById));
    cambios.isForInventory = false;
  } else if (tipoFinal === ProductTypeEnum.BASE) {
    // La presentación decide la unidad base del stock y el costo por unidad:
    // sin ella el insumo no se puede contar ni costear.
    if (!String(estado.presentation ?? '').trim()) {
      errores.push(
        'Un insumo necesita su presentación (Kilogramo, Litro, Unidad...) para poder contarlo y costearlo.',
      );
    }
    cambios.isForInventory = true;
  } else {
    errores.push(
      'Elige qué es el producto: Insumo (se descuenta a sí mismo), Preparado (lleva receta) o Servicio (no toca inventario).',
    );
  }

  // Guardar una naturaleza explícita saca al producto de la lista de pendientes.
  // Y se devuelve SIEMPRE el `type` final, no solo cuando el helper lo corrige:
  // si el llamador cambia la naturaleza (quitar la receta y marcar "directo")
  // y solo se persistiera `isForInventory`, el producto quedaba COMPUESTO con
  // isForInventory true — el mismo estado contradictorio que esto viene a
  // eliminar. Verificado el 03/09 contra la API local.
  if (errores.length === 0) {
    cambios.naturalezaPendiente = false;
    cambios.type = tipoFinal;
  }

  const estadoFinal: ProductoClasificable = {
    ...estado,
    type: tipoFinal,
    isForInventory: cambios.isForInventory ?? estado.isForInventory,
  };

  return {
    ok: errores.length === 0,
    errores,
    cambios,
    naturaleza: naturalezaDe(estadoFinal),
  };
}

/**
 * Problemas de la receta que hacen que NO descuente: ingrediente inexistente,
 * inactivo, el producto como ingrediente de sí mismo, o unidad incompatible con
 * cómo se compra el insumo (gr sobre algo que se compra por Unidad).
 *
 * La detección de unidad se delega en `expandRecipeIngredients`, el mismo
 * código que usa el consumo: si aquí pasa, allí descuenta.
 */
function erroresDeReceta(
  estado: ProductoClasificable,
  productosById: Map<string, InsumoParaValidar>,
): string[] {
  const errores: string[] = [];
  const ingredientes = ingredientesValidos(estado) as Array<{
    productId: string;
  }>;

  for (const ing of ingredientes) {
    const insumo = productosById.get(String(ing.productId));
    if (!insumo) {
      errores.push(`El ingrediente ${ing.productId} no existe en el catálogo.`);
      continue;
    }
    if (insumo.isActive === false) {
      errores.push(
        `"${insumo.name}" está inactivo: reactívalo o quítalo de la receta.`,
      );
    }
    if (estado._id && String(ing.productId) === String(estado._id)) {
      errores.push('Un producto no puede ser ingrediente de sí mismo.');
    }
  }

  const expandido = expandRecipeIngredients(
    estado as unknown as ProductForRecipeCost,
    productosById as Map<string, ProductForRecipeCost>,
  );
  for (const err of expandido.errors) {
    if (err.reason.startsWith('unidad-incompatible')) {
      const insumo = err.productId
        ? productosById.get(err.productId)
        : undefined;
      const comoSeCompra = insumo?.presentation ?? 'su presentación';
      errores.push(
        `"${insumo?.name ?? err.productId}" se compra por ${comoSeCompra}: usa una medida compatible.`,
      );
    }
  }

  return errores;
}

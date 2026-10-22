/**
 * Auditoría de recetas — replica la lógica del servidor en el UI.
 *
 * Calcula la naturaleza, encuentra errores de recetas y clasifica productos
 * en secciones actionables para resolver pendientes.
 */

import { Product } from '@odin6/types';
import {
  factorFaltante,
  type Equivalencias,
} from '@/shared/utils/costoDeLinea';
import {
  naturalezaDe,
  baseDePresentacion,
  margenPct,
  ingredientesValidos,
} from '@/features/products/naturaleza';
import type {
  NaturalezaActual,
  EstadoProducto,
  AuditedProduct,
  AuditSection,
  ErrorReceta,
} from '@/features/recipes/types/auditResults';

interface IngredientConUnidad {
  productId?: string;
  unit?: string | null;
}

/**
 * Expande ingredientes de una receta validando unidades compatibles.
 * Devuelve los errores encontrados (ingrediente inactivo, unidad incompatible, etc).
 */
export function expandirRecetaConValidacion(
  product: Product,
  allProducts: Map<string, Product>,
): ErrorReceta[] {
  const errores: ErrorReceta[] = [];
  const validos = ingredientesValidos(
    product as {
      type?: string | null;
      isForInventory?: boolean | null;
      ingredients?: Array<{ productId?: string } | null | undefined> | null;
    },
  );

  for (const ing of validos) {
    const ingTyped = ing as IngredientConUnidad;
    const insumo = allProducts.get(ingTyped.productId ?? '');

    if (!insumo) {
      errores.push({
        reason: 'insumo-no-existe',
        detalles: `Insumo con id ${ingTyped.productId} no encontrado`,
      });
      continue;
    }

    if (!insumo.isActive) {
      errores.push({
        reason: 'insumo-inactivo',
        detalles: `"${insumo.name}" está inactivo`,
      });
    }

    // Validar compatibilidad de unidad
    const unidadReceta = ingTyped.unit || 'Unidad';
    const unidadCompra = insumo.presentation;
    if (!sonUnidadesCompatibles(unidadReceta, unidadCompra, insumo)) {
      errores.push({
        reason: 'unidad-incompatible',
        detalles: `"${insumo.name}" se compra por ${unidadCompra}, receta usa ${unidadReceta}`,
      });
    }
  }

  return errores;
}

/**
 * Validar si dos unidades son compatibles (peso con peso, volumen con volumen, etc).
 */
export function sonUnidadesCompatibles(
  unidadReceta: string,
  unidadCompra?: string | null,
  equivalencias?: Equivalencias | null,
): boolean {
  if (!unidadCompra) return true; // Sin información, asumir compatible

  const baseReceta = baseDePresentacion(unidadReceta);
  const baseCompra = baseDePresentacion(unidadCompra);

  if (baseReceta === baseCompra) return true;
  // Otra familia: solo si el insumo trae la equivalencia que la cruza
  return factorFaltante(baseReceta, baseCompra, equivalencias) === null;
}

/**
 * Determinar el estado de un producto en función de su naturaleza y errores.
 */
function determinarEstado(
  naturaleza: NaturalezaActual,
  errores: ErrorReceta[],
  product: Product,
): EstadoProducto {
  if (naturaleza === 'pendiente') return 'sin_receta';
  if (naturaleza === 'servicio') return 'ok';
  if (naturaleza === 'insumo') return 'ok';

  // Preparado
  if (errores.length > 0) return 'receta_invalida';
  if (!product.ingredients || product.ingredients.length === 0)
    return 'sin_ingredientes';
  return 'ok';
}

/**
 * Determinar acciones disponibles según naturaleza y rol.
 */
function determinarAcciones(
  naturaleza: NaturalezaActual,
  esAdmin: boolean,
  estado: EstadoProducto,
): string[] {
  if (naturaleza === 'pendiente' && esAdmin) {
    return ['Es insumo', 'Es servicio', 'Cargar receta'];
  }

  // Preparado con problemas: reparar
  if (naturaleza === 'preparado' && estado === 'receta_invalida') {
    return ['Cargar receta'];
  }

  // Preparado sin ingredientes o válido
  if (naturaleza === 'preparado') {
    return ['Cargar receta'];
  }

  // Insumo: opción de directo (venta sin descuento de inventario)
  if (naturaleza === 'insumo' && esAdmin) {
    return ['Cargar receta'];
  }

  return [];
}

/**
 * Auditar todos los productos vendibles y agrupar en secciones.
 */
export function auditRecetas(
  products: Product[],
  allProducts: Map<string, Product>,
  esAdmin: boolean = false,
): AuditSection[] {
  // Filtrar vendibles
  const vendibles = products.filter(
    (p) => p.isActive !== false && p.isForSale !== false,
  );

  // Auditar cada uno
  const auditados: AuditedProduct[] = vendibles.map((p) => {
    const naturaleza = naturalezaDe({
      type: p.type,
      isForInventory: p.isForInventory,
      ingredients: p.ingredients,
    }) as NaturalezaActual;
    const errores = expandirRecetaConValidacion(p, allProducts);
    const estado = determinarEstado(naturaleza, errores, p);
    const acciones = determinarAcciones(naturaleza, esAdmin, estado);

    return {
      ...p,
      naturaleza,
      estado,
      errores: errores.length > 0 ? errores : undefined,
      acciones,
    } as AuditedProduct;
  });

  const sections: AuditSection[] = [];

  // Sección 1: Pendientes (sin naturaleza)
  const pendientes = auditados.filter((p) => p.naturaleza === 'pendiente');
  if (pendientes.length > 0 || esAdmin) {
    sections.push({
      titulo: 'Pendientes de clasificar',
      descripcion: `${pendientes.length} producto${pendientes.length === 1 ? '' : 's'} sin decisión de naturaleza. Se venden pero no descuentan nada del inventario.`,
      productos: pendientes,
    });
  }

  // Sección 2: Preparados con problemas
  const preparadosConError = auditados.filter(
    (p) =>
      p.naturaleza === 'preparado' &&
      (p.errores || p.estado === 'sin_ingredientes'),
  );
  if (preparadosConError.length > 0) {
    sections.push({
      titulo: 'Recetas con problemas',
      descripcion: `${preparadosConError.length} receta${preparadosConError.length === 1 ? '' : 's'} con unidades incompatibles, insumos inactivos o sin ingredientes.`,
      productos: preparadosConError,
      cantidadProblema: preparadosConError.filter((p) => p.errores).length,
    });
  }

  // Sección 3: Márgenes en riesgo (info, no bloquea)
  const conMargenBajo = auditados.filter((p) => {
    const margen = margenPct(p);
    return margen !== null && margen < 30;
  });
  if (conMargenBajo.length > 0) {
    sections.push({
      titulo: 'Márgenes en riesgo',
      descripcion: `${conMargenBajo.length} producto${conMargenBajo.length === 1 ? '' : 's'} con ganancia < 30%.`,
      productos: conMargenBajo,
    });
  }

  // Sección 4: OK (si está vacío o solo hay OK, mostrar count)
  const ok = auditados.filter(
    (p) => p.estado === 'ok' && p.naturaleza !== 'pendiente',
  );
  if (ok.length > 0 && sections.length === 0) {
    // Si hay SOLO productos OK (sin pendientes ni problemas), mostrar un resumen
    sections.push({
      titulo: 'Todos en orden',
      descripcion: `${ok.length} producto${ok.length === 1 ? '' : 's'} clasificados correctamente.`,
      productos: [],
    });
  }

  return sections;
}

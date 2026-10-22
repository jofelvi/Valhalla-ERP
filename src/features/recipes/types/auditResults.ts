/**
 * Tipos para la auditoría de recetas — clasificación de productos y errores.
 */

import { Product } from '@odin6/types';

export type NaturalezaActual =
  | 'insumo'
  | 'preparado'
  | 'servicio'
  | 'pendiente';

export type EstadoProducto =
  | 'ok'
  | 'sin_receta'
  | 'receta_invalida'
  | 'sin_ingredientes'
  | 'unidad_incompatible'
  | 'agotado_sin_descuento';

export interface ErrorReceta {
  reason: string; // "unidad-incompatible", "insumo-inactivo", etc.
  detalles?: string;
}

export interface AuditedProduct extends Product {
  naturaleza: NaturalezaActual;
  estado: EstadoProducto;
  errores?: ErrorReceta[];
  acciones: string[]; // ['Es insumo', 'Es servicio', 'Cargar receta', 'Directo']
}

export interface AuditSection {
  titulo: string;
  descripcion: string;
  productos: AuditedProduct[];
  cantidadProblema?: number; // total con errores, diferente de cantidad
}

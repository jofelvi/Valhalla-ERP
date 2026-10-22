/**
 * Modelo de Almacén General
 *
 * Gestiona el stock principal de productos del negocio.
 * Los productos se vinculan por referencia (productId) al modelo Product existente.
 */

export interface AlmacenGeneralProducto {
  productId: string; // Referencia a Product.id
  stockDisponible: number; // Stock disponible en almacén general
  ubicacion?: string; // Ubicación física opcional (ej: "Estante A-3")
  fechaUltimaActualizacion?: Date;
}

export interface AlmacenGeneral {
  id: string;
  productos: AlmacenGeneralProducto[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Tipo para transferencias del almacén general al diario
 */
export interface TransferenciaAlmacen {
  productId: string;
  cantidad: number;
  origen: 'general';
  destino: 'diario';
  fecha: Date;
  usuario?: string;
}

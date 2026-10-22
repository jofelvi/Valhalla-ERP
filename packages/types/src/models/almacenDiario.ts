/**
 * Modelo de Almacén Diario
 *
 * Gestiona el inventario operacional de cada día.
 * REUTILIZA Order y OrderItem existentes para ventas.
 * Solo agrega tracking de stock diario.
 */

export type EstadoAlmacenDiario = 'abierto' | 'cerrado';
export type TipoMovimiento =
  | 'transferencia-entrada'
  | 'ajuste-manual'
  | 'devolucion';

/**
 * Item de stock inicial del día
 */
export interface StockInicialItem {
  productId: string; // Referencia a Product.id
  cantidad: number;
}

/**
 * Movimiento en el almacén diario
 * (NO incluye ventas, esas se rastrean vía Order)
 */
export interface MovimientoAlmacen {
  id: string;
  tipo: TipoMovimiento;
  productId: string;
  cantidad: number; // Positivo para entradas, negativo para salidas
  timestamp: Date;
  motivo?: string; // Para ajustes o devoluciones
  usuario?: string;
}

/**
 * Referencia a venta (usa Order existente)
 * Solo guardamos el ID para vincular
 */
export interface VentaDiariaRef {
  orderId: string; // ← Referencia a Order.id existente
  timestamp: Date; // Duplicado para queries rápidas por fecha
  total: number; // Duplicado para cálculos rápidos
}

/**
 * Stock final de un producto al cierre del día
 */
export interface StockFinalItem {
  productId: string;
  cantidadInicial: number;
  cantidadVendida: number; // Calculado desde Orders vinculadas
  cantidadAjustada: number; // Ajustes manuales o devoluciones
  cantidadFinal: number; // Inicial - Vendida + Ajustada
}

/**
 * Resumen del día
 */
export interface ResumenDiario {
  totalProductosInicial: number;
  totalVentas: number; // Cantidad de items vendidos
  totalProductosFinal: number;
  montoTotalVentas: number; // Dinero total (de Orders)
  numeroOrdenes: number; // Número de Orders completadas
  productoMasVendido?: {
    productId: string;
    cantidad: number;
  };
}

/**
 * Stock actual de un producto (actualizado en tiempo real)
 */
export interface StockActualItem {
  productId: string;
  cantidad: number; // Puede ser negativo si se vende más de lo disponible
}

/**
 * Modelo principal del Almacén Diario
 */
export interface AlmacenDiario {
  id: string; // Formato: "YYYY-MM-DD"
  fecha: Date;
  estado: EstadoAlmacenDiario;
  horaApertura: Date;
  horaCierre?: Date;

  // Stock y movimientos
  stockInicial: StockInicialItem[];
  stockActual: StockActualItem[]; // ← Stock en tiempo real (se descuenta con cada venta)
  movimientos: MovimientoAlmacen[]; // Solo ajustes, NO ventas
  ventasRef: VentaDiariaRef[]; // ← Referencias a Orders, NO duplica datos

  stockFinal?: StockFinalItem[]; // Se calcula al cerrar

  // Resumen
  resumen?: ResumenDiario;

  // Metadata
  usuarioApertura?: string;
  usuarioCierre?: string;
  notas?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * DTO para abrir un día
 */
export interface AbrirDiaDTO {
  fecha: Date;
  productosIniciales: {
    productId: string;
    cantidad: number;
  }[];
  usuario?: string;
  notas?: string;
}

/**
 * DTO para cerrar un día
 */
export interface CerrarDiaDTO {
  diaId: string;
  usuario?: string;
  notasCierre?: string;
}

/**
 * DTO para registrar que una Order se completó
 * (NO crea la Order, solo la vincula al almacén diario)
 */
export interface VincularOrdenDTO {
  diaId: string;
  orderId: string; // ← Order ya existente
}

/**
 * DTO para agregar más stock durante el día
 */
export interface AgregarStockDiarioDTO {
  diaId: string;
  productId: string;
  cantidad: number;
  motivo: string;
  usuario?: string;
}

/**
 * DTO para ajuste manual de stock
 */
export interface AjustarStockDTO {
  diaId: string;
  productId: string;
  cantidad: number; // Positivo o negativo
  motivo: string;
  usuario?: string;
}

/**
 * Item de plantilla de stock
 */
export interface PlantillaStockItem {
  productId: string;
  productName: string; // Guardamos el nombre para referencia rápida
  cantidadDefault: number;
  activo: boolean; // Si está activo en la plantilla
}

/**
 * Plantilla de stock diario
 * Se guarda como template para reutilizar cada día
 */
export interface PlantillaStockDiario {
  id: string;
  nombre: string;
  descripcion?: string;
  productos: PlantillaStockItem[];
  esDefault: boolean; // Si es la plantilla por defecto
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

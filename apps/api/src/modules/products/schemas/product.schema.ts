import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  CurrencyEnum,
  ProductTypeEnum,
  ProductStationEnum,
} from '@odin6/types';

export type ProductDocument = HydratedDocument<Product>;

interface Ingredient {
  productId: string;
  quantity: number;
  unit: string;
  wastePercentage: number;
}

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  price: number;

  @Prop({
    enum: Object.values(CurrencyEnum),
    default: CurrencyEnum.USD,
  })
  currency: string;

  @Prop({
    enum: Object.values(ProductTypeEnum),
    default: ProductTypeEnum.BASE,
  })
  type: string;

  @Prop({
    enum: Object.values(ProductStationEnum),
  })
  station?: string;

  // Combos multi-estación: partes que van a distintas estaciones/impresoras.
  // Al pedir el producto, la orden se expande en una línea por parte. El menú
  // lo sigue vendiendo como UN producto. Ej: Carpaccio(KITCHEN)+Focaccia(PIZZA).
  @Prop({ type: [Object], default: undefined })
  stationParts?: Array<{ label: string; station: string }>;

  @Prop({ required: true })
  categoryId: string;

  // Subcategoría (opcional) — solo para insumos (type BASE). Apunta a una
  // categoría con `parentId`. El servidor la limpia si el producto no es BASE.
  @Prop()
  subcategoryId?: string;

  @Prop({ type: [String], default: [] })
  supplierIds?: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: true })
  isForSale: boolean;

  @Prop({ default: false })
  isForInventory?: boolean;

  @Prop()
  cost?: number;

  @Prop()
  sku?: string;

  @Prop()
  barcode?: string;

  // Codigos adicionales: EAN real del producto + etiquetas propias impresas
  // (ej: "TOBO-LATA-12"). El scanner de barra matchea barcode O barcodes.
  @Prop({ type: [String], default: [] })
  barcodes?: string[];

  @Prop({ default: 0 })
  stock: number;

  @Prop()
  minStock?: number;

  @Prop()
  presentation?: string;

  @Prop()
  presentationQuantity?: number;

  /**
   * Gramos del insumo por cada ml de la receta. Cruza peso ↔ volumen: la leche
   * en polvo se compra por gramos y la receta la pide en ml. Sin este dato la
   * línea no se puede costear ni descontar (y la app lo avisa).
   */
  @Prop({ type: Number, default: null })
  gramsPerMl?: number | null;

  /**
   * Gramos que pesa UNA unidad del insumo (huevo ~55 g). Cruza contable ↔
   * peso/volumen cuando la receta pide gramos de algo que se compra por unidad.
   */
  @Prop({ type: Number, default: null })
  gramsPerUnit?: number | null;

  /** ml que tiene UNA unidad del insumo (lata de 355 ml): contable ↔ volumen. */
  @Prop({ type: Number, default: null })
  mlPerUnit?: number | null;

  @Prop()
  imageUrl?: string;

  @Prop({ type: [Object], default: [] })
  ingredients?: Ingredient[];

  @Prop()
  nivel?: number;

  /**
   * Producto legacy cuya naturaleza (Insumo / Preparado / Servicio) nadie ha
   * decidido todavía: no descuenta nada, pero deja rastro y sale primero en
   * /private/recipes. Lo pone la migración y lo quita el servidor en cuanto se
   * guarda una naturaleza explícita. Sin esta marca, esos productos eran
   * indistinguibles de un servicio legítimo.
   */
  @Prop({ default: false })
  naturalezaPendiente?: boolean;

  /** Cuándo se recalculó `cost` por última vez (compra, receta o precio). */
  @Prop()
  costUpdatedAt?: Date;

  /**
   * Cuánto duele perder este insumo. Define qué se cuenta a diario y qué
   * dispara alerta: proteínas, quesos y aceite son ALTA; lechuga y tomate,
   * BAJA. Sin valor se trata como MEDIA.
   */
  @Prop({ enum: ['ALTA', 'MEDIA', 'BAJA'] })
  criticality?: string;

  // Área de inventario cuando la estación de comanda no la define
  // (ej: masa de pizza es KITCHEN en comanda pero PIZZERIA en inventario)
  @Prop({ enum: ['COCINA', 'PIZZERIA', 'BARRA'] })
  inventoryArea?: string;

  // Auditoría de recetas: el personal de estación puede cargar/editar la
  // receta de SU estación (PATCH :id/recipe). Saber quién y cuándo permite
  // revisar recetas dudosas antes de descontar dinero por inventario.
  @Prop()
  recipeUpdatedBy?: string;

  @Prop()
  recipeUpdatedAt?: Date;

  // Tiempo de preparacion y quien lo prepara. Sirve para costear el plato con
  // la mano de obra ademas de los ingredientes: una pizza de 12 minutos y un
  // refresco no cuestan lo mismo aunque el inventario diga que si.
  @Prop()
  prepTimeMinutes?: number;

  @Prop()
  preparedByEmployeeId?: string;

  @Prop()
  preparedByName?: string;

  // Costo del TIEMPO, calculado al guardar la receta. Va aparte de `cost`
  // (materia prima) porque `cost` es lo que valora el inventario: meter el
  // sueldo ahi inflaria el kardex y dejaria de cuadrar con la nevera.
  @Prop()
  laborCost?: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

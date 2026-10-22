import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WeeklyReportDocument = HydratedDocument<WeeklyReport>;

/**
 * Datos de un producto vendido con sus KPIs de rentabilidad
 */
export interface TopVendidoItem {
  productId: string;
  name: string;
  unidades: number;
  ingreso: number;
  costoReceta: number | null;
  margenUsd: number | null;
  margenPct: number | null;
}

/**
 * Datos de variacion de precio en compras
 */
export interface PriceVariationItem {
  productId: string;
  name: string;
  variationPct: number;
  prevCost: number;
  newCost: number;
}

/**
 * Datos de merma/faltante por insumo
 */
export interface LossItem {
  productId: string;
  name: string;
  diffUsd: number;
}

/**
 * Estructura completa de KPIs de la semana
 */
export interface WeeklyKpis {
  ventas: {
    totalUsd: number;
    ordenes: number;
    ticketPromedio: number;
    vsSemanaAnterior: {
      totalUsd: number;
      deltaPct: number | null;
    };
  };
  rentabilidad: {
    topVendidos: TopVendidoItem[];
    gananciaBrutaTeorica: number;
  };
  foodCost: {
    consumoUsd: number;
    ventasUsd: number;
    foodCostPct: number | null;
  };
  merma: {
    declaradaUsd: number;
    faltanteUsd: number;
    sobranteUsd: number;
    totalUsd: number;
    pctSobreCompras: number | null;
    topInsumos: LossItem[];
  };
  compras: {
    totalUsd: number;
    totalCompras: number;
    topVariaciones: PriceVariationItem[];
  };
  cobertura: {
    ventasConReceta: number;
    ventasTotal: number;
    pct: number;
  };
}

@Schema({ collection: 'weekly_reports', timestamps: true })
export class WeeklyReport {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  weekStart: Date;

  @Prop({ required: true })
  weekEnd: Date;

  @Prop({ type: Object })
  kpis: WeeklyKpis;

  @Prop()
  aiSummary?: string;

  @Prop()
  aiError?: string;

  @Prop({ default: 'deepseek-chat' })
  aiModel?: string;

  @Prop()
  generatedAt?: Date;

  @Prop({ default: false })
  sentToWhatsapp?: boolean;

  @Prop()
  whatsappError?: string;

  // timestamps: createdAt, updatedAt (automaticos)
}

export const WeeklyReportSchema = SchemaFactory.createForClass(WeeklyReport);
WeeklyReportSchema.index({ weekStart: 1 }, { unique: true });

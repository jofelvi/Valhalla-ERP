import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Incidentes que reporta la PC de la caja (watchdog + print-service).
 *
 * Existe porque hasta el 16/08/2026 la cadena entera daba por impreso lo que
 * nunca salio: send-raw entregaba los bytes al spooler, el print-service marcaba
 * el job 'done' y el watchdog limpiaba la cola de Windows en silencio. Se
 * perdieron 493 comandas de barra en 8 dias sin una sola alerta.
 */
export enum PrintIncidentType {
  /** El watchdog boto trabajos de la cola de Windows para destrabar la impresora. */
  PURGA = 'purga',
  /** La impresora estaba caida y el ticket salio por la de respaldo. */
  REDIRECCION = 'redireccion',
  /** La impresora estaba caida y NO habia respaldo: el ticket no salio. */
  PERDIDA = 'perdida',
  /** El ciclado por software fallo varias veces: hay que ir a la maquina. */
  REQUIERE_INTERVENCION = 'requiere_intervencion',
}

export class PurgedJobDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  papel?: string;

  @IsOptional()
  @IsString()
  enviado?: string;

  @IsOptional()
  @IsString()
  estado?: string;
}

export class ReportIncidentDto {
  @IsEnum(PrintIncidentType)
  tipo: PrintIncidentType;

  @IsString()
  impresora: string;

  /** Impresora por la que salio finalmente (solo en `redireccion`). */
  @IsOptional()
  @IsString()
  destino?: string;

  /** Estacion del ticket: BARRA, COCINA, PIZZA. */
  @IsOptional()
  @IsString()
  etiqueta?: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsString()
  conector?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  waiterName?: string;

  @IsOptional()
  @IsString()
  table?: string;

  @IsOptional()
  @IsString()
  equipo?: string;

  @IsOptional()
  @IsBoolean()
  ciclado?: boolean;

  @IsOptional()
  @IsInt()
  intentos?: number;

  @IsOptional()
  @IsString()
  desde?: string;

  /** Trabajos que el watchdog boto de la cola de Windows. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurgedJobDto)
  trabajos?: PurgedJobDto[];
}

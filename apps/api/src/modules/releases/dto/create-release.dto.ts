import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReleaseAmbitoEnum } from '@odin6/types';

class ShasDto {
  @ApiPropertyOptional({ example: 'a1b2c3d' })
  @IsOptional()
  @IsString()
  web?: string;

  @ApiPropertyOptional({ example: '6755ac2' })
  @IsOptional()
  @IsString()
  api?: string;
}

/**
 * Ojo: el ValidationPipe global lleva `whitelist: true`. Un campo que no este
 * declarado aqui se descarta EN SILENCIO, sin dar 400.
 */
export class CreateReleaseDto {
  @ApiProperty({ example: '2026-09-07T16:00:00.000Z' })
  @IsDateString()
  fecha: string;

  @ApiProperty({
    example: ['api', 'web'],
    enum: ReleaseAmbitoEnum,
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ReleaseAmbitoEnum, { each: true })
  ambito: ReleaseAmbitoEnum[];

  @ApiPropertyOptional({ example: 'v1.2.1' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({ example: 'El descuento con PIN ya no se revierte' })
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @ApiProperty({ example: ['Agregar un item ya no borra el descuento'] })
  @IsArray()
  @IsString({ each: true })
  cambios: string[];

  @ApiPropertyOptional({ example: ['6755ac2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commits?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ShasDto)
  shas?: ShasDto;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  migroDatos?: boolean;
}

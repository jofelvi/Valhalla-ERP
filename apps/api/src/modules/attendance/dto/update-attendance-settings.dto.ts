import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class GeofenceSettingsDto {
  @ApiProperty({ example: 10.2344525 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -67.5447014 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  // Menos de 10 m no lo cumple ni un GPS bueno; mas de 5 km deja de ser
  // "estar en el club".
  @ApiProperty({ example: 200 })
  @IsInt()
  @Min(10)
  @Max(5000)
  radiusMeters: number;

  @ApiProperty({ example: 'Local principal' })
  @IsString()
  @MaxLength(120)
  locationName: string;
}

export class UpdateAttendanceSettingsDto {
  @ApiPropertyOptional({ type: GeofenceSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeofenceSettingsDto)
  geofence?: GeofenceSettingsDto;

  @ApiPropertyOptional({
    example: 14,
    description: 'Hora de entrada, 0-23, hora de Caracas',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  standardCheckInHour?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  lateGraceMinutes?: number;
}

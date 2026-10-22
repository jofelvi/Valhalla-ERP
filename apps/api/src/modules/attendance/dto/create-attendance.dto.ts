import { IsString, IsOptional, IsDateString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class LocationDto {
  @ApiPropertyOptional({ example: -66.5897 })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 10.4806 })
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  accuracy?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  checkIn?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  checkOut?: Record<string, unknown>;
}

class DeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({ example: 1707571200000 })
  @IsOptional()
  timestamp?: number;

  @ApiPropertyOptional({ example: '192.168.1.100' })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class CreateAttendanceDto {
  @ApiProperty({ example: 'emp-123' })
  @IsString()
  employeeId: string;

  @ApiPropertyOptional({ example: 'user-123' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: 'https://api.ejemplo.com/uploads/attendance/abc.jpg',
  })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional()
  @IsObject()
  location?: LocationDto;

  @ApiPropertyOptional({ type: DeviceDto })
  @IsOptional()
  @IsObject()
  device?: DeviceDto;
}

export class CheckInDto extends CreateAttendanceDto {}

export class CheckOutDto {
  @ApiProperty({ example: 'emp-123' })
  @IsString()
  employeeId: string;

  @ApiPropertyOptional({
    example: 'https://api.ejemplo.com/uploads/attendance/abc.jpg',
  })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional()
  @IsObject()
  location?: LocationDto;

  @ApiPropertyOptional({ type: DeviceDto })
  @IsOptional()
  @IsObject()
  device?: DeviceDto;
}

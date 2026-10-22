import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

export class UploadSelfieDto {
  @ApiProperty({ example: 'emp-123' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'Imagen en base64 (sin prefijo data:image/...)' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiPropertyOptional({ enum: EXTENSIONS, default: 'jpg' })
  @IsOptional()
  @IsIn(EXTENSIONS as unknown as string[])
  extension?: (typeof EXTENSIONS)[number];
}

import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { UploadImageDto } from './dto/upload-image.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { baseUrlDeSolicitud } from './base-url.util';

@ApiTags('uploads')
@Controller('api/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subir imagen (base64) a carpeta por categoria' })
  @ApiResponse({ status: 201, description: 'Imagen subida, retorna URL' })
  uploadImage(@Body() dto: UploadImageDto, @Req() req: Request) {
    return this.uploadsService.uploadImage(dto, baseUrlDeSolicitud(req));
  }

  /**
   * Comprobante de pago desde la pagina publica del cliente.
   *
   * Sin sesion a proposito: quien reporta un pago es un cliente con un enlace,
   * igual que `POST /api/payment-reports/public`, que tampoco la pide. Por eso
   * se acota a esa sola categoria: sirve para adjuntar un comprobante, no para
   * dejar archivos sueltos en el servidor.
   */
  @Post('payment-proof')
  @ApiOperation({ summary: 'Subir comprobante de pago (PUBLICO, sin sesion)' })
  @ApiResponse({ status: 201, description: 'Comprobante subido, retorna URL' })
  uploadPaymentProof(@Body() dto: UploadImageDto, @Req() req: Request) {
    if (dto.category !== 'payment-proofs') {
      throw new BadRequestException(
        'Esta ruta solo acepta comprobantes de pago',
      );
    }
    return this.uploadsService.uploadImage(dto, baseUrlDeSolicitud(req));
  }
}

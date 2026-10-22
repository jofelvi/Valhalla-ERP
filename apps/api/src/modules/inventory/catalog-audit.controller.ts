import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogAuditService } from './catalog-audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('inventory')
@Controller('api/inventory/catalog-audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CatalogAuditController {
  constructor(private readonly auditService: CatalogAuditService) {}

  @Get()
  @ApiOperation({
    summary:
      'Auditoría de catálogo: cobertura, productos sin receta, insumos incompletos, servicios legacy',
  })
  async getAudit(@Query('days') daysStr?: string) {
    let days = 30;
    if (daysStr) {
      const parsed = parseInt(daysStr, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 90) {
        throw new BadRequestException(
          'El parámetro "days" debe estar entre 1 y 90',
        );
      }
      days = parsed;
    }

    return this.auditService.getAudit(days);
  }
}

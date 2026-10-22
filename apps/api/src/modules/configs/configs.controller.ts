import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ConfigId,
  ConfigPublica,
  UserRoleEnum,
  esConfigId,
} from '@odin6/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { SolicitudConOrigen } from '../uploads/base-url.util';
import { baseUrlDeSolicitud, reanclarUploads } from '../uploads/base-url.util';
import { ConfigsService } from './configs.service';
import { ActualizarConfigDto } from './dto/actualizar-config.dto';

interface PeticionAutenticada {
  user?: { id?: string };
}

/**
 * Configuración del negocio (contrato en `docs/contrato-config.md`).
 *
 *  - `GET /api/config/publico`: sin sesión. Lo que necesitan las pantallas para vestirse
 *    (nombre, marca, tarifas, operación, vocabulario, módulos). Nunca incluye `nomina`.
 *  - `GET /api/configs/:id`: ADMIN y MANAGER. Un documento completo.
 *  - `PATCH /api/configs/:id`: solo ADMIN. Mezcla el parcial y guarda quién lo cambió.
 */
@ApiTags('configs')
@ApiBearerAuth()
@Controller('api')
export class ConfigsController {
  constructor(private readonly configs: ConfigsService) {}

  @Get('config/publico')
  @ApiOperation({ summary: 'Configuración pública del negocio (sin sesión)' })
  async publico(@Req() req: SolicitudConOrigen): Promise<ConfigPublica> {
    const cfg = await this.configs.publico();
    const base = process.env.PUBLIC_BASE_URL || baseUrlDeSolicitud(req);
    const { marca } = cfg;
    return {
      ...cfg,
      marca: {
        ...marca,
        logoLightUrl: reanclarUploads(marca.logoLightUrl, base),
        logoDarkUrl: reanclarUploads(marca.logoDarkUrl, base),
        iconUrl: reanclarUploads(marca.iconUrl, base),
      },
    };
  }

  @Get('configs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Lee un documento de configuración' })
  @ApiParam({ name: 'id', description: 'Uno de los documentos del contrato' })
  obtener(@Param('id') id: string) {
    return this.configs.obtenerEnvelope(this.idValido(id));
  }

  @Patch('configs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Cambia campos de un documento de configuración' })
  @ApiParam({ name: 'id', description: 'Uno de los documentos del contrato' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarConfigDto,
    @Req() req: PeticionAutenticada,
  ) {
    return this.configs.actualizar(
      this.idValido(id),
      dto.valor,
      req.user?.id ?? null,
    );
  }

  /** Un `:id` fuera del contrato no existe: 404, no 400. */
  private idValido(id: string): ConfigId {
    if (!esConfigId(id)) {
      throw new NotFoundException(`Configuración desconocida: ${id}`);
    }
    return id;
  }
}

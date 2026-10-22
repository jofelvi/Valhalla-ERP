import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReleasesService } from './releases.service';
import { CreateReleaseDto } from './dto/create-release.dto';
import { UpdateReleaseDto } from './dto/update-release.dto';
import { RollbackDto } from './dto/rollback.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SesionRequeridaGuard } from '../../common/guards/sesion-requerida.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum, type ReleaseAmbito } from '@odin6/types';

interface PeticionConUsuario {
  user?: { id?: string; sub?: string };
}

@ApiTags('releases')
@Controller('api/releases')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReleasesController {
  constructor(private readonly releasesService: ReleasesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar entradas de la bitacora' })
  async findAll(
    @Query('ambito') ambito?: ReleaseAmbito,
    @Query('limit') limit?: string,
  ) {
    return this.releasesService.findAll(ambito, Number(limit) || 50);
  }

  // OJO: esta ruta va ANTES que @Get(':id') o Nest se traga "rollback" como id.
  @Get('rollback/estado')
  @UseGuards(SesionRequeridaGuard)
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Estado de la reversion en curso (ADMIN)' })
  async estado() {
    return this.releasesService.estadoRollback();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de una entrada, con su estado de reversion por ambito',
  })
  async findById(@Param('id') id: string) {
    return this.releasesService.findById(id);
  }

  // Las escrituras llevan SesionRequeridaGuard ademas de Roles: RolesGuard deja
  // pasar cuando no hay usuario (resto de la transicion Firebase->NestJS) y no
  // queremos depender de que AUTH_ENFORCE_WRITES siga puesto en el .env.
  @Post()
  @UseGuards(SesionRequeridaGuard)
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Crear entrada (ADMIN)' })
  async create(@Body() dto: CreateReleaseDto, @Req() req: PeticionConUsuario) {
    const userId = req.user?.id ?? req.user?.sub ?? 'desconocido';
    return this.releasesService.create(dto, userId);
  }

  @Post(':id/rollback')
  @UseGuards(SesionRequeridaGuard)
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Revertir un despliegue (ADMIN + PIN)' })
  async revertir(
    @Param('id') id: string,
    @Body() dto: RollbackDto,
    @Req() req: PeticionConUsuario,
  ) {
    const userId = req.user?.id ?? req.user?.sub ?? 'desconocido';
    return this.releasesService.revertir(id, dto.ambito, dto.pin, userId);
  }

  @Patch(':id')
  @UseGuards(SesionRequeridaGuard)
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Editar entrada (ADMIN)' })
  async update(@Param('id') id: string, @Body() dto: UpdateReleaseDto) {
    return this.releasesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(SesionRequeridaGuard)
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Borrar entrada (ADMIN)' })
  async remove(@Param('id') id: string) {
    return this.releasesService.remove(id);
  }
}

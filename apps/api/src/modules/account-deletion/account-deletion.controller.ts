import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRoleEnum } from '@odin6/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AccountDeletionService,
  SolicitudDeBaja,
} from './account-deletion.service';
import { EstadoDeBaja } from './schemas/account-deletion-request.schema';

class SolicitarBajaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

class MarcarProcesadaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}

interface AuthedRequest {
  user?: { id?: string };
}

@ApiTags('account-deletion')
@ApiBearerAuth()
@Controller('api/account-deletion-requests')
export class AccountDeletionController {
  constructor(private readonly service: AccountDeletionService) {}

  /**
   * Cualquier persona con sesión pide la baja de SU cuenta. El id sale del
   * token, nunca del cuerpo: nadie puede pedir la baja de otro.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Solicitar la eliminación de mi cuenta' })
  async solicitar(
    @Req() req: AuthedRequest,
    @Body() body: SolicitarBajaDto,
  ): Promise<SolicitudDeBaja> {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.service.solicitar(req.user.id, body?.motivo);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Listar solicitudes de baja (ADMIN/MANAGER)' })
  @ApiQuery({ name: 'estado', required: false, enum: ['pending', 'processed'] })
  async listar(@Query('estado') estado?: string) {
    if (estado && estado !== 'pending' && estado !== 'processed') {
      throw new BadRequestException('estado debe ser pending o processed');
    }
    return this.service.listar(estado as EstadoDeBaja | undefined);
  }

  @Patch(':id/procesada')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Marcar una solicitud como procesada (ADMIN/MANAGER)' })
  async procesada(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Body() body: MarcarProcesadaDto,
  ) {
    return this.service.marcarProcesada(
      id,
      req.user?.id ?? 'desconocido',
      body?.nota,
    );
  }
}

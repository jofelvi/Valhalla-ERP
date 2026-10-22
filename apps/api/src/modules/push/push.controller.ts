import {
  Body,
  Controller,
  HttpCode,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PushService } from './push.service';

class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

interface AuthedRequest {
  user?: { id: string };
}

@ApiTags('push')
@Controller('api/push')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Registrar/refrescar el token push del dispositivo',
  })
  @ApiResponse({ status: 200, description: 'Token registrado' })
  async register(
    @Request() req: AuthedRequest,
    @Body() dto: RegisterPushTokenDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Se requiere autenticacion');

    await this.pushService.registerToken(
      userId,
      dto.token,
      dto.platform ?? 'android',
      dto.deviceName,
    );
    return { ok: true, pushEnabled: this.pushService.enabled };
  }

  // POST y no DELETE: el cliente HTTP de la app no manda cuerpo en DELETE.
  @Post('token/remove')
  @HttpCode(200)
  @ApiOperation({ summary: 'Quitar el token del dispositivo (cerrar sesion)' })
  @ApiResponse({ status: 200, description: 'Token eliminado' })
  async remove(
    @Request() req: AuthedRequest,
    @Body() dto: RegisterPushTokenDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Se requiere autenticacion');

    await this.pushService.removeToken(userId, dto.token);
    return { ok: true };
  }
}

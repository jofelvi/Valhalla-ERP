import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  Request,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface AuthedRequest {
  user?: { id: string; email?: string; role?: string };
}
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('users')
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // La nomina esta autorizada para ADMIN y MANAGER, pero este listado era
  // solo de ADMIN: al gerente le devolvia 403 y `WeeklyPayrollTable` casaba
  // cada empleado con su usuario contra una lista VACIA, sin avisar de nada
  // (medido con Playwright el 07/09/2026). Aqui no sirve el listado de
  // mesoneros: el emparejamiento es por id o por nombre y alcanza a cocina,
  // barra y a gente que ya no esta activa.
  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'List all users (gerencia)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll() {
    return this.usersService.findAll();
  }

  // Ruta literal ANTES de ':id' para que no la capture el parametro
  @Get('waiters')
  @ApiOperation({
    summary:
      'List active waiters (solo id + nombre) — cualquier staff autenticado',
  })
  @ApiResponse({ status: 200, description: 'Waiters retrieved successfully' })
  async findActiveWaiters() {
    return this.usersService.findActiveWaiters();
  }

  @Get(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get user by ID (gerencia)' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get('by-email/:email')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get user by email (gerencia)' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  // Antes sin control de dueño: cualquier usuario autenticado (ej. un mesonero)
  // hacia PATCH /users/{admin-id} con {"role":"admin"} y se auto-ascendia.
  // Poner @Roles(ADMIN) a secas cerraba eso PERO rompia el auto-servicio: el
  // APK hace PATCH /users/{propio-id} para que cada quien edite su perfil
  // (authStore.updateProfile), y a un mesonero le daba 403. Solucion precisa:
  // se puede editar el propio perfil o, si eres ADMIN, cualquiera; y solo ADMIN
  // puede tocar rol/estado (eso lo aplica el service). No lleva @Roles porque
  // el permiso depende de si el id es el propio, no de un rol fijo.
  @Patch(':id')
  @ApiOperation({
    summary: 'Update user (propio perfil, o cualquiera si ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Sin sesion' })
  @ApiResponse({ status: 403, description: 'No es tu perfil ni eres admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: AuthedRequest,
  ) {
    // Guards permisivos durante la migracion: se valida aqui explicitamente.
    if (!req.user) {
      throw new UnauthorizedException(
        'Debes iniciar sesion para editar un usuario',
      );
    }
    const esAdmin = req.user.role === UserRoleEnum.ADMIN;
    const esPropio = req.user.id === id;
    if (!esAdmin && !esPropio) {
      throw new ForbiddenException('Solo puedes editar tu propio perfil');
    }
    return this.usersService.update(id, updateUserDto, { isAdmin: esAdmin });
  }

  @Patch(':id/password')
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Reset user password (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Password too short' })
  @ApiResponse({ status: 401, description: 'Sin sesion' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Request() req: AuthedRequest,
  ) {
    // Comprobacion explicita, a proposito: JwtAuthGuard y RolesGuard estan en
    // modo permisivo por la migracion Firebase→NestJS (dejan pasar requests sin
    // token). Para el resto de rutas es una deuda conocida; para CAMBIAR
    // CONTRASEÑAS seria un agujero de seguridad abierto a internet, asi que
    // esta ruta valida por su cuenta y no depende de los guards.
    if (!req.user) {
      throw new UnauthorizedException(
        'Debes iniciar sesion para cambiar una contraseña',
      );
    }
    if (req.user.role !== UserRoleEnum.ADMIN) {
      throw new ForbiddenException(
        'Solo un administrador puede resetear contraseñas',
      );
    }
    return this.usersService.resetPassword(id, dto.newPassword, req.user);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRoleEnum.ADMIN)
  @ApiOperation({ summary: 'Soft delete user (ADMIN only)' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async softDelete(@Param('id') id: string) {
    await this.usersService.softDelete(id);
  }
}

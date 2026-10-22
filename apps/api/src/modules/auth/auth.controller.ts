import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';

interface AuthedRequest {
  user?: { id: string; email?: string; role?: string };
}

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login con email y password' })
  @ApiResponse({ status: 200, description: 'Login exitoso, retorna JWT token' })
  @ApiResponse({ status: 401, description: 'Credenciales invalidas' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // Registro publico (clientes) Y alta de personal (UserForm) comparten esta
  // ruta. OptionalAuthGuard permite sin token (registro anonimo de cliente)
  // y con token valido (alta de staff desde UserForm). El servicio garantiza
  // que un anonimo SIEMPRE queda CUSTOMER, sin importar que mande en el body.
  @Post('register')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado' })
  @ApiResponse({ status: 400, description: 'Email ya registrado' })
  async register(@Body() registerDto: RegisterDto, @Req() req: AuthedRequest) {
    return this.authService.register(registerDto, req.user);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renovar access token' })
  @ApiResponse({ status: 200, description: 'Token renovado' })
  async refresh(@Req() req: { user?: { id: string } }) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.authService.refreshToken(req.user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Datos del usuario actual' })
  async me(@Req() req: { user?: { id: string } }) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.authService.getMe(req.user.id);
  }

  @Post('verify-admin-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar PIN de admin/manager' })
  @ApiResponse({ status: 200, description: 'Resultado de la verificacion' })
  async verifyAdminPin(@Body() body: { pin: string }) {
    return this.authService.verifyAdminPin(body.pin);
  }

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar email con codigo de 6 digitos' })
  @ApiResponse({ status: 201, description: 'Email verificado' })
  @ApiResponse({ status: 400, description: 'Codigo invalido o expirado' })
  async verifyEmail(
    @Req() req: { user?: { id: string } },
    @Body() body: { code: string },
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.authService.verifyEmail(req.user.id, body.code);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reenviar el codigo de verificacion por correo' })
  @ApiResponse({ status: 201, description: 'Codigo reenviado' })
  async resendVerification(@Req() req: { user?: { id: string } }) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.authService.resendVerification(req.user.id);
  }
}

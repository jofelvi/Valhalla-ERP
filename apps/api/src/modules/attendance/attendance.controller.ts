import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CheckInDto, CheckOutDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UploadSelfieDto } from './dto/upload-selfie.dto';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';
import { AttendanceSettingsService } from './attendance-settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SesionRequeridaGuard } from '../../common/guards/sesion-requerida.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('attendance')
@Controller('api/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly settingsService: AttendanceSettingsService,
  ) {}

  @Post('checkin')
  @ApiOperation({ summary: 'Check-in employee' })
  @ApiResponse({ status: 201, description: 'Check-in registered successfully' })
  @ApiResponse({ status: 400, description: 'Duplicate check-in for today' })
  async checkIn(@Body() checkInDto: CheckInDto) {
    return this.attendanceService.checkIn(checkInDto);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Check-out employee' })
  @ApiResponse({
    status: 201,
    description: 'Check-out registered successfully',
  })
  @ApiResponse({ status: 404, description: 'No check-in record found' })
  async checkOut(@Body() checkOutDto: CheckOutDto) {
    return this.attendanceService.checkOut(checkOutDto);
  }

  @Post('upload-selfie')
  @ApiOperation({ summary: 'Subir selfie de asistencia (base64)' })
  @ApiResponse({
    status: 201,
    description: 'Selfie subida, retorna URL publica',
  })
  @ApiResponse({ status: 400, description: 'Imagen invalida' })
  async uploadSelfie(@Body() uploadSelfieDto: UploadSelfieDto) {
    return this.attendanceService.uploadSelfie(uploadSelfieDto);
  }

  // Declaradas ANTES de `:id`: si no, `GET /settings` lo atrapa `findById`
  // y responde "Record not found".
  @Get('settings')
  @ApiOperation({ summary: 'Geocerca del club y hora de entrada' })
  @ApiResponse({
    status: 200,
    description: 'Ajustes vigentes (o los defaults)',
  })
  async getSettings() {
    return this.settingsService.obtener();
  }

  // SesionRequeridaGuard ademas de Roles: RolesGuard deja pasar a quien no
  // trae token, y sin AUTH_ENFORCE_WRITES cualquiera moveria la geocerca.
  @Patch('settings')
  @UseGuards(SesionRequeridaGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary: 'Actualizar ajustes de asistencia (ADMIN, MANAGER)',
  })
  @ApiResponse({ status: 200, description: 'Ajustes guardados' })
  @ApiResponse({ status: 400, description: 'Valores fuera de rango' })
  async updateSettings(
    @Body() dto: UpdateAttendanceSettingsDto,
    @Req() req: { user?: { id?: string; email?: string } },
  ) {
    return this.settingsService.actualizar(
      dto,
      req.user?.email ?? req.user?.id ?? null,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List attendance records' })
  @ApiResponse({ status: 200, description: 'Records retrieved successfully' })
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('onlyOpenEntries') onlyOpenEntries?: string,
  ) {
    return this.attendanceService.findAll({
      employeeId,
      date: date ? new Date(date) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      // "true" (string) o true (boolean) se convierten a booleano
      onlyOpenEntries: onlyOpenEntries === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attendance record by ID' })
  @ApiResponse({ status: 200, description: 'Record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async findById(@Param('id') id: string) {
    return this.attendanceService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Update attendance record (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id') id: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(id, updateAttendanceDto);
  }
}

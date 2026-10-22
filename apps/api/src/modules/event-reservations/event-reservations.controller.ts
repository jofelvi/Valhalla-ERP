import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EventReservationsService } from './event-reservations.service';
import { CreateEventReservationDto } from './dto/create-event-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModuloActivoGuard } from '../../common/modulos/modulo-activo.guard';
import { RequiereModulo } from '../../common/modulos/requiere-modulo.decorator';

@ApiTags('event-reservations')
@Controller('api/event-reservations')
@UseGuards(ModuloActivoGuard)
@RequiereModulo('reservations')
export class EventReservationsController {
  constructor(
    private readonly eventReservationsService: EventReservationsService,
  ) {}

  @Get('availability/:eventSlug')
  @ApiOperation({ summary: 'Mesas ocupadas del evento (público)' })
  @ApiResponse({ status: 200, description: '{ takenTables: number[] }' })
  async getAvailability(@Param('eventSlug') eventSlug: string) {
    return this.eventReservationsService.getAvailability(eventSlug);
  }

  @Post()
  @ApiOperation({ summary: 'Crear reserva (público, queda PENDING)' })
  @ApiResponse({ status: 201, description: 'Reserva creada' })
  @ApiResponse({ status: 409, description: 'Mesa ya reservada' })
  async create(@Body() dto: CreateEventReservationDto) {
    return this.eventReservationsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listado de reservas (admin)' })
  @ApiResponse({ status: 200, description: 'Reservas listadas' })
  async findAll(@Query('eventSlug') eventSlug?: string) {
    return this.eventReservationsService.findAll(eventSlug);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar o cancelar reserva (admin)' })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    return this.eventReservationsService.updateStatus(id, dto);
  }
}

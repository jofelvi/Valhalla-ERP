import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PrintLogsService } from './print-logs.service';
import { CreatePrintLogDto } from './dto/create-print-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('print-logs')
@Controller('api/print-logs')
export class PrintLogsController {
  constructor(private readonly printLogsService: PrintLogsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create print log' })
  @ApiResponse({ status: 201, description: 'Print log created successfully' })
  async create(@Body() createPrintLogDto: CreatePrintLogDto) {
    return this.printLogsService.create(createPrintLogDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'List print logs' })
  @ApiResponse({
    status: 200,
    description: 'Print logs retrieved successfully',
  })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Defecto 200, tope 1000',
  })
  @ApiQuery({ name: 'page', required: false })
  async findAll(
    @Query('orderId') orderId?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    // Con `orderId` no hace falta tope: son los intentos de UNA orden.
    if (orderId) {
      return this.printLogsService.findByOrderId(orderId);
    }
    return this.printLogsService.findAll(limit, page);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get print log by ID' })
  @ApiResponse({ status: 200, description: 'Print log retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Print log not found' })
  async findById(@Param('id') id: string) {
    return this.printLogsService.findById(id);
  }
}

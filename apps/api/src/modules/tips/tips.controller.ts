import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TipsService } from './tips.service';
import { CreateTipDto } from './dto/create-tip.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('tips')
@Controller('api/tips')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TipsController {
  constructor(private readonly tipsService: TipsService) {}

  @Get()
  @ApiOperation({ summary: 'List tips with optional filters' })
  @ApiQuery({ name: 'waiterId', required: false })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Tips listed' })
  async findAll(
    @Query('waiterId') waiterId?: string,
    @Query('orderId') orderId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.tipsService.findAll({
      waiterId,
      orderId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tip by ID' })
  @ApiResponse({ status: 200, description: 'Tip retrieved' })
  @ApiResponse({ status: 404, description: 'Tip not found' })
  async findById(@Param('id') id: string) {
    return this.tipsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new tip' })
  @ApiResponse({ status: 201, description: 'Tip created' })
  async create(@Body() createTipDto: CreateTipDto) {
    return this.tipsService.create(createTipDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tip' })
  @ApiResponse({ status: 200, description: 'Tip deleted' })
  @ApiResponse({ status: 404, description: 'Tip not found' })
  async remove(@Param('id') id: string) {
    return this.tipsService.remove(id);
  }
}

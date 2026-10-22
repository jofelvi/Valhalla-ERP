import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PriceHistoryService } from './price-history.service';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { BestPlacesDto } from './dto/best-places.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('inventory')
@Controller('api/inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PriceHistoryController {
  constructor(private readonly priceHistoryService: PriceHistoryService) {}

  @Get('price-history')
  @ApiOperation({ summary: 'Historial de precios por producto' })
  async getPriceHistory(@Query() query: PriceHistoryQueryDto) {
    return this.priceHistoryService.listByProduct(
      query.productId,
      query.limit ?? 50,
    );
  }

  @Post('price-history/best-places')
  @ApiOperation({
    summary: 'Sugerir lugares más baratos para lista de productos',
  })
  async getBestPlaces(@Body() dto: BestPlacesDto) {
    return this.priceHistoryService.bestPlaces(dto.productIds);
  }
}

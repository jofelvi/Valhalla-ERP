import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExchangeService } from './exchange.service';

@ApiTags('exchange')
@Controller('api/exchange')
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get('bcv-rate')
  @ApiOperation({ summary: 'Get BCV exchange rate (no auth required)' })
  @ApiResponse({
    status: 200,
    description: 'Exchange rate retrieved successfully',
    schema: {
      example: {
        rate: 52.5,
        source: 'dolarapi.com',
        timestamp: '2026-04-10T12:30:45.123Z',
      },
    },
  })
  async getBcvRate() {
    return this.exchangeService.getBcvRate();
  }
}

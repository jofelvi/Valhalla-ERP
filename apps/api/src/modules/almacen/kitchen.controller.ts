import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { KitchenService } from './kitchen.service';
import { OpenKitchenSessionDto } from './dto/open-kitchen-session.dto';
import { CloseKitchenSessionDto } from './dto/close-kitchen-session.dto';
import { MidPullDto } from './dto/mid-pull.dto';

type AuthedRequest = { user?: { id: string; sub: string; role: string } };

@ApiTags('kitchen')
@Controller('api/kitchen')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('products')
  @ApiOperation({ summary: 'Get inventory products for kitchen session' })
  @ApiResponse({ status: 200, description: 'Inventory products retrieved' })
  async getInventoryProducts() {
    return this.kitchenService.getInventoryProducts();
  }

  @Get('session/active')
  @ApiOperation({ summary: 'Get currently active kitchen session' })
  @ApiResponse({ status: 200, description: 'Active session retrieved' })
  async getActiveSession() {
    return this.kitchenService.getActiveSession();
  }

  @Get('session/stock')
  @ApiOperation({ summary: 'Get live stock data for active session' })
  @ApiResponse({ status: 200, description: 'Live stock retrieved' })
  async getLiveStock() {
    return this.kitchenService.getLiveStock();
  }

  @Get('sessions/history')
  @ApiOperation({ summary: 'Get closed kitchen sessions history' })
  @ApiResponse({ status: 200, description: 'Session history retrieved' })
  async getHistory() {
    return this.kitchenService.getHistory();
  }

  @Post('session/open')
  @ApiOperation({ summary: 'Open a new kitchen session' })
  @ApiResponse({ status: 201, description: 'Session opened' })
  async openSession(
    @Body() dto: OpenKitchenSessionDto,
    @Req() req: AuthedRequest,
  ) {
    const userId = req.user?.sub ?? req.user?.id ?? 'system';
    return this.kitchenService.openSession(dto, userId);
  }

  @Post('session/pull')
  @ApiOperation({ summary: 'Record a mid-pull of items during session' })
  @ApiResponse({ status: 201, description: 'Mid-pull recorded' })
  async addMidPull(@Body() dto: MidPullDto) {
    return this.kitchenService.addMidPull(dto);
  }

  @Post('session/close')
  @ApiOperation({ summary: 'Close active kitchen session and calculate waste' })
  @ApiResponse({ status: 200, description: 'Session closed' })
  async closeSession(@Body() dto: CloseKitchenSessionDto) {
    return this.kitchenService.closeSession(dto);
  }
}

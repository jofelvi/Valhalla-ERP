import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShoppingListsService } from './shopping-lists.service';
import { ProposeItemsDto, UpdateListItemDto } from './dto/propose-items.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

interface AuthedRequest {
  user?: { id?: string; sub?: string };
}

@ApiTags('inventory')
@Controller('api/inventory/shopping-lists')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShoppingListsController {
  constructor(private readonly service: ShoppingListsService) {}

  @Get('suggest')
  @ApiOperation({
    summary: 'Sugerir items de compra basado en consumo histórico',
  })
  suggest(@Query('area') area?: string) {
    return this.service.suggest(area);
  }

  @Post('propose')
  @ApiOperation({ summary: 'Proponer items para la lista de esta semana' })
  propose(@Body() dto: ProposeItemsDto, @Request() req: AuthedRequest) {
    return this.service.propose(
      dto,
      req.user?.id ?? req.user?.sub ?? 'desconocido',
    );
  }

  // Rutas específicas ANTES de rutas `:id` genéricas
  @Post(':id/ai-plan')
  @ApiOperation({ summary: 'Generar plan de compra por lugar con IA' })
  buildAiPlan(@Param('id') id: string) {
    return this.service.buildAiPlan(id);
  }

  // POST (no PATCH): es el contrato que consumen la PWA y el web POS
  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar lista (PROPUESTA → APROBADA)' })
  approve(@Param('id') id: string, @Request() req: AuthedRequest) {
    return this.service.approve(
      id,
      req.user?.id ?? req.user?.sub ?? 'desconocido',
    );
  }

  @Patch(':id/items/:productId')
  @ApiOperation({
    summary: 'Ajustar cantidad, marcar comprado o descartar un item',
  })
  updateItem(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() patch: UpdateListItemDto,
  ) {
    return this.service.updateItem(id, productId, patch);
  }

  // Debe declararse ANTES de ':id' o Nest la captura como id="current"
  @Get('current')
  @ApiOperation({ summary: 'Lista de la semana actual (404 si no existe)' })
  getCurrent() {
    return this.service.getCurrent();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener lista por ID' })
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar shopping lists' })
  list(
    @Query('area') area?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.list({ area, status, limit });
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { UpdateOrderDto, UpdateOrderStatusDto } from './dto/update-order.dto';
import { MergeOrderDto } from './dto/merge-order.dto';
import { ConvertirPackDto } from './dto/convertir-pack.dto';
import {
  DeliverItemDto,
  CancelItemDto,
  NoChargeItemDto,
  DiscountItemDto,
  RemoveItemDiscountDto,
} from './dto/item-actions.dto';
import {
  FichaDeliverDto,
  FichaReturnDto,
  FichaRegenerateDto,
} from './dto/ficha-actions.dto';
import {
  CreateCustomerRequestDto,
  ResolveCustomerRequestDto,
} from './dto/customer-request.dto';
import {
  CreateCreditRequestDto,
  ApproveCreditRequestDto,
  RejectCreditRequestDto,
} from './dto/credit-request.dto';
import {
  CreateTransferRequestDto,
  AcceptTransferRequestDto,
  RejectTransferRequestDto,
  CancelTransferRequestDto,
} from './dto/transfer-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';
import { ModuloActivoGuard } from '../../common/modulos/modulo-activo.guard';
import { RequiereModulo } from '../../common/modulos/requiere-modulo.decorator';

type AuthedRequest = { user?: { id: string; role: string; name?: string } };

@ApiTags('orders')
@Controller('api/orders')
@UseGuards(JwtAuthGuard, ModuloActivoGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('pos-data')
  @ApiOperation({
    summary: 'Get combined POS data: activeOrders, tables, waiters',
  })
  @ApiResponse({ status: 200, description: 'POS data retrieved' })
  async getPosData() {
    return this.ordersService.getPosData();
  }

  @Post('generate-order-number')
  @ApiOperation({ summary: 'Atomically generate next order number for today' })
  @ApiResponse({ status: 201, description: 'Order number generated' })
  async generateOrderNumber() {
    const orderNumber = await this.ordersService.generateOrderNumber();
    return { orderNumber };
  }

  @Post('commission/mark-paid')
  @ApiOperation({
    summary: 'Marcar comisión como pagada para un conjunto de órdenes (nómina)',
  })
  @ApiResponse({ status: 201, description: 'Órdenes marcadas' })
  async markCommissionPaid(
    @Body('orderIds') orderIds: string[],
    @Body('waiterId') waiterId?: string,
  ) {
    return this.ordersService.markCommissionPaid(orderIds ?? [], waiterId);
  }

  @Get('pending-verification')
  @ApiOperation({ summary: 'Get orders with pending payment verification' })
  async getPendingVerification() {
    return this.ordersService.findPendingVerification();
  }

  @Get()
  @ApiOperation({ summary: 'List orders with optional filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'paymentStatus', required: false })
  @ApiQuery({ name: 'tableId', required: false })
  @ApiQuery({ name: 'waiterId', required: false })
  @ApiQuery({ name: 'orderType', required: false })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({
    name: 'ids',
    required: false,
    description: 'Comma-separated order IDs',
  })
  @ApiQuery({
    name: 'creditRequested',
    required: false,
    type: Boolean,
    description: 'Filter by creditRequest.status === REQUESTED',
  })
  @ApiQuery({
    name: 'transferPendingFor',
    required: false,
    description:
      'Filter by transferRequest.status === REQUESTED and toWaiterId === <uid>',
  })
  @ApiQuery({
    name: 'view',
    required: false,
    enum: ['payroll', 'payroll-waiter'],
    description: 'Named projection: only the fields that view needs',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description:
      'Cuantas ordenes como maximo. Tope duro de 500: pedir mas no sirve.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Pagina (1 en adelante). Se usa junto con limit.',
  })
  @ApiResponse({ status: 200, description: 'Orders listed' })
  async findAll(
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('tableId') tableId?: string,
    @Query('waiterId') waiterId?: string,
    @Query('orderType') orderType?: string,
    @Query('active') active?: boolean,
    @Query('ids') ids?: string,
    @Query('comisionPendiente') comisionPendiente?: string,
    @Query('creditRequested') creditRequested?: string,
    @Query('transferPendingFor') transferPendingFor?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('view') view?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.ordersService.findAll({
      status,
      paymentStatus,
      tableId,
      waiterId,
      orderType,
      active: active ? JSON.parse(String(active)) : undefined,
      ids: ids ? ids.split(',').filter(Boolean) : undefined,
      comisionPendiente: comisionPendiente === 'true',
      creditRequested: creditRequested === 'true',
      transferPendingFor,
      from,
      to,
      view,
      limit: limit !== undefined ? Number(limit) : undefined,
      page: page !== undefined ? Number(page) : undefined,
    });
  }

  /**
   * Ordenes por mesonero en la jornada, para el reparto round-robin.
   *
   * Antes lo resolvia el telefono bajandose `GET /api/orders` sin filtros:
   * 4.766 ordenes y 1,57 MB para obtener media docena de numeros, cada vez
   * que se asignaba un mesonero. Y contaba por medianoche local en vez de por
   * jornada (06:00-06:00), asi que pasada la medianoche la carga de todos
   * volvia a cero justo en hora pico.
   *
   * Va ANTES de `@Get(':id')`: si quedara despues, Nest tomaria
   * 'carga-por-mesonero' como un id de orden.
   */
  @Get('carga-por-mesonero')
  @ApiOperation({
    summary: 'Ordenes por mesonero en la jornada actual (para el reparto)',
  })
  @ApiQuery({
    name: 'waiterIds',
    required: true,
    description:
      'Mesoneros activos separados por coma. Los que no tomaron ninguna vuelven en 0.',
  })
  @ApiResponse({ status: 200, description: 'Carga por mesonero' })
  async getCargaPorMesonero(@Query('waiterIds') waiterIds?: string) {
    const ids = (waiterIds ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (ids.length === 0) return [];
    return this.ordersService.cargaPorMesonero(ids);
  }

  @Get('item-events/deliveries')
  @ApiOperation({
    summary:
      'Entregas (ITEM_DELIVERED) de un actor en un rango — resumen diario de barra/cocina',
  })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200, description: 'Deliveries listed' })
  async getDeliveries(
    @Query('actorId') actorId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const actor = actorId || req.user?.id;
    if (!actor) return [];
    return this.ordersService.getDeliveriesByActor(actor, from, to);
  }

  @Get('item-events/by-station')
  @ApiOperation({
    summary:
      'Historico de despachos de una estacion (barra/cocina/pizza) con mesonero/mesa',
  })
  @ApiQuery({ name: 'station', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200, description: 'Dispatch log listed' })
  async getDispatchLogByStation(
    @Query('station') station: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ) {
    if (!station) return [];
    return this.ordersService.getStationDispatchLog(station, from, to);
  }

  @Get(':id/item-events')
  @ApiOperation({ summary: 'Audit timeline (item events) for an order' })
  @ApiResponse({ status: 200, description: 'Events listed' })
  async getItemEvents(@Param('id') id: string) {
    return this.ordersService.getItemEvents(id);
  }

  // ───────── Fichas de barra ─────────
  // IMPORTANTE: 'ficha/:token' (2 segmentos) va ANTES de ':id' para que la
  // resolucion por orden de declaracion no haga que ':id' capture 'ficha'.

  @Get('ficha/:token')
  @ApiOperation({ summary: 'Leer ficha de barra por token (escaneo)' })
  @ApiResponse({ status: 200, description: 'Ficha válida con ítems de barra' })
  @ApiResponse({ status: 404, description: 'Ficha no válida o anulada' })
  @RequiereModulo('barTokens')
  async getFichaByToken(@Param('token') token: string) {
    return this.ordersService.getFichaByToken(token);
  }

  @Post('ficha/:token/deliver')
  @ApiOperation({
    summary: 'Entregar (parcial o total) contra una ficha de barra',
  })
  @ApiResponse({ status: 201, description: 'Entrega registrada' })
  @ApiResponse({
    status: 400,
    description: 'Delta inválido — no se aplicó ninguna entrega',
  })
  @ApiResponse({ status: 404, description: 'Ficha no válida o anulada' })
  @RequiereModulo('barTokens')
  async deliverByFicha(
    @Param('token') token: string,
    @Body() body: FichaDeliverDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.deliverByFicha(
      token,
      body.deliveries,
      req.user,
      body.station,
      body.opId,
    );
  }

  @Post('ficha/:token/return')
  @ApiOperation({
    summary: 'Registrar devolución de unidades contra una ficha',
  })
  @ApiResponse({ status: 201, description: 'Devolución registrada' })
  @ApiResponse({
    status: 400,
    description: 'Delta inválido — no se aplicó ninguna devolución',
  })
  @ApiResponse({ status: 404, description: 'Ficha no válida o anulada' })
  @RequiereModulo('barTokens')
  async returnByFicha(
    @Param('token') token: string,
    @Body() body: FichaReturnDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.returnByFicha(
      token,
      body.returns,
      req.user,
      body.station,
      body.opId,
    );
  }

  @Get(':id/ficha')
  @ApiOperation({ summary: 'Obtener token + saldo de la ficha de una orden' })
  @ApiResponse({ status: 200, description: 'Ficha con token para QR' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  @RequiereModulo('barTokens')
  async getFichaByOrderId(@Param('id') id: string) {
    return this.ordersService.getFichaByOrderId(id);
  }

  @Post(':id/ficha/regenerate')
  @ApiOperation({
    summary: 'Rotar el nonce de la ficha (revoca el papel viejo). PIN admin.',
  })
  @ApiResponse({ status: 201, description: 'Ficha regenerada' })
  @ApiResponse({ status: 401, description: 'PIN admin inválido o ausente' })
  @RequiereModulo('barTokens')
  async regenerateFicha(
    @Param('id') id: string,
    @Body() body: FichaRegenerateDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.regenerateFicha(id, body.adminPin, req.user);
  }

  // ── Vinculo cliente↔orden por QR (declarar 'link/:token' antes de ':id') ──

  @Get(':id/link-token')
  @ApiOperation({ summary: 'Token del QR "Conectar cliente" de una orden' })
  async getLinkToken(@Param('id') id: string) {
    return this.ordersService.getOrCreateLinkToken(id);
  }

  @Post(':id/link-token/rotate')
  @ApiOperation({ summary: 'Rotar el QR de vinculo (revoca el anterior)' })
  async rotateLinkToken(@Param('id') id: string) {
    return this.ordersService.rotateLinkToken(id);
  }

  @Post('link/:token')
  @ApiOperation({
    summary: 'Vincular al cliente autenticado con la orden (escaneo QR)',
  })
  @ApiResponse({ status: 201, description: 'Cliente vinculado a la orden' })
  @ApiResponse({ status: 400, description: 'QR invalido o vencido' })
  @ApiResponse({ status: 401, description: 'Requiere cliente autenticado' })
  async linkCustomer(@Param('token') token: string, @Req() req: AuthedRequest) {
    const customerId = req.user?.id;
    if (!customerId) {
      throw new UnauthorizedException('Inicia sesion para unirte a la mesa');
    }
    return this.ordersService.linkCustomer(token, customerId, req.user?.name);
  }

  @Post(':id/customer-request')
  @ApiOperation({
    summary:
      'El cliente vinculado crea una solicitud (producto/llamar/pedir algo)',
  })
  async createCustomerRequest(
    @Param('id') id: string,
    @Body() dto: CreateCustomerRequestDto,
    @Req() req: AuthedRequest,
  ) {
    const customerId = req.user?.id;
    if (!customerId) throw new UnauthorizedException('Inicia sesion');
    return this.ordersService.createCustomerRequest(id, customerId, dto);
  }

  @Patch(':id/customer-request/:reqId/resolve')
  @ApiOperation({
    summary: 'El staff resuelve una solicitud (aceptar/rechazar/reconocer)',
  })
  async resolveCustomerRequest(
    @Param('id') id: string,
    @Param('reqId') reqId: string,
    @Body() dto: ResolveCustomerRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.resolveCustomerRequest(
      id,
      reqId,
      req.user?.id ?? '',
      dto.action,
      dto.rejectReason,
    );
  }

  @Post(':id/request-bill')
  @ApiOperation({ summary: 'El cliente pide la cuenta' })
  async requestBill(@Param('id') id: string, @Req() req: AuthedRequest) {
    const customerId = req.user?.id;
    if (!customerId) throw new UnauthorizedException('Inicia sesion');
    return this.ordersService.requestBill(id, customerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.update(id, updateOrderDto, req.user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status only' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.updateStatus(id, updateStatusDto, req.user);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add item to existing order' })
  @ApiResponse({ status: 200, description: 'Item added' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async addItem(
    @Param('id') id: string,
    @Body() addItemDto: OrderItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.addItem(id, addItemDto, req.user);
  }

  @Delete(':id/items/:itemIndex')
  @ApiOperation({ summary: 'Remove item from order by index' })
  @ApiResponse({ status: 200, description: 'Item removed' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 400, description: 'Invalid item index' })
  async removeItem(
    @Param('id') id: string,
    @Param('itemIndex') itemIndex: string,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.removeItem(id, parseInt(itemIndex, 10), req.user);
  }

  // ───────── Acciones atomicas sobre items (Fase 2) ─────────

  @Patch(':id/items/:itemId/deliver')
  @ApiOperation({
    summary: 'Cocina/barra marca item como entregado (incremento atomico)',
  })
  @ApiResponse({ status: 200, description: 'Item marcado como entregado' })
  @ApiResponse({
    status: 400,
    description: 'No se pueden entregar mas unidades de las pedidas',
  })
  @ApiResponse({ status: 404, description: 'Order o item no encontrado' })
  async deliverItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: DeliverItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.deliverItem(
      id,
      itemId,
      body.delta ?? 1,
      req.user,
    );
  }

  @Patch(':id/deliver-station/:station')
  @ApiOperation({
    summary:
      'Bulk: cocina/barra marca como entregados todos los items pendientes de la estacion',
  })
  @ApiResponse({ status: 200, description: 'Items marcados como entregados' })
  @ApiResponse({ status: 404, description: 'Order no encontrada' })
  async deliverStation(
    @Param('id') id: string,
    @Param('station') station: string,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.deliverStation(id, station, req.user);
  }

  @Patch(':id/items/:itemId/cancel')
  @ApiOperation({
    summary: 'Cancelar item (borrado logico, solo si deliveredQty=0). Sin PIN.',
  })
  @ApiResponse({ status: 200, description: 'Item cancelado' })
  @ApiResponse({
    status: 400,
    description:
      'Item ya entregado parcialmente (usar /no-charge) o ya cancelado',
  })
  @ApiResponse({ status: 404, description: 'Order o item no encontrado' })
  async cancelItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: CancelItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.cancelItem(id, itemId, body.reason, req.user);
  }

  @Post(':id/full-courtesy')
  @ApiOperation({
    summary:
      'Cortesía TOTAL: toda la orden gratis (cliente paga $0). PIN admin + motivo OBLIGATORIOS. Cierra la orden, libera mesa y descuenta inventario. La comisión del mesonero se conserva.',
  })
  @ApiResponse({ status: 200, description: 'Cortesía total aplicada' })
  @ApiResponse({
    status: 400,
    description: 'Orden pagada/cancelada o sin items',
  })
  @ApiResponse({ status: 401, description: 'PIN admin invalido o ausente' })
  async fullCourtesy(
    @Param('id') id: string,
    @Body() body: NoChargeItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.fullCourtesy(
      id,
      body.reason,
      body.adminPin,
      req.user,
      body.responsible,
    );
  }

  @Patch(':id/items/:itemId/no-charge')
  @ApiOperation({
    summary:
      'Marcar item como cortesia (no cobrar). Item permanece en factura. PIN admin OBLIGATORIO.',
  })
  @ApiResponse({ status: 200, description: 'Cortesia aplicada' })
  @ApiResponse({ status: 400, description: 'Item cancelado o ya en cortesia' })
  @ApiResponse({ status: 401, description: 'PIN admin invalido o ausente' })
  @ApiResponse({ status: 404, description: 'Order o item no encontrado' })
  async noChargeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: NoChargeItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.noChargeItem(
      id,
      itemId,
      body.reason,
      body.adminPin,
      req.user,
      body.responsible,
    );
  }

  @Patch(':id/items/:itemId/discount')
  @ApiOperation({
    summary:
      'Descuento parcial sobre una linea (% o monto). PIN admin y motivo OBLIGATORIOS. Baja la base del 10% de servicio.',
  })
  @ApiResponse({ status: 200, description: 'Descuento aplicado' })
  @ApiResponse({
    status: 400,
    description:
      'Orden pagada, item cancelado/cortesia, o descuento sobre el tope',
  })
  @ApiResponse({ status: 401, description: 'PIN admin invalido o ausente' })
  @ApiResponse({ status: 404, description: 'Order o item no encontrado' })
  async discountItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: DiscountItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.discountItem(id, itemId, body, req.user);
  }

  @Delete(':id/items/:itemId/discount')
  @ApiOperation({
    summary:
      'Quitar un descuento mal aplicado. PIN admin y motivo OBLIGATORIOS.',
  })
  @ApiResponse({ status: 200, description: 'Descuento revertido' })
  @ApiResponse({ status: 400, description: 'El item no tiene descuento' })
  @ApiResponse({ status: 401, description: 'PIN admin invalido o ausente' })
  async removeItemDiscount(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: RemoveItemDiscountDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.removeItemDiscount(id, itemId, body, req.user);
  }

  @Post(':id/descartar-sin-cobrar')
  @ApiOperation({
    summary:
      'Descarta una orden recien creada que aun no se cobro (atras en la pantalla de cobro)',
  })
  @ApiResponse({ status: 201, description: 'Orden descartada' })
  @ApiResponse({
    status: 409,
    description: 'La orden ya tiene cobro o productos despachados',
  })
  async descartarSinCobrar(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.descartarSinCobrar(id, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  // Ninguna pantalla llama a esto: el POS resetea mesas con
  // `cancel-with-pin`, que exige PIN de admin y deja la orden anulada en vez
  // de borrarla. Sin rol, la ruta quedaba abierta a cualquiera con la sesion
  // de un mesonero — y borrar una orden entregada hacia desaparecer la venta
  // dejando el producto descontado. Verificado el 04/09: HTTP 200.
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary:
      'Borrar orden (libera la mesa y DEVUELVE al almacen lo ya entregado)',
  })
  @ApiResponse({ status: 200, description: 'Order deleted' })
  @ApiResponse({ status: 403, description: 'Solo admin o manager' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.ordersService.remove(id, req.user);
  }

  @Get(':id/opciones-conversion')
  @ApiOperation({
    summary:
      'Conversiones a pack disponibles (tobo/media caja/caja). NO convierte nada.',
  })
  @ApiResponse({ status: 200, description: 'Opciones disponibles' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @RequiereModulo('packsAndBuckets')
  async getOpcionesConversion(@Param('id') id: string) {
    return this.ordersService.getOpcionesDeConversion(id);
  }

  @Post(':id/convertir-pack')
  @ApiOperation({
    summary:
      'Aplica UNA conversion elegida. El precio lo pone el servidor, del catalogo.',
  })
  @ApiResponse({ status: 201, description: 'Conversion aplicada' })
  @ApiResponse({
    status: 400,
    description:
      'La conversion no esta disponible o pide mas packs de los posibles',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @RequiereModulo('packsAndBuckets')
  async convertirPack(
    @Param('id') id: string,
    @Body() dto: ConvertirPackDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.convertirPack(id, dto, req.user);
  }

  @Post(':id/additional-notes')
  @ApiOperation({
    summary: 'Append an additional note to order (preserves original)',
  })
  @ApiResponse({ status: 200, description: 'Note appended' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async addAdditionalNote(
    @Param('id') id: string,
    @Body()
    body: {
      text: string;
      authorId?: string;
      authorName?: string;
      system?: boolean;
    },
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.addAdditionalNote(
      id,
      body.text,
      body.authorId,
      body.authorName,
      req.user,
      body.system,
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary:
      'Soft delete order with admin PIN (status=CANCELLED, isDeleted=true)',
  })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 401, description: 'Invalid PIN' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(
    @Param('id') id: string,
    @Body()
    body: { pin: string; reason?: string; userId?: string; userName?: string },
  ) {
    return this.ordersService.cancelWithPin(
      id,
      body.pin,
      body.reason,
      body.userId,
      body.userName,
    );
  }

  @Post(':id/merge')
  @ApiOperation({
    summary:
      'Fusionar otra orden dentro de esta: mueve sus items y libera su mesa. PIN admin.',
  })
  @ApiResponse({ status: 201, description: 'Orden fusionada' })
  @ApiResponse({
    status: 400,
    description: 'Las ordenes no se pueden fusionar',
  })
  @ApiResponse({ status: 401, description: 'PIN invalido' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  async mergeOrders(
    @Param('id') id: string,
    @Body() dto: MergeOrderDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.mergeOrders(id, dto.sourceOrderId, dto.pin, {
      id: req.user?.id,
      name: req.user?.name,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Solicitudes de Crédito
  // ─────────────────────────────────────────────────────────────

  @Post(':id/credit-request')
  @ApiOperation({
    summary: 'Mesonero solicita dejar pendiente (crédito) una orden',
  })
  @ApiResponse({ status: 201, description: 'Solicitud de crédito creada' })
  @ApiResponse({
    status: 400,
    description: 'Orden no válida para solicitar crédito',
  })
  @ApiResponse({ status: 403, description: 'Solo el mesonero puede solicitar' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  async requestCredit(
    @Param('id') id: string,
    @Body() createCreditRequestDto: CreateCreditRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.requestCredit(
      id,
      createCreditRequestDto,
      req.user,
    );
  }

  @Post(':id/credit-request/cancel')
  @ApiOperation({
    summary: 'Mesonero cancela su solicitud de crédito pendiente',
  })
  @ApiResponse({ status: 200, description: 'Solicitud cancelada' })
  @ApiResponse({
    status: 400,
    description: 'Solicitud no en estado REQUESTED',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo quien la solicitud puede cancelarla',
  })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  async cancelCreditRequest(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.cancelCreditRequest(id, req.user);
  }

  @Post(':id/credit-request/approve')
  @ApiOperation({
    summary:
      'Admin aprueba solicitud de crédito con PIN (crea cuenta por cobrar, libera mesa)',
  })
  @ApiResponse({ status: 200, description: 'Solicitud aprobada' })
  @ApiResponse({ status: 400, description: 'Solicitud no en estado REQUESTED' })
  @ApiResponse({ status: 401, description: 'PIN inválido' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  async approveCreditRequest(
    @Param('id') id: string,
    @Body() approveCreditRequestDto: ApproveCreditRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.approveCreditRequest(
      id,
      approveCreditRequestDto,
      req.user,
    );
  }

  @Post(':id/credit-request/reject')
  @ApiOperation({
    summary: 'Staff rechaza solicitud de crédito (sin PIN)',
  })
  @ApiResponse({ status: 200, description: 'Solicitud rechazada' })
  @ApiResponse({ status: 400, description: 'Solicitud no en estado REQUESTED' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  async rejectCreditRequest(
    @Param('id') id: string,
    @Body() rejectCreditRequestDto: RejectCreditRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.rejectCreditRequest(
      id,
      rejectCreditRequestDto,
      req.user,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Transferencia de Mesas
  // ─────────────────────────────────────────────────────────────

  @Post(':id/transfer-request')
  @ApiOperation({
    summary: 'Camarero solicita transferir mesa a otro camarero',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud de transferencia creada',
  })
  @ApiResponse({
    status: 400,
    description: 'Validación fallida (pcts no-suma-100, orden pagada, etc.)',
  })
  @ApiResponse({
    status: 403,
    description: 'No eres el camarero de esta orden',
  })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  async createTransferRequest(
    @Param('id') id: string,
    @Body() createTransferRequestDto: CreateTransferRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.createTransferRequest(
      id,
      createTransferRequestDto,
      req.user,
    );
  }

  @Post(':id/transfer-request/accept')
  @ApiOperation({
    summary: 'Camarero acepta transferencia de mesa (crea waiterShares)',
  })
  @ApiResponse({ status: 200, description: 'Transferencia aceptada' })
  @ApiResponse({
    status: 400,
    description: 'No hay solicitud de transferencia pendiente',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo el camarero designado puede aceptar',
  })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  async acceptTransferRequest(
    @Param('id') id: string,
    @Body() _body: AcceptTransferRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.acceptTransferRequest(id, req.user);
  }

  @Post(':id/transfer-request/reject')
  @ApiOperation({
    summary: 'Camarero rechaza transferencia de mesa',
  })
  @ApiResponse({ status: 200, description: 'Transferencia rechazada' })
  @ApiResponse({
    status: 400,
    description: 'No hay solicitud de transferencia pendiente',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo el camarero designado puede rechazar',
  })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  async rejectTransferRequest(
    @Param('id') id: string,
    @Body() rejectTransferRequestDto: RejectTransferRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.rejectTransferRequest(
      id,
      rejectTransferRequestDto,
      req.user,
    );
  }

  @Post(':id/transfer-request/cancel')
  @ApiOperation({
    summary: 'Camarero cancela su solicitud de transferencia',
  })
  @ApiResponse({ status: 200, description: 'Solicitud cancelada' })
  @ApiResponse({
    status: 400,
    description: 'No hay solicitud de transferencia pendiente',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo quien solicita puede cancelarla',
  })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  async cancelTransferRequest(
    @Param('id') id: string,
    @Body() cancelTransferRequestDto: CancelTransferRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.ordersService.cancelTransferRequest(
      id,
      cancelTransferRequestDto,
      req.user,
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CostPropagationService } from './cost-propagation.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { RecalcularCostosDto } from './dto/recalcular-costos.dto';

interface AuthedRequest {
  user?: { id: string; email?: string; role?: string };
}
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('products')
@Controller('api/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly costPropagation: CostPropagationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all products with optional filters' })
  @ApiResponse({ status: 200, description: 'List of products' })
  findAll(
    @Req() req: AuthedRequest,
    @Query('active') active?: string,
    @Query('categoryId') categoryId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('station') station?: string,
    @Query('forSale') forSale?: string,
    @Query('vista') vista?: string,
    @Query('q') q?: string,
    @Query('ids') ids?: string,
  ) {
    // ── Cada estacion ve SU mundo, pero solo cuando lo pide ──
    // Cocina veia licores y bebidas de barra en sus listados. El filtro es
    // OPT-IN (`?station=`) y NO se aplica solo por el rol, a proposito: la
    // pantalla de despacho necesita el catalogo COMPLETO para distinguir pizza
    // de cocina por `categoryId`, y scopearla a ciegas mandaria las pizzas a
    // la cola equivocada.
    //
    // El blindaje va en el valor: cocina/barra/pizza reciben SIEMPRE su propia
    // estacion, sin importar cual pidan, asi que un APK viejo o manipulado no
    // puede espiar el catalogo de otra.
    const stationDelRol = ProductsService.stationDeRol(req.user?.role);
    const filters = {
      active: active === 'true',
      categoryId,
      supplierId,
      station: station ? (stationDelRol ?? station) : undefined,
      // Los dos son OPT-IN: sin ellos la respuesta es la de siempre, campo por
      // campo y con los 585 productos. Los APK que estan en la calle hoy no se
      // enteran. Ver `vista-de-menu.util.ts`.
      forSale,
      vista,
      // Buscar es del servidor desde el 25/09/2026: la web y el APK mandan lo
      // que se tecleo y la API decide, con la misma regla para las dos (sin
      // tildes, sin mayusculas, palabra por palabra). Sin `q` no cambia nada.
      q,
      // Filtrado por IDs (OPT-IN): cuando se pasan IDs separados por coma,
      // retorna solo esos productos. Util para cargar datos parciales en la
      // pantalla de cobro (ejemplo: solo los productos de una orden).
      // Sin `ids` se retorna el catalogo completo como siempre.
      ids: ids ? ids.split(',').filter(Boolean) : undefined,
    };
    return this.productsService.findAll(filters);
  }

  // ANTES de ':id': si no, Nest resuelve "preparers" como un id de producto.
  @Get('preparers')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.KITCHEN,
    UserRoleEnum.BAR,
    UserRoleEnum.PIZZA,
  )
  @ApiOperation({
    summary: 'Empleados que pueden figurar como preparadores (sin sueldos)',
  })
  listPreparers() {
    return this.productsService.listPreparers();
  }

  // ── Márgenes ──
  // OJO: estas rutas van ANTES de @Get(':id') o Nest se las traga como si
  // "margenes" fuera el id de un producto.

  @Get('margenes')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary: 'Productos que hoy se venden con margen bajo, nulo o negativo',
  })
  listarMargenes() {
    return this.costPropagation.listarAbiertas();
  }

  @Post('recalcular-costos')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary:
      'Recalcula el costo de todos los preparados (dryRun = solo vista previa; los cambios sospechosos se retienen)',
  })
  async recalcularCostos(@Body() dto: RecalcularCostosDto) {
    const { cambios, alertas, retenidos, omitidos, dryRun } =
      await this.costPropagation.recalcularTodo({
        dryRun: dto?.dryRun === true,
        forzar: dto?.forzar === true,
      });
    return {
      dryRun,
      costosActualizados: cambios,
      retenidos,
      omitidos,
      alertas,
      total: alertas.length,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // OJO: este endpoint va ANTES de PATCH ':id' solo por claridad — Nest
  // resuelve por especificidad, pero mantener el orden evita sustos.
  @Patch(':id/recipe')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.KITCHEN,
    UserRoleEnum.BAR,
    UserRoleEnum.PIZZA,
  )
  @ApiOperation({
    summary:
      'Editar SOLO la receta (personal de estación: cada uno su station)',
  })
  @ApiResponse({ status: 200, description: 'Receta actualizada' })
  @ApiResponse({ status: 403, description: 'Producto de otra estación' })
  updateRecipe(
    @Param('id') id: string,
    @Body() dto: UpdateRecipeDto,
    @Req() req: AuthedRequest,
  ) {
    return this.productsService.updateRecipe(id, dto, req.user);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Soft delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 400,
    description: 'Lo usan recetas activas (usar ?forzar=true para insistir)',
  })
  remove(@Param('id') id: string, @Query('forzar') forzar?: string) {
    return this.productsService.softDelete(id, forzar === 'true');
  }
}

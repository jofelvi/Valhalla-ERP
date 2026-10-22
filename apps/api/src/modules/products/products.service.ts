import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductTypeEnum } from '@odin6/types';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import {
  computeTheoreticalUnitCost,
  ProductForRecipeCost,
} from '../inventory/recipe-cost.helper';
import {
  InsumoParaValidar,
  ProductoClasificable,
  ingredientesValidos,
  naturalezaDe,
  validarNaturaleza,
} from './product-nature.util';
import { revisarCordura } from './recipe-limits.util';
import { ConfigsService } from '../configs/configs.service';
import { condicionDeVenta, proyeccionPedida } from './vista-de-menu.util';
import { filtroDeTexto } from '../../common/busqueda-texto.util';
import { baseUnitOf, toBaseQty } from '../inventory/units';
import { Employee } from '../employees/schemas/employee.schema';
import {
  costoManoDeObra,
  HORAS_POR_DIA_POR_DEFECTO,
} from './labor-cost.helper';

// Cada estación solo carga recetas de SU mundo (regla del dueño):
// barra → bebidas y tragos, pizza → pizzas, cocina → platos de cocina.
const STATION_BY_ROLE: Record<string, string> = {
  kitchen: 'KITCHEN',
  bar: 'BAR',
  pizza: 'PIZZA',
};
const STATION_LABEL: Record<string, string> = {
  KITCHEN: 'COCINA',
  BAR: 'BARRA',
  PIZZA: 'PIZZA',
};

/**
 * Donde se busca un producto cuando llega `?q=`. El nombre es lo normal; el
 * codigo de barras y el SKU son lo que se escanea o se dicta por telefono.
 */
const CAMPOS_BUSCABLES = ['name', 'sku', 'barcode', 'description'] as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('Productos');
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Employee.name) private employeeModel: Model<Employee>,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Quienes pueden figurar como preparadores de un plato.
   *
   * Devuelve nombre y cargo, NUNCA el sueldo: la pantalla la usa el personal de
   * estacion y el sueldo de un companero no es asunto suyo. El costo del tiempo
   * lo calcula el servidor.
   */
  async listPreparers(): Promise<
    Array<{ id: string; name: string; position: string }>
  > {
    const empleados = await this.employeeModel
      .find({ isActive: { $ne: false }, esMesonero: { $ne: true } })
      .select({ firstName: 1, lastName: 1, position: 1 })
      .lean()
      .exec();

    return empleados
      .map((e) => ({
        id: String(e._id),
        name: `${e.firstName ?? ''} ${e.lastName ?? ''}`
          .replace(/\s+/g, ' ')
          .trim(),
        position: String(e.position ?? ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  /**
   * Estacion que le toca a un rol, o null si el rol ve todo el catalogo.
   * Reusa el mismo mapa que ya blinda la edicion de recetas.
   */
  static stationDeRol(role?: string): string | null {
    return STATION_BY_ROLE[String(role ?? '').toLowerCase()] ?? null;
  }

  async findAll(filters?: {
    active?: boolean;
    categoryId?: string;
    supplierId?: string;
    /**
     * `true` = solo lo vendible HOY (activo Y a la venta). Antes cada pantalla
     * del movil se bajaba los 585 productos y filtraba estas dos banderas en
     * el telefono, en nueve sitios distintos.
     */
    forSale?: string;
    /**
     * `menu` recorta a los campos que necesita una pantalla que vende. Sin
     * esto la respuesta es la de siempre: los APK viejos no se enteran.
     */
    vista?: string;
    /**
     * Estacion a listar. Cocina/barra/pizza solo pueden pedir la SUYA: el
     * controller la deriva del rol e ignora lo que mande el cliente, asi que
     * un APK viejo no puede saltarselo.
     */
    station?: string;
    /**
     * Texto libre. Ignora tildes y mayusculas, y exige que TODAS las palabras
     * aparezcan en algun campo, en cualquier orden — la misma regla que usan
     * los clientes y las cuentas por cobrar (`common/busqueda-texto.util.ts`).
     *
     * Vive en el servidor por decision del dueno (25/09/2026): la web y el APK
     * filtraban cada una por su cuenta con `toLowerCase().includes()`, asi que
     * buscar «te de jamaica» sin tilde no encontraba «Té de Jamaica» y se creo
     * un producto duplicado que termino descontando inventario por su cuenta.
     */
    q?: string;
    /**
     * Array de IDs de productos a retornar (OPT-IN).
     * Util para cargar datos parciales: cuando se especifica, retorna solo
     * esos productos en vez de todo el catalogo. Sin esto se retorna el
     * catalogo completo, como siempre. Los APK viejos nunca lo usan.
     */
    ids?: string[];
  }) {
    const query: Record<string, unknown> = {};

    if (filters?.active === true) {
      query.isActive = true;
    }

    if (filters?.categoryId) {
      query.categoryId = filters.categoryId;
    }

    if (filters?.supplierId) {
      query.supplierIds = { $in: [filters.supplierId] };
    }

    // ── Cada estacion ve SU mundo (26/08/2026) ──
    // Cocina veia licores y bebidas de barra en sus listados. Los 45 productos
    // sin estacion se incluyen a proposito: son insumos y empaques comunes
    // (envases, servilletas) que cualquier estacion necesita; dejarlos fuera
    // esconderia cosas que si usan.
    if (filters?.station) {
      const est = String(filters.station).toUpperCase();
      query.$or = [
        { station: est },
        { station: null },
        { station: { $exists: false } },
      ];
    }

    const venta = condicionDeVenta(filters?.forSale);
    if (venta) Object.assign(query, venta);

    // El texto usa `$and`, asi que convive con el `$or` de la estacion sin
    // pisarlo. Sin texto no agrega nada: un cliente que no manda `q` recibe
    // exactamente lo de siempre.
    const porTexto = filtroDeTexto(filters?.q, CAMPOS_BUSCABLES);
    if (porTexto) Object.assign(query, porTexto);

    // Filtrado por IDs (OPT-IN): si se pasan IDs, retorna solo esos.
    // Sin esto el comportamiento es el de siempre (catalogo completo).
    if (filters?.ids && filters.ids.length > 0) {
      query._id = { $in: filters.ids };
    }

    const proyeccion = proyeccionPedida(filters?.vista);
    const cursor = this.productModel.find(query);
    const products = await (proyeccion ? cursor.select(proyeccion) : cursor)
      .lean()
      .exec();
    return products.map((product) => ({ ...product, id: product._id }));
  }

  async findById(id: string) {
    const product = await this.productModel.findOne({ _id: id }).lean().exec();
    if (!product) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }
    return { ...product, id: product._id };
  }

  /**
   * Catalogo de los productos que hacen falta para validar una receta.
   * Trae TODOS los referenciados (incluidos los semielaborados COMPUESTO como
   * Masa de Pizza): filtrarlos por isForInventory era lo que hacia que la
   * auditoria los diera por inexistentes.
   */
  private async catalogoParaValidar(
    estado: ProductoClasificable,
  ): Promise<Map<string, InsumoParaValidar>> {
    const ids = ingredientesValidos(estado).map((i) => String(i.productId));
    if (ids.length === 0) return new Map();
    const insumos = await this.productModel
      .find({ _id: { $in: Array.from(new Set(ids)) } })
      .lean()
      .exec();
    return new Map(
      (insumos as unknown as InsumoParaValidar[]).map((p) => [
        String(p._id),
        p,
      ]),
    );
  }

  /**
   * Aplica la naturaleza o lanza 400 con los motivos, en español y accionables.
   * `isForInventory` NO se acepta del cliente: se deriva de `type`.
   */
  private async normalizarNaturaleza(
    estado: ProductoClasificable,
    destino: Record<string, unknown>,
  ): Promise<void> {
    const catalogo = await this.catalogoParaValidar(estado);
    const r = validarNaturaleza(estado, catalogo);
    if (!r.ok) throw new BadRequestException(r.errores.join(' '));
    Object.assign(destino, r.cambios);
    // La subcategoría solo aplica a insumos (BASE): si la naturaleza final no
    // es BASE se limpia, para no dejar un dato huérfano (mismo criterio con el
    // que la naturaleza fuerza los ingredientes según el tipo).
    const tipoFinal = String(destino.type ?? estado.type ?? '');
    if (tipoFinal !== ProductTypeEnum.BASE) {
      destino.subcategoryId = null;
    }
  }

  async create(createProductDto: CreateProductDto) {
    const datos: Record<string, unknown> = { ...createProductDto };
    await this.normalizarNaturaleza(datos as ProductoClasificable, datos);
    const product = new this.productModel(datos);
    const saved = await product.save();
    const obj = saved.toObject();
    return { ...obj, id: String(obj._id) };
  }

  /**
   * Edición de receta por el personal de estación (o admin/manager).
   *
   * Autorización EXPLÍCITA aquí y no solo en guards: los guards JWT del
   * proyecto son permisivos (dejan pasar requests sin user) — lección de la
   * auditoría de seguridad. Y el scoping es de negocio: cada estación solo
   * toca productos de su station.
   */
  async updateRecipe(
    id: string,
    dto: UpdateRecipeDto,
    user?: { id?: string; email?: string; role?: string },
  ) {
    if (!user?.role) {
      throw new UnauthorizedException('Se requiere autenticación');
    }
    const roleLc = String(user.role).toLowerCase();
    const esAdmin = roleLc === 'admin' || roleLc === 'manager';
    const stationDelRol = STATION_BY_ROLE[roleLc];
    if (!esAdmin && !stationDelRol) {
      throw new ForbiddenException('Tu rol no puede editar recetas');
    }

    const product = await this.productModel.findOne({ _id: id }).lean().exec();
    if (!product) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }

    const stationProducto = String(product.station ?? '').toUpperCase();
    if (!esAdmin && stationProducto !== stationDelRol) {
      const donde = STATION_LABEL[stationProducto] ?? 'otra estación';
      throw new ForbiddenException(
        `"${product.name}" es de ${donde}: solo puedes editar recetas de tu estación (${STATION_LABEL[stationDelRol]})`,
      );
    }

    // Validar que cada insumo exista (una receta con ingrediente fantasma no
    // descuenta nada y el faltante parecería robo del personal).
    const insumoIds = Array.from(
      new Set(dto.ingredients.map((i) => i.productId)),
    );
    const insumos = insumoIds.length
      ? await this.productModel
          .find({ _id: { $in: insumoIds } })
          .lean()
          .exec()
      : [];
    if (insumos.length !== insumoIds.length) {
      const hallados = new Set(insumos.map((p) => String(p._id)));
      const faltan = insumoIds.filter((i) => !hallados.has(i));
      throw new BadRequestException(
        `Ingrediente(s) inexistente(s): ${faltan.join(', ')}`,
      );
    }
    if (insumoIds.some((i) => i === id)) {
      throw new BadRequestException(
        'Un producto no puede ser ingrediente de sí mismo',
      );
    }

    // Tope de cordura. Sin esto se guardaba "999.999.999 kg" por plato, y el
    // descuento al entregar lo multiplica por lo vendido: un cero de más vacía
    // el insumo en una sola venta y el faltante aparece luego en el conteo
    // como si fuera robo. Los límites salen del catálogo real, no inventados.
    const porId = new Map(insumos.map((p) => [String(p._id), p]));
    const medidos = dto.ingredients.map((i) => {
      const insumo = porId.get(i.productId);
      const base = baseUnitOf(String(insumo?.presentation ?? i.unit));
      let cantidadBase: number;
      try {
        cantidadBase = toBaseQty(i.quantity, i.unit, base, insumo);
      } catch {
        // Unidad incompatible: de eso ya se queja validarNaturaleza con un
        // mensaje mejor. Aquí se mide en crudo para no tapar aquel error.
        cantidadBase = i.quantity;
      }
      return {
        nombre: String(insumo?.name ?? i.productId),
        cantidadBase,
        base,
      };
    });
    const cordura = revisarCordura(
      medidos,
      (await this.configs.obtener('operacion')).locale,
    );
    if (cordura.errores.length) {
      throw new BadRequestException(cordura.errores.join(' '));
    }

    const cambios: Record<string, unknown> = {
      ingredients: dto.ingredients.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unit: i.unit,
        wastePercentage: i.wastePercentage ?? 0,
      })),
      recipeUpdatedBy: user.email ?? user.id ?? 'desconocido',
      recipeUpdatedAt: new Date(),
    };
    // La naturaleza la deriva el servidor del estado final (receta + lo que
    // pida el cliente), nunca se toma cruda del DTO: "se descuenta directo"
    // sobre un plato lo dejaba descontándose a sí mismo (así los tobos
    // vaciaban un stock fantasma en vez de las cervezas).
    const estadoFinal = {
      ...(product as unknown as ProductoClasificable),
      ingredients: cambios.ingredients as ProductoClasificable['ingredients'],
      ...(typeof dto.isForInventory === 'boolean'
        ? { isForInventory: dto.isForInventory }
        : {}),
      // Sin receta y marcado "directo", el producto pasa a ser un INSUMO.
      ...(dto.ingredients.length === 0 && dto.isForInventory === true
        ? { type: ProductTypeEnum.BASE }
        : {}),
    } as ProductoClasificable;

    const catalogoReceta = new Map<string, InsumoParaValidar>(
      insumos.map((p) => [String(p._id), p as unknown as InsumoParaValidar]),
    );
    const naturaleza = validarNaturaleza(estadoFinal, catalogoReceta);
    if (!naturaleza.ok) {
      // Se detiene aquí a propósito: una receta con la unidad equivocada se
      // guardaba igual y NUNCA descontaba, y el faltante aparecía después en
      // el conteo como si fuera robo del personal.
      throw new BadRequestException(naturaleza.errores.join(' '));
    }
    Object.assign(cambios, naturaleza.cambios);

    // ── Tiempo de preparacion y su costo ────────────────────────────────────
    // El minuto se valora con el sueldo de quien prepara. Se guarda como
    // `laborCost` aparte de `cost` a proposito: `cost` valora el inventario y
    // meter el sueldo ahi descuadraria el kardex contra la nevera.
    if (dto.prepTimeMinutes !== undefined) {
      cambios.prepTimeMinutes = dto.prepTimeMinutes;
    }
    if (dto.preparedByEmployeeId !== undefined) {
      const empleado = dto.preparedByEmployeeId
        ? await this.employeeModel
            .findOne({ _id: dto.preparedByEmployeeId })
            .lean()
            .exec()
        : null;
      if (dto.preparedByEmployeeId && !empleado) {
        throw new BadRequestException(
          `El empleado ${dto.preparedByEmployeeId} no existe`,
        );
      }
      cambios.preparedByEmployeeId = dto.preparedByEmployeeId || undefined;
      cambios.preparedByName = empleado
        ? `${empleado.firstName ?? ''} ${empleado.lastName ?? ''}`
            .replace(/\s+/g, ' ')
            .trim()
        : undefined;
    }

    const minutos =
      dto.prepTimeMinutes ??
      (product as { prepTimeMinutes?: number }).prepTimeMinutes ??
      0;
    const idPreparador =
      dto.preparedByEmployeeId ??
      (product as { preparedByEmployeeId?: string }).preparedByEmployeeId;
    if (minutos > 0 && idPreparador) {
      const quien = await this.employeeModel
        .findOne({ _id: idPreparador })
        .select({ salary: 1 })
        .lean()
        .exec();
      // Sin sueldo cargado el helper devuelve 0: se guarda el tiempo igual,
      // porque el dato del tiempo sirve aunque el sueldo llegue despues.
      cambios.laborCost = costoManoDeObra(
        minutos,
        Number(quien?.salary ?? 0),
        HORAS_POR_DIA_POR_DEFECTO,
      );
    } else if (dto.prepTimeMinutes === 0 || dto.preparedByEmployeeId === '') {
      cambios.laborCost = 0;
    }

    if (dto.ingredients.length > 0) {
      // Con receta el producto es PREPARADO y su costo teórico se recalcula
      // para que el margen del plato quede al día. El `type` lo decide el
      // helper de naturaleza (antes se escribía el literal 'MIXED', que NO es
      // un valor del enum — 'COMPUESTO' — y Mongoose no valida enums en los
      // updates, así que el dato quedaba corrupto sin que nadie lo notara).
      const productById = new Map<string, ProductForRecipeCost>(
        insumos.map((p) => [String(p._id), p as ProductForRecipeCost]),
      );
      const costo = computeTheoreticalUnitCost(
        {
          ...(product as ProductForRecipeCost),
          ingredients:
            cambios.ingredients as ProductForRecipeCost['ingredients'],
        },
        1,
        productById,
        new Logger('Recetas'),
      );
      if (costo !== null && Number.isFinite(costo)) {
        cambios.cost = Math.round(costo * 10000) / 10000;
      }
    }

    // Aviso de recetas anidadas.
    //
    // La expansion de receta es de UN SOLO NIVEL (ver expandRecipeIngredients):
    // si un ingrediente es a su vez un producto con receta (masa, salsa), lo
    // que se descuenta es ESE producto de su propio stock, NO su harina ni su
    // tomate. Eso esta bien cuando la masa se produce y se carga con el modulo
    // de produccion; si nadie la produce nunca, el stock se va a negativo y la
    // harina no baja jamas. Se avisa en vez de prohibirlo: el semielaborado es
    // una practica legitima de cocina.
    const avisos: string[] = [];
    for (const ins of insumos) {
      const sub = ins as unknown as { name?: string; ingredients?: unknown[] };
      if (sub.ingredients?.length) {
        avisos.push(
          `"${sub.name}" es un producto compuesto: al vender se le descuenta a ÉL, no a sus ingredientes. Registra su producción para que su stock no quede en negativo.`,
        );
      }
    }

    const actualizado = await this.productModel
      .findOneAndUpdate({ _id: id }, { $set: cambios }, { new: true })
      .lean()
      .exec();
    return { ...actualizado, id: String(actualizado!._id), avisos };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const datos: Record<string, unknown> = { ...updateProductDto };

    // ── Naturaleza: se valida el ESTADO FINAL, no el PATCH suelto ──
    // Solo cuando la peticion toca la naturaleza. Un PATCH de {cost} (el que
    // manda el recalculo de costos) o de precio desde un APK viejo no puede
    // fallar por un producto legacy que aun no tiene naturaleza decidida: eso
    // se resuelve desde /private/recipes, no bloqueando el dia a dia.
    const tocaNaturaleza =
      'type' in datos || 'ingredients' in datos || 'isForInventory' in datos;
    if (tocaNaturaleza) {
      const actual = await this.productModel.findOne({ _id: id }).lean().exec();
      if (!actual) {
        throw new NotFoundException(`Producto con id ${id} no encontrado`);
      }
      const estado = { ...actual, ...datos } as ProductoClasificable;
      await this.normalizarNaturaleza(estado, datos);
    }

    const product = await this.productModel
      .findOneAndUpdate({ _id: id }, datos, { new: true })
      .lean()
      .exec();

    if (!product) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }

    return { ...product, id: product._id };
  }

  /**
   * Retira un producto del catalogo (borrado LOGICO).
   *
   * Si es ingrediente de alguna receta, se frena: al desactivarlo, esas recetas
   * dejan de descontar EN SILENCIO y el faltante aparece despues en el conteo
   * como si fuera robo del personal. Es exactamente el patron que dejo 6
   * recetas rotas en produccion (Cuba Libre, Mojito, los servicios de ron).
   *
   * Se puede forzar con `?forzar=true` cuando de verdad se quiere: entonces se
   * avisa por el log con la lista, para que quede rastro de que se sabia.
   */
  async softDelete(id: string, forzar = false) {
    const usadoEn = await this.productModel
      .find(
        { 'ingredients.productId': id, isActive: { $ne: false } },
        { name: 1 },
      )
      .lean()
      .exec();

    if (usadoEn.length > 0 && !forzar) {
      const nombres = usadoEn
        .slice(0, 5)
        .map((p) => p.name)
        .join(', ');
      const resto = usadoEn.length > 5 ? ` y ${usadoEn.length - 5} mas` : '';
      throw new BadRequestException(
        `No se puede retirar: lo usan ${usadoEn.length} receta(s) — ${nombres}${resto}. ` +
          'Quitalo de esas recetas primero, o esos platos dejaran de descontar sin avisar.',
      );
    }

    const product = await this.productModel
      .findOneAndUpdate({ _id: id }, { isActive: false }, { new: true })
      .lean()
      .exec();

    if (!product) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }

    if (usadoEn.length > 0) {
      this.logger.warn(
        `[Catalogo] "${product.name}" se retiro a la fuerza y lo usan ${usadoEn.length} receta(s): ` +
          usadoEn.map((p) => p.name).join(', '),
      );
    }

    return { ...product, id: product._id };
  }
}

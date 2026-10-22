import { baseUnitOf } from '../inventory/units';
import type { UnidadDeInventario } from './conversation/unidades-inventario';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EmpleadoRef,
  ExpenseDraft,
  GastoPrevio,
  StepDeps,
  TipoCompra,
  UltimaCompra,
} from './conversation/draft';
import { ExpensesService } from '../expenses/expenses.service';
import type { ExpenseKind } from '../expenses/schemas/expense.schema';
import { ComprasConfigService } from './compras-config.service';
import { ProveedorRef } from '../expenses/supplier-suggest';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PurchasesService } from '../inventory/purchases.service';
import type { PurchaseUnit } from '../inventory/dto/create-purchase.dto';
import { PurchaseAliasesService } from '../inventory/purchase-aliases.service';
import { ExchangeService } from '../exchange/exchange.service';
import { EmployeesService } from '../employees/employees.service';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  parseInvoiceLines,
  matchLinesToProducts,
  rankProductsByName,
  claveDeAlias,
  MatchedLine,
} from '../inventory/invoice-parser';
import { regexTolerante } from '../../common/busqueda-texto.util';
import { ConfigsService } from '../configs/configs.service';
import { formatearFechaHora } from '../../common/operacion/operacion.util';

/**
 * Espacio del diccionario de busquedas escritas dentro de `purchase_aliases`.
 * Es COMPARTIDO entre proveedores a proposito: "hna pan" es la abreviatura de
 * quien escribe, no de Viveluso. Los alias de factura siguen por proveedor.
 */
const ALIAS_BUSQUEDA = 'bot-busqueda';

/** Los pasos de la conversacion solo conocen esta interfaz; aqui se conecta al mundo real. */
@Injectable()
export class BotDepsService implements StepDeps {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly purchases: PurchasesService,
    private readonly aliases: PurchaseAliasesService,
    private readonly exchange: ExchangeService,
    private readonly comprasConfig: ComprasConfigService,
    private readonly employees: EmployeesService,
    private readonly expenses: ExpensesService,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly configs: ConfigsService,
  ) {}

  async listSuppliers(): Promise<ProveedorRef[]> {
    const todos = await this.suppliers.findAll({ active: true });
    return todos.map((s) => ({
      id: String(s._id),
      name: s.name,
      taxId: s.paymentInfo?.taxId ?? null,
    }));
  }

  async createSupplier(name: string): Promise<ProveedorRef> {
    // CreateSupplierDto solo exige `name`; el resto es opcional.
    const s = await this.suppliers.create({ name });
    return { id: String(s._id), name: s.name };
  }

  async listCategories(kind: ExpenseKind | null): Promise<string[]> {
    // Insumos: las categorias del inventario, que ya se usan en las compras.
    // Gasto general: las suyas, de `configs/bot_compras`.
    if (kind === 'GENERAL')
      return (await this.comprasConfig.leer()).categoriasGenerales;
    return this.purchases.listCategories();
  }

  async bcvRate(): Promise<{ rate: number; source: string }> {
    const { rate, source } = await this.exchange.getBcvRate();
    return { rate, source };
  }

  private async productosInventario(): Promise<
    Array<{ id: string; name: string }>
  > {
    const productos = await this.productModel
      .find(
        {
          isForInventory: { $ne: false },
          $or: [{ isForInventory: true }, { type: 'BASE' }],
          isActive: true,
        },
        { name: 1 },
      )
      .lean();
    return productos.map((p) => ({ id: String(p._id), name: p.name }));
  }

  async matchLines(placeId: string, ocrText: string): Promise<MatchedLine[]> {
    const lines = parseInvoiceLines(ocrText);
    const refs = await this.productosInventario();
    const nombrePorProducto = new Map(refs.map((p) => [p.id, p.name] as const));
    const aliases = await this.aliases.listFor(placeId, nombrePorProducto);
    return matchLinesToProducts(lines, refs, aliases);
  }

  /** `id:<productId>` resuelve uno exacto; cualquier otra cosa busca por nombre (max 6). */
  async searchProducts(
    query: string,
  ): Promise<Array<{ id: string; name: string }>> {
    if (query.startsWith('id:')) {
      const p = await this.productModel
        .findOne({ _id: query.slice(3) }, { name: 1 })
        .lean();
      return p ? [{ id: String(p._id), name: p.name }] : [];
    }
    const q = query.trim();
    if (q.length < 2) return [];
    // Tolera tildes y mayusculas como el resto del sistema: sin esto
    // `/stock cafe` no encontraba «CAFÉ BALLET».
    const regex = regexTolerante(q);
    const productos = await this.productModel
      .find(
        {
          name: regex,
          isForInventory: { $ne: false },
          $or: [{ isForInventory: true }, { type: 'BASE' }],
          isActive: true,
        },
        { name: 1 },
      )
      .limit(6)
      .lean();
    const refs = await this.productosInventario();
    // Nada contiene el texto tal cual: se cae al mismo parecido por palabras que
    // empareja los renglones de la factura. Sin esto, "Tomates cesta" no
    // encontraba "Tomate" y el socio quedaba trabado (10/09/2026).
    const encontrados = productos.length
      ? productos.map((p) => ({ id: String(p._id), name: p.name }))
      : rankProductsByName(q, refs).map((p) => ({ id: p.id, name: p.name }));

    // Lo que ya se eligio antes para este mismo texto va PRIMERO.
    const aprendido = await this.aliasDeBusqueda(q, refs);
    const resultado = aprendido
      ? [aprendido, ...encontrados.filter((p) => p.id !== aprendido.id)]
      : encontrados;
    return resultado.slice(0, 6);
  }

  async listPurchaseTypes(): Promise<TipoCompra[]> {
    return (await this.comprasConfig.leer()).tipos;
  }

  /**
   * "Lo de siempre" de ese tipo, en el orden de la config. Solo lo que existe
   * HOY en el catalogo: el bot no crea productos, asi que un nombre mal escrito
   * en la config simplemente no aparece (y no ensucia el inventario).
   */
  async listFrequentProducts(
    tipo: string,
    supplierId?: string | null,
  ): Promise<Array<{ id: string; name: string }>> {
    const cfg = await this.comprasConfig.leer();
    const lista = cfg.frecuentes[tipo] ?? [];
    const refs = await this.productosInventario();
    // Sin lista configurada para el tipo, "lo de siempre" son los productos
    // que la ficha del proveedor ya tiene asociados. Viveluso tiene 48 y su
    // lista estaba vacia: el boton respondia "todavia no hay lista" y el socio
    // quedaba trabado con una factura que el OCR no leyo (18/09/2026).
    if (!lista.length)
      return supplierId ? this.productosDelProveedor(supplierId, refs) : [];
    const porId = new Map(refs.map((p) => [p.id, p] as const));
    const porNombre = new Map(
      refs.map((p) => [p.name.trim().toLowerCase(), p] as const),
    );
    const salida: Array<{ id: string; name: string }> = [];
    const vistos = new Set<string>();
    for (const f of lista) {
      const p =
        (f.productId ? porId.get(f.productId) : undefined) ??
        (f.name ? porNombre.get(f.name.trim().toLowerCase()) : undefined);
      if (!p || vistos.has(p.id)) continue;
      vistos.add(p.id);
      salida.push(p);
    }
    return salida;
  }

  async productUnits(
    ids: string[],
  ): Promise<Record<string, UnidadDeInventario>> {
    if (!ids.length) return {};
    const productos = await this.productModel
      .find({ _id: { $in: ids } }, { presentation: 1, presentationQuantity: 1 })
      .lean();
    const salida: Record<string, UnidadDeInventario> = {};
    for (const p of productos) {
      const presentation = p.presentation ?? 'Unidad';
      salida[String(p._id)] = {
        presentation,
        presentationQuantity: p.presentationQuantity ?? 0,
        base: baseUnitOf(presentation),
      };
    }
    return salida;
  }

  private async productosDelProveedor(
    supplierId: string,
    refs: Array<{ id: string; name: string }>,
  ): Promise<Array<{ id: string; name: string }>> {
    const proveedor = await this.suppliers
      .findById(supplierId)
      .catch(() => null);
    const ids = new Set((proveedor?.productIds ?? []).map(String));
    return refs
      .filter((p) => ids.has(p.id))
      .map((p) => ({ id: p.id, name: p.name.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  /**
   * Solo los ACTIVOS: prestarle a alguien que ya no trabaja aqui es un error,
   * no una opcion que haya que ofrecer en un boton.
   */
  async listActiveEmployees(): Promise<EmpleadoRef[]> {
    const activos = await this.employees.findAll({ active: true });
    return activos
      .map((e) => ({
        id: String(e._id),
        name: `${e.firstName ?? ''} ${e.lastName ?? ''}`
          .replace(/\s+/g, ' ')
          .trim(),
        position: e.position ?? null,
      }))
      .filter((e) => e.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async possibleDuplicate(draft: ExpenseDraft): Promise<GastoPrevio | null> {
    const previo = await this.expenses.posibleDuplicado(draft.ocrText);
    if (!previo) return null;
    const conFecha = previo as typeof previo & { createdAt?: Date };
    const createdAt = conFecha.createdAt ?? previo.date;
    const operacion = await this.configs.obtener('operacion');
    return {
      createdAt,
      cuando: formatearFechaHora(createdAt, operacion),
      category: previo.category,
      description: previo.employeeName ?? previo.description ?? null,
      socio: previo.registeredBy?.socio ?? '',
    };
  }

  async lastPurchase(productId: string): Promise<UltimaCompra | null> {
    const u = await this.purchases.lastPurchaseOf(productId);
    return u ? { ...u, unit: u.unit as PurchaseUnit } : null;
  }

  async learnSearchAlias(texto: string, productId: string): Promise<void> {
    // `learn` nunca lanza: si no aprende, el renglon igual queda elegido.
    await this.aliases.learn(
      ALIAS_BUSQUEDA,
      [{ invoiceText: texto, productId }],
      'telegram',
    );
  }

  /** El producto elegido antes para este texto, si sigue activo en el catalogo. */
  private async aliasDeBusqueda(
    q: string,
    refs: Array<{ id: string; name: string }>,
  ): Promise<{ id: string; name: string } | null> {
    const clave = claveDeAlias(q);
    if (!clave) return null;
    const nombrePorProducto = new Map(refs.map((p) => [p.id, p.name] as const));
    const alias = (
      await this.aliases.listFor(ALIAS_BUSQUEDA, nombrePorProducto)
    ).find((a) => a.aliasKey === clave);
    return alias ? { id: alias.productId, name: alias.productName } : null;
  }
}

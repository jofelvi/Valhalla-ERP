import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  WarehouseStock,
  WarehouseStockDocument,
} from './schemas/warehouse-stock.schema';
import { Warehouse, WarehouseDocument } from './schemas/warehouse.schema';
import { expandRecipeIngredients } from './recipe-cost.helper';
import type { ProductForRecipeCost } from './recipe-cost.helper';
import { InventoryArea } from './units';
import {
  Disponibilidad,
  InsumoConStock,
  NecesidadPorUnidad,
  evaluarDisponibilidad,
} from './availability.util';

interface ProductoLean extends ProductForRecipeCost {
  station?: string | null;
  inventoryArea?: InventoryArea | null;
  criticality?: string | null;
  naturalezaPendiente?: boolean;
  isForSale?: boolean;
  isActive?: boolean;
  type?: string;
}

/**
 * Qué se puede vender ahora mismo, y de qué hay que avisar.
 *
 * Se calcula ENTERO de una vez y se guarda 20 segundos: el POS y varios
 * teléfonos lo piden a la vez y cada uno vendría a preguntar por sus 500
 * productos. Con la caché son tres consultas cada 20 s para todos.
 */
@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger('Disponibilidad');
  private cache: { hasta: number; datos: Map<string, Disponibilidad> } | null =
    null;
  private static readonly TTL_MS = 20_000;

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(WarehouseStock.name)
    private readonly stockModel: Model<WarehouseStockDocument>,
    @InjectModel(Warehouse.name)
    private readonly warehouseModel: Model<WarehouseDocument>,
  ) {}

  /** El almacén de un producto: la misma regla que usa el consumo real. */
  private areaDe(p: ProductoLean): InventoryArea {
    if (String(p.station ?? '').toUpperCase() === 'BAR') return 'BARRA';
    if (p.inventoryArea === 'PIZZERIA') return 'PIZZERIA';
    return 'COCINA';
  }

  async calcular(): Promise<Map<string, Disponibilidad>> {
    const ahora = Date.now();
    if (this.cache && this.cache.hasta > ahora) return this.cache.datos;

    const datos = new Map<string, Disponibilidad>();
    try {
      const [productos, almacenes, filas, conteos] = await Promise.all([
        this.productModel
          .find({ isActive: { $ne: false } })
          .lean()
          .exec(),
        this.warehouseModel
          .find({ isActive: { $ne: false } })
          .lean()
          .exec(),
        this.stockModel.find({}).lean().exec(),
        // Qué insumos se han contado alguna vez y dónde. La marca por almacén
        // no basta: Cocina tiene un conteo inicial que cubrió unos pocos
        // productos y dejaría 86 filas en negativo como "agotadas".
        this.productModel.db
          .collection('inventory_counts')
          .find({}, { projection: { warehouseId: 1, 'items.productId': 1 } })
          .toArray(),
      ]);

      const contados = new Set<string>();
      for (const c of conteos as unknown as Array<{
        warehouseId: string;
        items?: Array<{ productId: string }>;
      }>) {
        for (const it of c.items ?? []) {
          contados.add(`${c.warehouseId}|${it.productId}`);
        }
      }

      const catalogo = new Map<string, ProductoLean>(
        (productos as unknown as ProductoLean[]).map((p) => [String(p._id), p]),
      );

      // Almacén por defecto de cada área, y si tiene línea base.
      const porArea = new Map<string, { id: string; conLineaBase: boolean }>();
      for (const w of almacenes as unknown as Array<{
        _id: string;
        area: string;
        isDefault?: boolean;
        baselineAt?: Date;
      }>) {
        if (!w.isDefault) continue;
        porArea.set(w.area, {
          id: String(w._id),
          conLineaBase: !!w.baselineAt,
        });
      }

      const stockPorAlmacen = new Map<string, number>();
      for (const f of filas as unknown as Array<{
        warehouseId: string;
        productId: string;
        qty: number;
      }>) {
        stockPorAlmacen.set(`${f.warehouseId}|${f.productId}`, f.qty);
      }

      for (const p of catalogo.values()) {
        if (p.isForSale === false) continue;

        const esServicio = p.type === 'SERVICIO';
        const area = this.areaDe(p);
        const almacen = porArea.get(area) ?? porArea.get('GENERAL');

        // Qué hace falta para UNA unidad, en unidad base y con su merma —
        // exactamente lo que descontará el consumo al entregar.
        const necesidades: NecesidadPorUnidad[] = [];
        const expandido = expandRecipeIngredients(p, catalogo);
        for (const exp of expandido.expanded) {
          const ing = (p.ingredients ?? []).find(
            (i) => i.productId === exp.insumoId,
          );
          const merma = 1 + (ing?.wastePercentage ?? 0) / 100;
          necesidades.push({
            insumoId: exp.insumoId,
            qtyBase: exp.qtyBase * merma,
          });
        }
        for (const err of expandido.errors) {
          if (err.productId) {
            necesidades.push({ insumoId: err.productId, qtyBase: 0 });
          }
        }
        // Un insumo se descuenta a sí mismo: 1 unidad por unidad vendida.
        if (necesidades.length === 0 && p.isForInventory === true) {
          necesidades.push({ insumoId: String(p._id), qtyBase: 1 });
        }

        const insumos = new Map<string, InsumoConStock>();
        for (const n of necesidades) {
          const ins = catalogo.get(String(n.insumoId));
          if (!ins) continue;
          // Cada insumo vive en el almacén de SU área, no en el del plato: la
          // masa de pizza puede estar en Pizzería y la carne en Cocina.
          const areaIns = this.areaDe(ins);
          const almIns = porArea.get(areaIns) ?? almacen;
          insumos.set(String(n.insumoId), {
            _id: String(ins._id),
            name: ins.name,
            criticality: ins.criticality ?? null,
            stock: stockPorAlmacen.get(`${almIns?.id}|${ins._id}`) ?? 0,
            contadoAlgunaVez: contados.has(`${almIns?.id}|${ins._id}`),
          });
        }

        datos.set(
          String(p._id),
          evaluarDisponibilidad(
            {
              _id: String(p._id),
              esServicio,
              naturalezaPendiente: p.naturalezaPendiente,
            },
            necesidades,
            insumos,
          ),
        );
      }

      this.cache = { hasta: ahora + AvailabilityService.TTL_MS, datos };
    } catch (err) {
      this.logger.error(
        `fallo calculando disponibilidad: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Sin datos es mejor no decir nada que decir "agotado" por un fallo
      // nuestro: el POS sigue vendiendo igual.
    }
    return datos;
  }

  /**
   * Lo que ve un cliente. Sin ser gerencia no viajan las cantidades: al
   * mesonero le sirve "falta carne", no cuántos gramos hay en la nevera.
   */
  async listar(opts: {
    station?: string;
    esGerencia: boolean;
  }): Promise<Disponibilidad[]> {
    const datos = await this.calcular();
    let lista = Array.from(datos.values());

    if (opts.station) {
      const est = opts.station.toUpperCase();
      const ids = new Set(
        (
          await this.productModel
            .find({ station: est }, { _id: 1 })
            .lean()
            .exec()
        ).map((p) => String(p._id)),
      );
      lista = lista.filter((d) => ids.has(d.productId));
    }

    if (opts.esGerencia) return lista;

    return lista.map((d) => ({
      ...d,
      maxPorciones: undefined,
      // SIN_CONTROL es un problema de catálogo: el mesonero no puede hacer
      // nada con eso en mitad del servicio, así que lo ve como normal.
      estado: d.estado === 'SIN_CONTROL' ? 'OK' : d.estado,
      faltantes: d.faltantes.map((f) => ({
        productId: f.productId,
        name: f.name,
        criticality: f.criticality,
        necesario: 0,
        hay: 0,
      })),
    }));
  }
}

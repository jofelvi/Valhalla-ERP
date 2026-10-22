import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PurchaseAlias,
  PurchaseAliasDocument,
} from './schemas/purchase-alias.schema';
import { claveDeAlias, type SupplierAlias } from './invoice-parser';

/** Lo que la app confirmo para un renglon concreto de la factura. */
export interface AliasAprendido {
  invoiceText: string;
  productId: string;
  unitsPerPack?: number | null;
}

/**
 * Memoria de como factura cada proveedor.
 *
 * Es la pieza que hace que cargar la factura de Polar sea trabajo de una sola
 * vez: la primera se mapea a mano, las siguientes se reconocen solas.
 */
@Injectable()
export class PurchaseAliasesService {
  private readonly logger = new Logger(PurchaseAliasesService.name);

  constructor(
    @InjectModel(PurchaseAlias.name)
    private aliasModel: Model<PurchaseAliasDocument>,
  ) {}

  /**
   * Alias de un proveedor, listos para el matcher.
   * Resuelve el nombre actual del producto en vez de guardarlo: si al producto
   * lo renombran, el alias sigue apuntando bien.
   */
  async listFor(
    placeId: string | undefined,
    nombrePorProducto: Map<string, string>,
  ): Promise<SupplierAlias[]> {
    if (!placeId) return [];

    const docs = await this.aliasModel.find({ placeId }).lean();

    return docs
      .filter((d) => nombrePorProducto.has(d.productId))
      .map((d) => ({
        aliasKey: d.aliasKey,
        productId: d.productId,
        productName: nombrePorProducto.get(d.productId) as string,
        unitsPerPack: d.unitsPerPack ?? null,
      }));
  }

  /**
   * Aprende (o corrige) los alias de una factura ya guardada.
   *
   * Nunca hace fallar la compra: la compra es el dato que importa y el alias
   * es una comodidad. Si el upsert choca, se registra y se sigue.
   */
  async learn(
    placeId: string,
    entradas: AliasAprendido[],
    userId: string,
  ): Promise<number> {
    let aprendidos = 0;

    for (const entrada of entradas) {
      const aliasKey = claveDeAlias(entrada.invoiceText ?? '');
      if (!aliasKey || !entrada.productId) continue;

      try {
        await this.aliasModel.updateOne(
          { placeId, aliasKey },
          {
            $set: {
              productId: entrada.productId,
              lastUsedAt: new Date(),
              ...(entrada.unitsPerPack
                ? { unitsPerPack: entrada.unitsPerPack }
                : {}),
            },
            $inc: { timesUsed: 1 },
            $setOnInsert: { createdBy: userId },
          },
          { upsert: true },
        );
        aprendidos++;
      } catch (err) {
        this.logger.warn(
          `No se pudo aprender el alias "${aliasKey}" de ${placeId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return aprendidos;
  }
}

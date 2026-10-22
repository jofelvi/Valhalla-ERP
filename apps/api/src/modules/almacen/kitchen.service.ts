import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  KitchenSession,
  KitchenSessionDocument,
  StockItem,
  MidPull,
  WasteItem,
} from './schemas/kitchen-session.schema';
import { OpenKitchenSessionDto } from './dto/open-kitchen-session.dto';
import { CloseKitchenSessionDto } from './dto/close-kitchen-session.dto';
import { MidPullDto } from './dto/mid-pull.dto';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

// Interfaces para resultados lean
interface IngredientLean {
  productId: string;
  quantity: number;
}

interface ProductLean {
  _id: string;
  name: string;
  presentation?: string;
  station?: string;
  isForInventory?: boolean;
  isActive?: boolean;
  ingredients?: IngredientLean[];
}

interface OrderItemLean {
  productId: string;
  quantity: number;
  station?: string;
}

interface OrderLean {
  _id: string;
  items: OrderItemLean[];
  status: string;
  createdAt: Date;
}

interface LiveStockItem {
  productId: string;
  productName: string;
  unit: string;
  initial: number;
  pulled: number;
  consumed: number;
  remaining: number;
}

interface InventoryProduct {
  productId: string;
  productName: string;
  unit: string;
  station?: string;
}

@Injectable()
export class KitchenService {
  constructor(
    @InjectModel(KitchenSession.name)
    private sessionModel: Model<KitchenSessionDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
  ) {}

  async getInventoryProducts(): Promise<InventoryProduct[]> {
    const products = (await this.productModel
      .find({ isForInventory: true, isActive: true })
      .lean()
      .exec()) as ProductLean[];
    return products.map((p) => ({
      productId: String(p._id),
      productName: p.name,
      unit: p.presentation ?? 'und',
      station: p.station,
    }));
  }

  async getActiveSession(): Promise<(KitchenSession & { id: string }) | null> {
    const session = await this.sessionModel
      .findOne({ status: 'open' })
      .lean()
      .exec();
    if (!session) return null;
    return { ...session, id: String(session._id) };
  }

  async openSession(
    dto: OpenKitchenSessionDto,
    userId: string,
  ): Promise<KitchenSession & { id: string }> {
    const existing = await this.sessionModel.findOne({ status: 'open' }).lean();
    if (existing)
      throw new BadRequestException('Ya hay una sesión de cocina abierta');

    const session = await this.sessionModel.create({
      openedAt: new Date(),
      openedBy: userId,
      status: 'open',
      initialStock: dto.initialStock,
      midPulls: [],
    });
    return { ...session.toObject(), id: String(session._id) };
  }

  async addMidPull(dto: MidPullDto): Promise<KitchenSession & { id: string }> {
    const session = await this.sessionModel.findOne({ status: 'open' });
    if (!session) throw new NotFoundException('No hay sesión activa');

    const pull: MidPull = { ...dto, at: new Date() };
    session.midPulls.push(pull);
    await session.save();
    return { ...session.toObject(), id: String(session._id) };
  }

  async calculateConsumption(): Promise<Record<string, number>> {
    const session = await this.sessionModel.findOne({ status: 'open' }).lean();
    if (!session) return {};

    const since = session.openedAt;
    const orders = (await this.orderModel
      .find({
        createdAt: { $gte: since },
        status: { $in: ['IN_PROGRESS', 'DELIVERED', 'PAID'] },
        isDeleted: { $ne: true },
      })
      .lean()
      .exec()) as unknown as OrderLean[];

    const inventoryProductIds = new Set(
      (session.initialStock as StockItem[]).map((s) => s.productId),
    );

    const consumption: Record<string, number> = {};

    for (const order of orders) {
      for (const item of (order.items ?? []) as OrderItemLean[]) {
        if (item.station !== 'KITCHEN') continue;
        const product = (await this.productModel
          .findOne({ _id: item.productId })
          .lean()) as ProductLean | null;
        if (!product?.ingredients?.length) continue;

        for (const ing of product.ingredients) {
          if (!inventoryProductIds.has(ing.productId)) continue;
          const qty = ing.quantity * item.quantity;
          consumption[ing.productId] = (consumption[ing.productId] ?? 0) + qty;
        }
      }
    }

    return consumption;
  }

  async getLiveStock(): Promise<{
    session: (KitchenSession & { id: string }) | null;
    stock: LiveStockItem[];
  }> {
    const session = await this.sessionModel.findOne({ status: 'open' }).lean();
    if (!session) return { session: null, stock: [] };

    const consumption = await this.calculateConsumption();
    const stockMap: Record<string, LiveStockItem> = {};

    for (const item of session.initialStock as StockItem[]) {
      stockMap[item.productId] = {
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        initial: item.quantity,
        pulled: 0,
        consumed: consumption[item.productId] ?? 0,
        remaining: 0,
      };
    }

    for (const pull of session.midPulls as MidPull[]) {
      if (stockMap[pull.productId]) {
        stockMap[pull.productId].pulled += pull.quantity;
      }
    }

    for (const item of Object.values(stockMap)) {
      item.remaining = item.initial + item.pulled - item.consumed;
    }

    return {
      session: { ...session, id: String(session._id) },
      stock: Object.values(stockMap),
    };
  }

  async closeSession(
    dto: CloseKitchenSessionDto,
  ): Promise<KitchenSession & { id: string }> {
    const session = await this.sessionModel.findOne({ status: 'open' });
    if (!session) throw new NotFoundException('No hay sesión activa');

    const consumption = await this.calculateConsumption();
    const stockMap: Record<string, number> = {};

    for (const item of session.initialStock as StockItem[]) {
      stockMap[item.productId] = item.quantity;
    }
    for (const pull of session.midPulls as MidPull[]) {
      stockMap[pull.productId] =
        (stockMap[pull.productId] ?? 0) + pull.quantity;
    }

    const waste: WasteItem[] = dto.physicalCount.map((pc) => {
      const consumed = consumption[pc.productId] ?? 0;
      const total = stockMap[pc.productId] ?? 0;
      const expected = Math.max(0, total - consumed);
      const productName =
        (session.initialStock as StockItem[]).find(
          (s) => s.productId === pc.productId,
        )?.productName ?? pc.productId;
      return {
        productId: pc.productId,
        productName,
        expected,
        actual: pc.quantity,
        difference: expected - pc.quantity,
      };
    });

    const physicalCountFull: StockItem[] = dto.physicalCount.map((pc) => ({
      productId: pc.productId,
      productName:
        (session.initialStock as StockItem[]).find(
          (s) => s.productId === pc.productId,
        )?.productName ?? '',
      quantity: pc.quantity,
      unit:
        (session.initialStock as StockItem[]).find(
          (s) => s.productId === pc.productId,
        )?.unit ?? 'und',
    }));

    session.status = 'closed';
    session.closedAt = new Date();
    session.closedBy = dto.closedBy;
    session.physicalCount = physicalCountFull;
    session.waste = waste;

    await session.save();
    return { ...session.toObject(), id: String(session._id) };
  }

  async getHistory(limit = 20): Promise<(KitchenSession & { id: string })[]> {
    const sessions = await this.sessionModel
      .find({ status: 'closed' })
      .sort({ closedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
    return sessions.map((s) => ({ ...s, id: String(s._id) }));
  }
}

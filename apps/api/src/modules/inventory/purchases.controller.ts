import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as os from 'os';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PurchasesService } from './purchases.service';
import { PurchaseAliasesService } from './purchase-aliases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { OcrInvoiceDto } from './dto/ocr-invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OcrService } from '../ocr/ocr.service';
import { Product } from '../products/schemas/product.schema';
import {
  parseInvoiceLines,
  matchLinesToProducts,
  type MatchedLine,
} from './invoice-parser';

interface AuthedRequest {
  user?: { id?: string; sub?: string };
}

@ApiTags('inventory')
@Controller('api/inventory/purchases')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
    private readonly aliasesService: PurchaseAliasesService,
    private readonly ocrService: OcrService,
    @InjectModel(Product.name) private productModel: Model<Product>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar compra de insumos' })
  create(@Body() dto: CreatePurchaseDto, @Request() req: AuthedRequest) {
    return this.purchasesService.create(
      dto,
      req.user?.id ?? req.user?.sub ?? 'desconocido',
    );
  }

  /**
   * Categorias de gasto ya usadas + las sugeridas por defecto.
   *
   * No hay ABM de categorias a proposito: escribir una nueva en la compra la
   * crea, y esta lista la devuelve desde la proxima vez. Asi no quedan
   * categorias huerfanas que nadie borra ni una pantalla mas que mantener.
   */
  @Get('categories')
  @ApiOperation({ summary: 'Categorias de gasto usadas (para el selector)' })
  async categories() {
    return this.purchasesService.listCategories();
  }

  @Get()
  @ApiOperation({ summary: 'Historial de compras con filtros' })
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('placeId') placeId?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      ...(from && { from: new Date(from) }),
      ...(to && { to: new Date(to) }),
      ...(placeId && { placeId }),
      limit: Math.min(parseInt(limit ?? '50', 10), 500),
    };
    return this.purchasesService.list(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener compra por ID' })
  getById(@Param('id') id: string) {
    return this.purchasesService.getById(id);
  }

  @Post('ocr')
  @ApiOperation({ summary: 'Extraer datos de factura via OCR' })
  async ocr(@Body() dto: OcrInvoiceDto) {
    let tmpPath: string | null = null;

    try {
      // 1. Decodificar base64 y escribir a archivo temporal
      const buffer = Buffer.from(dto.imageBase64, 'base64');
      const tmpName = `ocr-${crypto.randomBytes(6).toString('hex')}.${dto.extension}`;
      tmpPath = path.join(os.tmpdir(), tmpName);

      await fs.writeFile(tmpPath, buffer);

      // 2. Extraer texto con OCR
      const ocrResult = await this.ocrService.extractInvoiceText(tmpPath);

      // 3. Parsear líneas de factura
      // Nota: ocrResult.raw puede estar vacío si la imagen es ilegible.
      // En ese caso, lines será [] y matchedLines también [],
      // lo cual es válido (200 OK, no 400).
      const lines = parseInvoiceLines(ocrResult.raw);

      // 4. Buscar productos activos para inventario.
      // `isForInventory: { $ne: false }` va ademas del $or, igual que en
      // shopping-lists.service.ts: el `false` explicito manda. Sin el, los
      // servicios legacy con type BASE (Animador, Sonido, alquileres) entran
      // como candidatos al emparejar las lineas de una factura.
      const products = await this.productModel
        .find({
          isForInventory: { $ne: false },
          $or: [{ isForInventory: true }, { type: 'BASE' }],
          isActive: true,
        })
        .lean()
        .exec();

      const productRefs = products.map((p) => ({
        id: p._id.toString(),
        name: p.name,
      }));

      // 5. Traer lo ya aprendido de ESTE proveedor. Es lo que permite
      //    reconocer renglones que no se parecen al nombre del catalogo.
      const nombrePorProducto = new Map(
        productRefs.map((p) => [p.id, p.name] as const),
      );
      const aliases = await this.aliasesService.listFor(
        dto.placeId,
        nombrePorProducto,
      );

      // 6. Hacer matching: primero los alias, luego el parecido con el catalogo
      const matchedLines = matchLinesToProducts(lines, productRefs, aliases);

      return {
        rawText: ocrResult.raw,
        lines: matchedLines,
        aliasesAplicados: matchedLines.filter((l) => l.source === 'alias')
          .length,
        durationMs: ocrResult.durationMs,
      };
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Error en OCR: ${message}`);
    } finally {
      // Limpiar archivo temporal
      if (tmpPath) {
        fs.unlink(tmpPath).catch(() => undefined);
      }
    }
  }
}

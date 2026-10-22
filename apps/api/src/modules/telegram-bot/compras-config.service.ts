import { Injectable, Logger } from '@nestjs/common';
import { ConfigsService } from '../configs/configs.service';
import type { TipoCompra } from './conversation/draft';

/** Un producto de la lista de "lo de siempre", tal como esta en Mongo. */
export interface FrecuenteConfig {
  /** Id del producto en el catalogo. Si falta, se resuelve por `name`. */
  productId?: string;
  /** Nombre con el que se busca cuando no hay id (lo escribe quien edita). */
  name?: string;
}

export interface ComprasBotConfig {
  tipos: TipoCompra[];
  /** key del tipo -> productos que SIEMPRE se compran de ese tipo. */
  frecuentes: Record<string, FrecuenteConfig[]>;
  /** Categorias de los gastos que NO son insumos. */
  categoriasGenerales: string[];
}

/**
 * Las categorias de un gasto general. Antes se ofrecian las del inventario
 * —heredadas de las compras— y no habia donde cargar un sueldo: el socio
 * terminaba escribiendo la categoria a mano cada vez.
 */
export const CATEGORIAS_GENERALES_POR_DEFECTO = [
  'Personal (sueldos y bonos)',
  'Préstamos al personal',
  'Servicios (luz, agua, internet)',
  'Alquiler',
  'Transporte y delivery',
  'Mantenimiento y reparaciones',
  'Impuestos y permisos',
  'Gastos bancarios',
  'Publicidad',
  'Otros',
];

export const TIPOS_POR_DEFECTO: TipoCompra[] = [
  { key: 'VEGETALES', label: '🥬 Vegetales' },
  { key: 'CARNES', label: '🥩 Carnes' },
  { key: 'BEBIDAS', label: '🥤 Bebidas' },
  { key: 'OTROS', label: '📦 Otros' },
];

/**
 * `configs/bot_compras`. La lista de vegetales cambia con la temporada y con lo
 * que el restaurante deja de usar: vive en Mongo para editarla sin desplegar.
 * Sin documento, el bot igual pregunta el tipo (con los cuatro de siempre) y
 * simplemente no ofrece lista.
 */
@Injectable()
export class ComprasConfigService {
  private readonly logger = new Logger(ComprasConfigService.name);

  constructor(private readonly configs: ConfigsService) {}

  async leer(): Promise<ComprasBotConfig> {
    return this.configs.obtenerCrudo('bot_compras', (doc) => {
      if (!doc) {
        return {
          tipos: TIPOS_POR_DEFECTO,
          frecuentes: {},
          categoriasGenerales: CATEGORIAS_GENERALES_POR_DEFECTO,
        };
      }
      const tipos = (Array.isArray(doc.tipos) ? doc.tipos : [])
        .filter(
          (t: unknown): t is TipoCompra =>
            typeof t === 'object' &&
            t !== null &&
            typeof (t as TipoCompra).key === 'string' &&
            typeof (t as TipoCompra).label === 'string',
        )
        .map((t) => ({ key: t.key, label: t.label }));
      const frecuentes: Record<string, FrecuenteConfig[]> = {};
      const crudo = (doc.frecuentes ?? {}) as Record<string, unknown>;
      for (const [key, lista] of Object.entries(crudo)) {
        if (!Array.isArray(lista)) continue;
        frecuentes[key] = lista
          .map((x): FrecuenteConfig | null => {
            // Se acepta el nombre suelto: editar la lista a mano en Mongo no
            // deberia exigir conocer los ids del catalogo.
            if (typeof x === 'string') return { name: x };
            if (typeof x === 'object' && x !== null) {
              const o = x as FrecuenteConfig;
              if (
                typeof o.productId === 'string' ||
                typeof o.name === 'string'
              ) {
                return { productId: o.productId, name: o.name };
              }
            }
            return null;
          })
          .filter((x): x is FrecuenteConfig => x !== null);
      }
      const categorias = (
        Array.isArray(doc.categoriasGenerales) ? doc.categoriasGenerales : []
      )
        .filter(
          (c: unknown): c is string =>
            typeof c === 'string' && c.trim().length > 0,
        )
        .map((c) => c.trim());
      return {
        tipos: tipos.length ? tipos : TIPOS_POR_DEFECTO,
        frecuentes,
        categoriasGenerales: categorias.length
          ? categorias
          : CATEGORIAS_GENERALES_POR_DEFECTO,
      };
    });
  }
}

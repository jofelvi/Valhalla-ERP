import { ConfigsService } from '../configs/configs.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Socios directivos cuyo consumo NO suma al monto por cobrar.
 *
 * Los tres duenos acordaron no cobrarse entre ellos. Sus consumos se facturan
 * y se registran igual que los de cualquier cliente -- no se oculta ni se
 * borra nada -- pero al totalizar la cartera se apartan, porque si no el monto
 * "por cobrar" incluye plata que nadie va a cobrar nunca. Al 18/08/2026 eran
 * $1.858,75 de $5.979,49: el 31% de la cartera.
 *
 * La lista vive en Mongo (`configs/socios_excluidos`) y no en el codigo, para
 * poder agregar o quitar un socio sin redeploy. Misma idea que
 * `configs/pizza_bonus`.
 */

export interface ConfigSociosExcluidos {
  habilitado: boolean;
  /** Numeros de accion del padron, con el padding del _id de `members` (00590). */
  acciones: string[];
  motivo: string;
}

export interface SociosExcluidos extends ConfigSociosExcluidos {
  /** Ids de `customers` de esos socios: es por donde cuelgan las cuentas. */
  customerIds: string[];
  nombres: Record<string, string>;
}

const POR_DEFECTO: ConfigSociosExcluidos = {
  habilitado: false,
  acciones: [],
  motivo: '',
};

@Injectable()
export class SociosExcluidosService {
  private readonly logger = new Logger(SociosExcluidosService.name);

  // La lista cambia una vez al ano; releerla en cada request de la cartera
  // seria un viaje a Mongo por nada: el resultado (con los clientes) se cachea aqui.
  private cache?: { valor: SociosExcluidos; expira: number };
  private static readonly TTL_MS = 60_000;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configs: ConfigsService,
  ) {}

  async resolver(): Promise<SociosExcluidos> {
    if (this.cache && Date.now() < this.cache.expira) return this.cache.valor;

    // Sin config no se cae: se comporta como si no hubiera exclusiones, que es el lado seguro
    // (mostrar de mas, nunca de menos).
    const config = await this.configs.obtenerCrudo<ConfigSociosExcluidos>(
      'socios_excluidos',
      (doc) => {
        if (!doc) return POR_DEFECTO;
        return {
          habilitado: doc.enabled !== false,
          acciones: Array.isArray(doc.acciones)
            ? (doc.acciones as string[])
            : [],
          motivo: typeof doc.motivo === 'string' ? doc.motivo : '',
        };
      },
    );

    const customerIds: string[] = [];
    const nombres: Record<string, string> = {};
    if (config.habilitado && config.acciones.length) {
      try {
        const clientes = await this.connection
          .collection('customers')
          .find({ memberAction: { $in: config.acciones } })
          .project({
            _id: 1,
            name: 1,
            firstName: 1,
            lastName: 1,
            memberAction: 1,
          })
          .toArray();
        for (const c of clientes) {
          const id = String(c._id);
          customerIds.push(id);
          nombres[id] =
            (c.name as string) ||
            `${(c.firstName as string) ?? ''} ${(c.lastName as string) ?? ''}`.trim() ||
            id;
        }
      } catch (error) {
        this.logger.warn(
          `No se pudieron resolver los clientes de los socios: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const valor: SociosExcluidos = { ...config, customerIds, nombres };
    this.cache = { valor, expira: Date.now() + SociosExcluidosService.TTL_MS };
    return valor;
  }

  /** true si esa cuenta/consumo pertenece a un socio y no debe sumar. */
  async esExcluido(customerId?: string | null): Promise<boolean> {
    if (!customerId) return false;
    const { habilitado, customerIds } = await this.resolver();
    return habilitado && customerIds.includes(String(customerId));
  }

  /** Fuerza la relectura. Para cuando se edita la config. */
  invalidar(): void {
    this.cache = undefined;
    this.configs.invalidar('socios_excluidos');
  }
}

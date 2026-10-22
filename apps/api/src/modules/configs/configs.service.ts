import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import {
  CONFIG_DEFAULTS,
  CONFIG_IDS,
  ConfigEnvelope,
  ConfigId,
  ConfigMap,
  ConfigPublica,
  mergeConfig,
  normalizeConfig,
} from '@odin6/types';
import { Connection } from 'mongoose';

/**
 * Lector/escritor único de la colección `configs` para los siete documentos del contrato
 * (`@odin6/types` → `CONFIG_IDS`). Todo el backend lee la configuración de aquí; nadie más
 * hace `findOne({ _id: 'tarifas' })`.
 *
 *  - Documento: `{ _id: <ConfigId>, valor: <objeto>, updatedAt, updatedBy }`.
 *  - Lo que se lee pasa siempre por `normalizeConfig`: un documento a medias o corrupto
 *    devuelve valores neutros, nunca rompe una petición.
 *  - Caché de 60 s con invalidación al escribir (este proceso es el único escritor).
 */
@Injectable()
export class ConfigsService {
  private readonly logger = new Logger(ConfigsService.name);
  private readonly cache = new Map<
    ConfigId,
    { env: ConfigEnvelope; expira: number }
  >();
  /** Documentos internos fuera del contrato (p. ej. `packs`), con la misma caché. */
  private readonly cacheCrudo = new Map<
    string,
    { valor: unknown; expira: number }
  >();
  static readonly TTL_MS = 60_000;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private get coleccion() {
    return this.connection.collection('configs');
  }

  async obtenerEnvelope<K extends ConfigId>(id: K): Promise<ConfigEnvelope<K>> {
    const hit = this.cache.get(id);
    if (hit && Date.now() < hit.expira) return hit.env as ConfigEnvelope<K>;

    let doc: Record<string, unknown> | null = null;
    try {
      doc = await this.coleccion.findOne({ _id: id as never });
    } catch (error) {
      this.logger.warn(
        `No se pudo leer configs/${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const env: ConfigEnvelope<K> = {
      id,
      valor: normalizeConfig(id, doc?.valor),
      configured: doc !== null,
      updatedAt:
        doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
      updatedBy: typeof doc?.updatedBy === 'string' ? doc.updatedBy : null,
    };
    this.cache.set(id, { env, expira: Date.now() + ConfigsService.TTL_MS });
    return env;
  }

  async obtener<K extends ConfigId>(id: K): Promise<ConfigMap[K]> {
    return (await this.obtenerEnvelope(id)).valor;
  }

  /**
   * Documento interno de la API que no es del contrato (`configs/<id>`: `packs`,
   * `telegram_bot`, `margen_minimo`…). Su forma NO cambia: `normalizar` recibe el documento
   * entero (null si no existe o falla la lectura) y devuelve el neutro del llamador. Misma
   * caché de 60 s e invalidación que `obtener`: sigue siendo una sola puerta de lectura.
   */
  async obtenerCrudo<T>(
    id: string,
    normalizar: (doc: Record<string, unknown> | null) => T,
  ): Promise<T> {
    const hit = this.cacheCrudo.get(id);
    if (hit && Date.now() < hit.expira) return hit.valor as T;

    let doc: Record<string, unknown> | null = null;
    try {
      doc = await this.connection
        .collection('configs')
        .findOne({ _id: id as never });
    } catch (error) {
      this.logger.warn(
        `No se pudo leer configs/${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const valor = normalizar(doc);
    this.cacheCrudo.set(id, {
      valor,
      expira: Date.now() + ConfigsService.TTL_MS,
    });
    return valor;
  }

  /**
   * Escritura sobre un documento interno (`configs/<id>`) con `filtro` extra. Invalida la caché
   * de ese documento para que la siguiente lectura vea el cambio.
   */
  async actualizarCrudo(
    id: string,
    filtro: Record<string, unknown>,
    update: Record<string, unknown>,
    upsert = false,
  ): Promise<void> {
    await this.connection
      .collection('configs')
      .updateOne({ _id: id, ...filtro } as never, update as never, { upsert });
    this.invalidar(id);
  }

  /** Todo menos `nomina`. Es lo que sirve `GET /api/config/publico`. */
  async publico(): Promise<ConfigPublica> {
    const [negocio, marca, tarifas, operacion, vocabulario, modulos] =
      await Promise.all([
        this.obtener('negocio'),
        this.obtener('marca'),
        this.obtener('tarifas'),
        this.obtener('operacion'),
        this.obtener('vocabulario'),
        this.obtener('modulos'),
      ]);
    return {
      configured: negocio.tradeName !== '',
      negocio,
      marca,
      tarifas,
      operacion,
      vocabulario,
      modulos,
    };
  }

  /**
   * Mezcla `cambios` (parcial) sobre lo vigente, normaliza y guarda. Devuelve el documento
   * ya guardado. Lanza si `id` no es del contrato.
   */
  async actualizar<K extends ConfigId>(
    id: K,
    cambios: unknown,
    actor: string | null,
  ): Promise<ConfigEnvelope<K>> {
    if (!(CONFIG_IDS as readonly string[]).includes(id)) {
      throw new Error(`Configuración desconocida: ${id}`);
    }
    // Se lee sin caché para no mezclar sobre un valor viejo.
    this.invalidar(id);
    const vigente = await this.obtener(id);
    const nuevo = normalizeConfig(id, mergeConfig(vigente, cambios));
    await this.coleccion.updateOne(
      { _id: id as never },
      { $set: { valor: nuevo, updatedAt: new Date(), updatedBy: actor } },
      { upsert: true },
    );
    this.invalidar(id);
    return this.obtenerEnvelope(id);
  }

  /** Valores neutros, para pruebas y para el sembrador. */
  defaults<K extends ConfigId>(id: K): ConfigMap[K] {
    return CONFIG_DEFAULTS[id];
  }

  invalidar(id?: string): void {
    if (id) {
      this.cache.delete(id as ConfigId);
      this.cacheCrudo.delete(id);
    } else {
      this.cache.clear();
      this.cacheCrudo.clear();
    }
  }
}

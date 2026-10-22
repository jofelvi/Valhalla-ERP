import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReleaseAmbitoEnum, type ReleaseAmbito } from '@odin6/types';
import { Release, ReleaseDocument } from './schemas/release.schema';
import {
  RollbackLock,
  RollbackLockDocument,
} from './schemas/rollback-lock.schema';
import { CreateReleaseDto } from './dto/create-release.dto';
import { UpdateReleaseDto } from './dto/update-release.dto';
import { AuthService } from '../auth/auth.service';
import {
  puedeRevertirse,
  type EntradaParaReversion,
} from './rollback-rules.util';

/** Lo que la pantalla necesita saber de cada ambito de una entrada. */
export interface ReversionPorAmbito {
  ambito: ReleaseAmbito;
  reversible: boolean;
  motivo?: string;
}

export interface ResultadoEjecucion {
  ok: boolean;
  salida: string;
}

/** Se inyecta para poder probar la reversion sin tocar el VPS. */
export type EjecutorRollback = (args: string[]) => Promise<ResultadoEjecucion>;

export const EJECUTOR_ROLLBACK = 'EJECUTOR_ROLLBACK';

/** Un sha y nada mas. Lo que no case con esto no llega al servidor. */
const SHA_VALIDO = /^[0-9a-f]{7,40}$/;

/**
 * La web consume `id`, la base guarda `_id`. Se mapea al salir, que es la
 * convencion del proyecto (budgets.service.ts hace `{ ...budget, id: _id }`).
 * Sin esto la pantalla recibe id undefined y no puede pedir el detalle.
 */
const conId = <T extends { _id?: unknown }>(doc: T) => ({
  ...doc,
  id: String(doc._id),
});

/** Los ambitos que se pueden revertir. El APK no: vive en los telefonos. */
const AMBITOS_REVERSIBLES: ReleaseAmbito[] = [
  ReleaseAmbitoEnum.API,
  ReleaseAmbitoEnum.WEB,
];

@Injectable()
export class ReleasesService {
  constructor(
    @InjectModel(Release.name)
    private readonly releaseModel: Model<ReleaseDocument>,
    @InjectModel(RollbackLock.name)
    private readonly lockModel: Model<RollbackLockDocument>,
    private readonly authService: AuthService,
    @Inject(EJECUTOR_ROLLBACK)
    private readonly ejecutor: EjecutorRollback,
  ) {}

  async findAll(ambito?: ReleaseAmbito, limit = 50) {
    const filtro = ambito ? { ambito } : {};
    const docs = await this.releaseModel
      .find(filtro)
      .sort({ fecha: -1 })
      .limit(Math.min(limit, 200))
      .lean()
      .exec();
    return docs.map(conId);
  }

  async findById(id: string) {
    const entrada = await this.releaseModel.findById(id).lean().exec();
    if (!entrada) throw new NotFoundException('Entrada no encontrada');
    const reversion = await this.evaluarReversion(entrada as Release);
    return { ...conId(entrada), reversion };
  }

  async create(dto: CreateReleaseDto, userId: string) {
    // Una entrada que toca la API se asume migradora de datos mientras no se
    // diga lo contrario: preferimos bloquear un rollback que si era posible, a
    // permitir uno que corrompe inventario o dinero.
    const migroDatos =
      dto.migroDatos ?? dto.ambito.includes(ReleaseAmbitoEnum.API);
    const creada = await this.releaseModel.create({
      ...dto,
      fecha: new Date(dto.fecha),
      commits: dto.commits ?? [],
      shas: dto.shas ?? {},
      migroDatos,
      createdBy: userId,
    });
    return conId(creada.toObject());
  }

  async update(id: string, dto: UpdateReleaseDto) {
    const patch: Record<string, unknown> = { ...dto };
    if (dto.fecha) patch.fecha = new Date(dto.fecha);
    const actualizada = await this.releaseModel
      .findByIdAndUpdate(id, patch, { new: true })
      .lean()
      .exec();
    if (!actualizada) throw new NotFoundException('Entrada no encontrada');
    return conId(actualizada);
  }

  async remove(id: string) {
    const borrada = await this.releaseModel.findByIdAndDelete(id).lean().exec();
    if (!borrada) throw new NotFoundException('Entrada no encontrada');
    return { ok: true };
  }

  async estadoRollback() {
    const lock = await this.lockModel.findById('lock').lean().exec();
    return lock ?? { enCurso: false };
  }

  /**
   * Revierte un despliegue.
   *
   * El orden es deliberado: primero se descarta TODO lo que no debe ejecutar
   * nada (reversibilidad, PIN, rol, forma del sha) y solo al final se toma el
   * candado y se invoca el script. Asi un rechazo nunca deja el candado puesto
   * ni la bitacora bloqueada.
   */
  async revertir(
    id: string,
    ambito: ReleaseAmbito,
    pin: string,
    userId: string,
  ) {
    const entrada = await this.releaseModel.findById(id).lean().exec();
    if (!entrada) throw new NotFoundException('Entrada no encontrada');

    const veredicto = (await this.evaluarReversion(entrada as Release)).find(
      (v) => v.ambito === ambito,
    );
    if (!veredicto?.reversible) {
      throw new BadRequestException(
        veredicto?.motivo ?? 'Este despliegue no se puede revertir',
      );
    }

    const pinCheck = await this.authService.verifyAdminPin(pin);
    if (!pinCheck.valid) throw new UnauthorizedException('PIN invalido');
    // verifyAdminPin acepta ADMIN y MANAGER; revertir es solo de ADMIN.
    if (pinCheck.adminRole !== 'admin') {
      throw new ForbiddenException('Revertir un despliegue es solo de ADMIN');
    }

    const shas = (entrada as Release).shas ?? {};
    const sha = ambito === ReleaseAmbitoEnum.WEB ? shas.web : shas.api;
    if (!sha || !SHA_VALIDO.test(sha)) {
      throw new BadRequestException('El commit guardado no es valido');
    }

    // Candado: updateOne condicional, unico guardia real sin transacciones.
    const tomado = await this.lockModel
      .findOneAndUpdate(
        { _id: 'lock', enCurso: { $ne: true } },
        {
          $set: {
            enCurso: true,
            ambito,
            sha,
            paso: 'ejecutando',
            iniciadoEn: new Date(),
            iniciadoPor: userId,
          },
        },
        { new: true, upsert: true },
      )
      .lean()
      .exec();
    if (!tomado) throw new ConflictException('Ya hay una reversion en curso');

    try {
      const res = await this.ejecutor([ambito, sha]);
      if (!res.ok) {
        throw new BadRequestException('La reversion fallo: ' + res.salida);
      }
      // Se registra creando una entrada nueva: la bitacora no se edita.
      const creada = await this.releaseModel.create({
        fecha: new Date(),
        ambito: [ambito],
        titulo: 'Revertido a: ' + (entrada as Release).titulo,
        cambios: [
          'Se revirtio ' + ambito + ' a la version ' + sha + '.',
          'Autorizado por ' + (pinCheck.adminName ?? 'admin') + '.',
        ],
        commits: [],
        shas: { [ambito]: sha },
        migroDatos: false,
        revertidaDe: id,
        createdBy: userId,
      });
      return { ok: true, entradaCreada: conId(creada.toObject()) };
    } finally {
      await this.lockModel.updateOne(
        { _id: 'lock' },
        { $set: { enCurso: false, paso: 'listo' } },
      );
    }
  }

  /** Evalua los dos ambitos reversibles contra las entradas posteriores. */
  protected async evaluarReversion(
    entrada: Release,
  ): Promise<ReversionPorAmbito[]> {
    const posteriores = await this.releaseModel
      .find({ fecha: { $gt: entrada.fecha } })
      .lean()
      .exec();
    const posterioresPlanas = posteriores.map((p) =>
      this.comoEntrada(p as unknown as Release),
    );
    return AMBITOS_REVERSIBLES.map((ambito) => {
      const v = puedeRevertirse(
        this.comoEntrada(entrada),
        ambito,
        posterioresPlanas,
      );
      return { ambito, reversible: v.reversible, motivo: v.motivo };
    });
  }

  protected comoEntrada(r: Release): EntradaParaReversion {
    return {
      id: String(r._id),
      fecha: new Date(r.fecha),
      ambito: (r.ambito ?? []) as ReleaseAmbito[],
      shas: r.shas ?? {},
      migroDatos: !!r.migroDatos,
      titulo: r.titulo,
      version: r.version,
    };
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import {
  AccountReceivable,
  AccountReceivableDocument,
} from '../accounts-receivable/schemas/account-receivable.schema';
import { EmailService } from '../sms/email.service';
import {
  AccountDeletionRequest,
  AccountDeletionRequestDocument,
  AlcanceDeBaja,
  EstadoDeBaja,
} from './schemas/account-deletion-request.schema';

/** Un centavo: la misma tolerancia con la que se salda una cuenta. */
const TOLERANCIA = 0.01;
/** Estados en los que una cuenta ya no se debe. */
const ESTADOS_SALDADOS = ['paid', 'cancelled'];

export interface SolicitudDeBaja {
  id: string;
  estado: EstadoDeBaja;
  alcance: AlcanceDeBaja;
  /** Saldo vivo en USD cuando se pidió la baja. */
  deuda: number;
  /** `true` si ya había una pendiente (no se creó otra). */
  yaExistia: boolean;
  /** Texto listo para mostrarle a la persona. */
  mensaje: string;
}

interface CuentaConSaldo {
  amount?: number | null;
  paidAmount?: number | null;
}

const redondear2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Cuánto debe una persona: suma de lo que falta en sus cuentas vivas.
 * Un `paidAmount` mayor que el monto (dato sucio heredado) cuenta como 0, no
 * como saldo a favor que reste deuda de otras cuentas.
 */
export function resumirDeuda(cuentas: CuentaConSaldo[]): {
  deuda: number;
  cuentasVivas: number;
} {
  let deuda = 0;
  let cuentasVivas = 0;
  for (const c of cuentas) {
    const falta = Math.max(
      0,
      Number(c.amount ?? 0) - Number(c.paidAmount ?? 0),
    );
    if (falta > TOLERANCIA) {
      deuda += falta;
      cuentasVivas += 1;
    }
  }
  return { deuda: redondear2(deuda), cuentasVivas };
}

export function mensajeDeBaja(alcance: AlcanceDeBaja, deuda: number): string {
  if (alcance === 'solo_acceso') {
    return (
      `Recibimos tu solicitud. Tienes un saldo pendiente de $${deuda.toFixed(2)} ` +
      'con el restaurante: eliminaremos tu acceso a la aplicación, pero ' +
      'conservaremos los datos necesarios para gestionar ese saldo hasta que se regularice.'
    );
  }
  return (
    'Recibimos tu solicitud. Eliminaremos tu cuenta y tus datos personales en un ' +
    'plazo máximo de 30 días. Los registros de pedidos y pagos se conservan ' +
    'anonimizados por obligaciones contables.'
  );
}

const escapar = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectModel(AccountDeletionRequest.name)
    private readonly solicitudes: Model<AccountDeletionRequestDocument>,
    @InjectModel(User.name) private readonly usuarios: Model<UserDocument>,
    @InjectModel(AccountReceivable.name)
    private readonly cuentas: Model<AccountReceivableDocument>,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * La persona pide, desde la app, que se elimine su cuenta.
   *
   * No borra nada por sí sola: deja la solicitud asentada con el saldo del
   * momento y avisa al dueño, que la procesa. La regla del negocio es que si
   * hay deuda se elimina solo el acceso y se conservan los datos del cobro;
   * por eso el saldo se mide AQUÍ y queda guardado con la solicitud.
   */
  async solicitar(userId: string, motivo?: string): Promise<SolicitudDeBaja> {
    const previa = await this.pendienteDe(userId);
    if (previa) return this.aRespuesta(previa, true);

    const usuario = await this.usuarios.findOne({ _id: userId }).lean().exec();
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const vivas = await this.cuentas
      .find(
        {
          customerId: userId,
          isMerged: { $ne: true },
          status: { $nin: ESTADOS_SALDADOS },
        },
        { amount: 1, paidAmount: 1 },
      )
      .lean()
      .exec();
    const { deuda, cuentasVivas } = resumirDeuda(vivas);
    const alcance: AlcanceDeBaja =
      deuda > TOLERANCIA ? 'solo_acceso' : 'completa';

    const datos = {
      userId,
      email: usuario.email ?? null,
      name: usuario.name ?? null,
      phone: usuario.phone ?? null,
      role: usuario.role ?? null,
      deuda,
      cuentasVivas,
      alcance,
      estado: 'pending' as const,
      motivo: motivo?.trim() ? motivo.trim().slice(0, 500) : null,
      origen: 'app',
    };

    let id: string;
    try {
      const creada = await this.solicitudes.create(datos);
      id = String(creada._id);
    } catch (err) {
      // El índice único parcial rechaza la segunda pendiente: devolver la que ya hay.
      if ((err as { code?: number }).code === 11000) {
        const existente = await this.pendienteDe(userId);
        if (existente) return this.aRespuesta(existente, true);
      }
      throw err;
    }

    await this.avisar({ ...datos, id });
    return {
      id,
      estado: 'pending',
      alcance,
      deuda,
      yaExistia: false,
      mensaje: mensajeDeBaja(alcance, deuda),
    };
  }

  async listar(estado?: EstadoDeBaja) {
    const filtro = estado ? { estado } : {};
    return this.solicitudes
      .find(filtro)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();
  }

  async marcarProcesada(id: string, actorId: string, nota?: string) {
    const actualizada = await this.solicitudes
      .findOneAndUpdate(
        { _id: id },
        {
          estado: 'processed',
          procesadaEn: new Date(),
          procesadaPor: actorId,
          nota: nota?.trim() ? nota.trim().slice(0, 500) : null,
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!actualizada) throw new NotFoundException('Solicitud no encontrada');
    return actualizada;
  }

  private pendienteDe(userId: string) {
    return this.solicitudes
      .findOne({ userId, estado: 'pending' })
      .lean()
      .exec();
  }

  private aRespuesta(
    s: {
      _id: string;
      estado: EstadoDeBaja;
      alcance: AlcanceDeBaja;
      deuda: number;
    },
    yaExistia: boolean,
  ): SolicitudDeBaja {
    return {
      id: String(s._id),
      estado: s.estado,
      alcance: s.alcance,
      deuda: s.deuda,
      yaExistia,
      mensaje: mensajeDeBaja(s.alcance, s.deuda),
    };
  }

  /** Mejor esfuerzo: la solicitud ya está asentada; un correo caído no la deshace. */
  private async avisar(d: {
    id: string;
    email: string | null;
    name: string | null;
    role: string | null;
    deuda: number;
    cuentasVivas: number;
    alcance: AlcanceDeBaja;
    motivo: string | null;
  }): Promise<void> {
    // Sin ACCOUNT_DELETION_NOTIFY_EMAIL no hay a quién avisar: la solicitud queda guardada igual.
    const destino =
      this.config.get<string>('ACCOUNT_DELETION_NOTIFY_EMAIL') ?? '';
    if (!destino) {
      this.logger.warn(
        `Aviso de baja ${d.id} no enviado: falta ACCOUNT_DELETION_NOTIFY_EMAIL`,
      );
      return;
    }
    const que =
      d.alcance === 'solo_acceso'
        ? `Tiene saldo pendiente de $${d.deuda.toFixed(2)} (${d.cuentasVivas} cuentas): eliminar SOLO el acceso y conservar los datos del cobro.`
        : 'Sin saldo pendiente: eliminar la cuenta y los datos personales.';
    const html =
      `<p><b>Solicitud de baja de cuenta</b> (desde la app)</p>` +
      `<p>Nombre: ${escapar(d.name ?? '—')}<br>Correo: ${escapar(d.email ?? '—')}<br>` +
      `Rol: ${escapar(d.role ?? '—')}<br>Solicitud: ${escapar(d.id)}</p>` +
      `<p>${escapar(que)}</p>` +
      (d.motivo ? `<p>Motivo: ${escapar(d.motivo)}</p>` : '');
    const r = await this.email.send(
      destino,
      'Solicitud de baja de cuenta',
      html,
    );
    if (!r.sent) {
      this.logger.warn(`Aviso de baja ${d.id} no enviado: ${r.reason ?? '?'}`);
    }
  }
}

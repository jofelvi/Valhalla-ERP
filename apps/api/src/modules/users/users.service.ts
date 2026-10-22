import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  /**
   * Resetea la contraseña de un usuario (accion de admin).
   *
   * Guarda el hash bcrypt en `passwordHash`, que es EXACTAMENTE el campo que
   * lee el login (`bcrypt.compare(password, user.passwordHash)`). Antes esta
   * pantalla no llamaba a ningun endpoint: mostraba "actualizada" y no cambiaba
   * nada, por eso la clave nueva daba "invalida" al entrar.
   */
  async resetPassword(
    id: string,
    newPassword: string,
    actor?: { id?: string; email?: string },
  ) {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const user = await this.userModel
      .findOneAndUpdate({ _id: id }, { passwordHash }, { new: true })
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }

    this.logger.log(
      `Password reset de ${user.email ?? id} por ${actor?.email ?? actor?.id ?? 'desconocido'}`,
    );

    return { success: true, email: user.email };
  }

  async findAll() {
    const users = await this.userModel.find().lean().exec();
    return users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, pin, pinHash, ...sanitized } = user;
      return { ...sanitized, id: user._id };
    });
  }

  // Lista liviana para pickers (traspasos, asignación): solo id + nombre,
  // sin emails ni datos sensibles — apta para cualquier staff autenticado
  async findActiveWaiters() {
    const waiters = await this.userModel
      .find({ role: 'waiter', isActive: { $ne: false } })
      .select('_id name')
      .lean()
      .exec();
    return waiters.map((w) => ({ id: String(w._id), name: w.name }));
  }

  async findById(id: string) {
    const user = await this.userModel.findOne({ _id: id }).lean().exec();
    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, pin, pinHash, ...sanitized } = user;
    return { ...sanitized, id: user._id };
  }

  async findByEmail(email: string) {
    const user = await this.userModel.findOne({ email }).lean().exec();
    if (!user) {
      throw new NotFoundException(`Usuario con email ${email} no encontrado`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, pin, pinHash, ...sanitized } = user;
    return { ...sanitized, id: user._id };
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    opts: { isAdmin?: boolean } = { isAdmin: true },
  ) {
    // Solo ADMIN puede tocar rol y estado. Cuando el que edita no es admin
    // (editando su propio perfil) se descartan en silencio, para no romper
    // clientes que manden el objeto completo del perfil. Esto es lo que cierra
    // el auto-ascenso ({"role":"admin"}) sin bloquear el auto-servicio.
    const dto: UpdateUserDto =
      opts.isAdmin === false
        ? (() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { role, isActive, ...permitido } = updateUserDto;
            return permitido;
          })()
        : updateUserDto;

    if (dto.email) {
      const existing = await this.userModel
        .findOne({ email: dto.email })
        .lean()
        .exec();
      if (existing && String(existing._id) !== id) {
        throw new BadRequestException('El email ya esta registrado');
      }
    }

    const user = await this.userModel
      .findOneAndUpdate({ _id: id }, dto, { new: true })
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, pin, pinHash, ...sanitized } = user;
    return { ...sanitized, id: user._id };
  }

  async softDelete(id: string) {
    const user = await this.userModel
      .findOneAndUpdate({ _id: id }, { isActive: false }, { new: true })
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, pin, pinHash, ...sanitized } = user;
    return { ...sanitized, id: user._id };
  }
}

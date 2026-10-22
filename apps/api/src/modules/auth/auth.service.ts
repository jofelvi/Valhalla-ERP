import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import {
  Customer,
  CustomerDocument,
} from '../customers/schemas/customer.schema';
import { Member, MemberDocument } from '../public/schemas/member.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserRoleEnum } from '@odin6/types';
import { EmailService } from '../sms/email.service';
import { buildVerificationEmail } from '../sms/email-templates';
import { ConfigsService } from '../configs/configs.service';
import { nombreVisible } from '@odin6/types';
import {
  generateVerificationCode,
  hashVerificationCode,
  verificationExpiry,
  isVerificationCodeValid,
} from './verification-code.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Customer.name)
    private customerModel: Model<CustomerDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Los clientes que se registran desde la app son un `users` (cuenta de login)
   * PERO tambien deben ser un `customers` (ficha del cliente: socio, credito,
   * historial). Aqui se crea esa ficha con el MISMO _id, verificando la accion
   * contra el padron `members`: si la accion no figura, queda como socio sin
   * verificar (no se le da credito hasta revisarla). Es best-effort: un fallo
   * aqui no debe tumbar el registro de la cuenta.
   */
  private async ensureCustomerRecord(
    userId: string,
    dto: RegisterDto,
  ): Promise<void> {
    try {
      const existing = await this.customerModel
        .findOne({ _id: userId })
        .lean()
        .exec();
      if (existing) return;

      const doc: Record<string, unknown> = {
        _id: userId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? undefined,
        isActive: true,
        linkedUserId: userId,
      };

      if (dto.memberAction) {
        const raw = String(dto.memberAction).trim();
        // Formato canonico de la accion: zero-padded a 5 ("00004"), igual que
        // el padron `members._id` y los `customers.memberAction` existentes.
        // El movil manda el numero tal cual (ej "4"), asi que se normaliza.
        const isNumeric = /^\d+$/.test(raw);
        const padded = isNumeric ? raw.padStart(5, '0') : raw;
        const inPadron = await this.memberModel
          .findOne(
            isNumeric
              ? { $or: [{ _id: padded }, { accion: Number(raw) }] }
              : { _id: raw },
          )
          .lean()
          .exec();
        doc.memberAction = padded;
        doc.isMemberPrincipal = dto.isMemberPrincipal ?? false;
        // Si la accion no esta en el padron del club, es un alta a revisar
        // (no se le da credito hasta verificarla manualmente).
        doc.isUnverifiedMember = !inPadron;
      }

      await this.customerModel.create(doc);
    } catch (err) {
      this.logger.error(
        `No se pudo crear el customer del usuario ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /** Codigo + su hash + expiracion, listo para persistir. */
  private prepareVerification(): {
    code: string;
    hash: string;
    expiresAt: Date;
  } {
    const code = generateVerificationCode();
    return {
      code,
      hash: hashVerificationCode(code),
      expiresAt: verificationExpiry(new Date()),
    };
  }

  /**
   * Manda el codigo por correo. Fire-and-forget: un fallo del correo no debe
   * tumbar el registro ni la peticion de reenvio.
   */
  private async sendVerificationEmail(
    to: string,
    name: string | null | undefined,
    code: string,
  ): Promise<void> {
    // La marca sale de la configuración (nombreVisible). El envío no se espera: si el correo
    // falla, no tumba el registro ni el reenvío.
    const [marca, negocio] = await Promise.all([
      this.configs.obtener('marca'),
      this.configs.obtener('negocio'),
    ]);
    const mail = buildVerificationEmail(
      name,
      code,
      nombreVisible(marca, negocio),
    );
    void this.emailService
      .send(to, mail.subject, mail.html)
      .catch(() => undefined);
  }

  async login(loginDto: LoginDto) {
    const user = await this.userModel.findOne({ email: loginDto.email });
    if (!user) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    // Una cuenta sin hash NO adopta la clave que se escriba.
    //
    // Eso hacia antes: los usuarios migrados de Firebase llegaron sin
    // passwordHash y el login guardaba como clave definitiva lo que fuera que
    // se tecleara en el primer intento. O sea que quien supiera el correo de
    // un empleado entraba con la clave que se inventara y se quedaba con la
    // cuenta. En produccion quedaban 7 asi, 3 activas, y una era ADMIN.
    //
    // Ahora se rechaza y se avisa: la clave la pone administracion.
    if (!user.passwordHash) {
      this.logger.warn(
        `Login rechazado: ${user.email} (${user.role}) no tiene clave asignada — viene de la migracion de Firebase`,
      );
      throw new UnauthorizedException(
        'Esta cuenta todavia no tiene clave asignada. Pidele a administracion que te la cree desde Empleados.',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    // Actualizar ultimo login
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Decide el rol final del alta. El registro PUBLICO (sin sesion, o con
   * sesion pero no-admin) SIEMPRE crea CUSTOMER, sin importar que venga en
   * el payload — de lo contrario cualquiera manda `{"role":"admin"}` y se
   * auto-asciende sin autenticarse. Solo un ADMIN autenticado (ver
   * `AuthController.register`, que popula `req.user` cuando hay JWT valido)
   * puede asignar un rol distinto al dar de alta personal desde el panel.
   */
  private resolveRegisterRole(
    requestedRole: string | undefined,
    actor?: { id?: string; role?: string },
  ): UserRoleEnum {
    const isAdminActor = actor?.role === UserRoleEnum.ADMIN;
    const isValidRole = Object.values(UserRoleEnum).includes(
      requestedRole as UserRoleEnum,
    );
    if (isAdminActor && isValidRole) {
      return requestedRole as UserRoleEnum;
    }
    return UserRoleEnum.CUSTOMER;
  }

  async register(
    registerDto: RegisterDto,
    actor?: { id?: string; role?: string },
  ) {
    const existing = await this.userModel.findOne({
      email: registerDto.email,
    });
    if (existing) {
      throw new BadRequestException('El email ya esta registrado');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);
    const verification = this.prepareVerification();
    const role = this.resolveRegisterRole(registerDto.role, actor);

    const user = await this.userModel.create({
      email: registerDto.email,
      name: registerDto.name,
      passwordHash,
      phone: registerDto.phone ?? undefined,
      role,
      emailVerified: false,
      verificationCodeHash: verification.hash,
      verificationExpiresAt: verification.expiresAt,
    });

    // Los clientes viven en `customers`: se crea su ficha con el mismo _id
    // (socio/credito/historial). Espera a que exista antes de devolver, para
    // que el PATCH de perfil posterior del movil tenga a quien actualizar.
    await this.ensureCustomerRecord(String(user._id), registerDto);

    await this.sendVerificationEmail(
      registerDto.email,
      registerDto.name,
      verification.code,
    );

    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  /** Verifica el email con el codigo de 6 digitos. Codigo de un solo uso. */
  async verifyEmail(userId: string, code: string) {
    const user = await this.userModel.findOne({ _id: userId }).exec();
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (user.emailVerified) {
      return { verified: true, user: this.sanitizeUser(user) };
    }
    const ok = isVerificationCodeValid(
      code,
      user.verificationCodeHash,
      user.verificationExpiresAt,
      new Date(),
    );
    if (!ok) {
      throw new BadRequestException('Codigo invalido o expirado');
    }
    user.emailVerified = true;
    user.verificationCodeHash = undefined;
    user.verificationExpiresAt = undefined;
    await user.save();
    return { verified: true, user: this.sanitizeUser(user) };
  }

  /** Reenvia el codigo de verificacion (o informa que ya esta verificado). */
  async resendVerification(userId: string) {
    const user = await this.userModel.findOne({ _id: userId }).exec();
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (user.emailVerified) {
      return { alreadyVerified: true };
    }
    const verification = this.prepareVerification();
    user.verificationCodeHash = verification.hash;
    user.verificationExpiresAt = verification.expiresAt;
    await user.save();
    await this.sendVerificationEmail(user.email, user.name, verification.code);
    return { alreadyVerified: false };
  }

  async refreshToken(userId: string) {
    const user = await this.userModel.findOne({ _id: userId }).lean().exec();
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const accessToken = this.generateToken(user);
    return { accessToken };
  }

  async getMe(userId: string) {
    const user = await this.userModel.findOne({ _id: userId }).lean().exec();
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return this.sanitizeUser(user);
  }

  /**
   * PIN de admin/manager: `pinHash` (bcrypt) manda; si no existe se cae al
   * campo viejo `pin` (texto plano, dato de la migracion Firebase). Un
   * acierto en texto plano se re-hashea al vuelo y borra el campo viejo —
   * asi el parque de PINs se va migrando solo, sin correr un script masivo
   * contra produccion (que ademas no podria: no hay forma de invertir un
   * hash para "revisarlo").
   *
   * Ya no se puede resolver con un solo `findOne` (la comparacion no es un
   * simple match de Mongo cuando hay hash de por medio), asi que se trae a
   * los pocos ADMIN/MANAGER que existen y se compara en memoria.
   */
  async verifyAdminPin(pin: string): Promise<{
    valid: boolean;
    adminName: string | null;
    adminId?: string | null;
    adminRole?: string | null;
  }> {
    const trimmed = pin.trim();
    if (!trimmed) return { valid: false, adminName: null, adminId: null };

    const candidates = await this.userModel
      .find({ role: { $in: [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER] } })
      .exec();

    for (const candidate of candidates) {
      if (await this.pinMatchesAndMigrate(candidate, trimmed)) {
        return {
          valid: true,
          adminName: candidate.name ?? 'Admin',
          adminId: String(candidate._id),
          adminRole: candidate.role ?? null,
        };
      }
    }
    return { valid: false, adminName: null, adminId: null };
  }

  private static readonly BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

  /**
   * true si `candidatePin` coincide con el PIN guardado en `user`. Si el
   * acierto vino del campo viejo en texto plano, migra a `pinHash` antes de
   * devolver el resultado.
   */
  private async pinMatchesAndMigrate(
    user: UserDocument,
    candidatePin: string,
  ): Promise<boolean> {
    if (user.pinHash) {
      return bcrypt.compare(candidatePin, user.pinHash);
    }
    if (!user.pin) return false;
    if (AuthService.BCRYPT_HASH_RE.test(user.pin)) {
      // Dato historico guardado ya como hash pero en el campo viejo.
      return bcrypt.compare(candidatePin, user.pin);
    }
    if (user.pin !== candidatePin) return false;

    user.pinHash = await bcrypt.hash(candidatePin, 10);
    user.pin = undefined;
    await user.save();
    return true;
  }

  private generateToken(user: UserDocument | any): string {
    const payload = {
      sub: typeof user._id === 'string' ? user._id : user._id.toString(),
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: UserDocument | any) {
    const obj = user.toObject ? user.toObject() : user;
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const {
      passwordHash,
      __v,
      verificationCodeHash,
      verificationExpiresAt,
      pin,
      pinHash,
      ...sanitized
    } = obj;
    /* eslint-enable @typescript-eslint/no-unused-vars */
    return { ...sanitized, id: String(obj._id || obj.id || '') };
  }
}

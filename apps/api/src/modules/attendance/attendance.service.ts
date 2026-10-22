import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { businessDayStart, businessDayRangeForQuery } from './attendance-day';
import {
  CreateAttendanceDto,
  CheckInDto,
  CheckOutDto,
} from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UploadSelfieDto } from './dto/upload-selfie.dto';
import { AttendanceSettingsService } from './attendance-settings.service';
import { esLlegadaTarde } from './attendance-settings';
import { ConfigsService } from '../configs/configs.service';
import {
  fechaCalendario,
  medianocheDe,
  finDeDiaCalendario,
} from '../../common/operacion/operacion.util';

const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
);
const ATTENDANCE_DIR = path.join(UPLOADS_DIR, 'attendance');
/** Base pública de las fotos. Sin variable, la ruta queda relativa al propio API. */
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private attendanceModel: Model<AttendanceDocument>,
    private readonly settingsService: AttendanceSettingsService,
    private readonly configs: ConfigsService,
  ) {}

  async checkIn(checkInDto: CheckInDto) {
    // Jornada del negocio (`operacion`), NO la medianoche del servidor: el servidor
    // puede correr en otra zona horaria y su medianoche caer en plena jornada.
    const op = await this.configs.obtener('operacion');
    const jornada = businessDayStart(new Date(), op);

    const existingRecord = await this.attendanceModel
      .findOne({
        employeeId: checkInDto.employeeId,
        date: {
          $gte: jornada,
          $lt: new Date(jornada.getTime() + 24 * 60 * 60 * 1000),
        },
      })
      .exec();

    if (existingRecord) {
      throw new BadRequestException(
        'Ya existe un registro de asistencia para hoy',
      );
    }

    // "Tarde" solo cuando el admin ya guardo su hora de entrada: con el
    // default (9:00) casi todo el personal saldria tarde desde el primer dia.
    // La nomina no mira este estado; lo usan los reportes de asistencia.
    const checkIn = new Date();
    const ajustes = await this.settingsService.obtener();
    const status =
      ajustes.configured && esLlegadaTarde(checkIn, ajustes, op)
        ? 'late'
        : 'present';

    const attendance = await this.attendanceModel.create({
      employeeId: checkInDto.employeeId,
      userId: checkInDto.userId,
      date: jornada,
      checkIn,
      status,
      location: checkInDto.location,
      device: checkInDto.device,
      photoUrl: checkInDto.photoUrl,
    });

    const obj = attendance.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async checkOut(checkOutDto: CheckOutDto) {
    // Se busca el turno ABIERTO mas reciente, no "el registro de hoy": el
    // turno puede cruzar la medianoche y ataba la salida al dia calendario.
    // Ventana de 24h para no cerrar por error un turno de anteayer olvidado.
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const record = await this.attendanceModel
      .findOne({
        employeeId: checkOutDto.employeeId,
        checkOut: null,
        checkIn: { $gte: desde },
      })
      .sort({ checkIn: -1 })
      .exec();

    if (!record) {
      throw new NotFoundException(
        'No hay una entrada abierta para cerrar. Si marcaste entrada hace mas de 24 horas, pidele a un administrador que la cierre.',
      );
    }

    const checkOutTime = new Date();
    record.checkOut = checkOutTime;

    if (record.checkIn) {
      const hours =
        (checkOutTime.getTime() - record.checkIn.getTime()) / (1000 * 60 * 60);
      record.totalHours = Math.max(0, hours);
      record.hoursWorked = Math.max(0, hours);

      if (hours > 8) {
        record.overtimeHours = hours - 8;
      }
    }

    record.location = checkOutDto.location;
    record.device = checkOutDto.device;
    if (checkOutDto.photoUrl) {
      record.checkOutPhotoUrl = checkOutDto.photoUrl;
    }

    await record.save();
    const obj = record.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll(filters?: {
    employeeId?: string;
    date?: Date;
    from?: Date;
    to?: Date;
    onlyOpenEntries?: boolean;
  }) {
    let query = this.attendanceModel.find();

    if (filters?.employeeId) {
      query = query.where('employeeId').equals(filters.employeeId);
    }

    if (filters?.date) {
      // La app manda la MEDIANOCHE del dia que quiere ver, y la medianoche
      // pertenece a la jornada anterior (arranca 6 AM): pasarla por
      // businessDayStart devolvia el dia de ayer y el mesonero no veia su
      // entrada recien marcada. businessDayRangeForQuery lee el parametro
      // como "el dia D" (ver attendance-day.ts).
      const op = await this.configs.obtener('operacion');
      const { start, end } = businessDayRangeForQuery(
        new Date(filters.date),
        op,
      );

      query = query.where('date').gte(start.getTime()).lt(end.getTime());
    }

    if (filters?.from && filters?.to) {
      const op = await this.configs.obtener('operacion');
      const desde = medianocheDe(
        fechaCalendario(new Date(filters.from), op),
        op,
      );
      const hasta = finDeDiaCalendario(
        fechaCalendario(new Date(filters.to), op),
        op,
      );

      query = query.where('date').gte(desde.getTime()).lte(hasta.getTime());
    }

    // Solo entradas abiertas (sin salida), opt-in. Marcar entrada solo
    // pregunta si el empleado ya tiene una abierta y bajaba toda la historia
    // de asistencia (76 KB en PRE el 27/09/2026, creciendo cada dia). En Mongo
    // `equals(null)` tambien toma los documentos sin el campo.
    if (filters?.onlyOpenEntries) {
      query = query.where('checkOut').equals(null);
    }

    const records = await query.lean().exec();
    return records.map((record) => ({ ...record, id: record._id }));
  }

  async findById(id: string) {
    const record = await this.attendanceModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!record) {
      throw new NotFoundException(
        `Registro de asistencia con id ${id} no encontrado`,
      );
    }
    return { ...record, id: record._id };
  }

  async uploadSelfie(dto: UploadSelfieDto): Promise<{ url: string }> {
    if (!dto.imageBase64) {
      throw new BadRequestException('imageBase64 es requerido');
    }

    const ext = dto.extension ?? 'jpg';
    const cleaned = dto.imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
    const buffer = Buffer.from(cleaned, 'base64');

    if (buffer.length === 0) {
      throw new BadRequestException('imageBase64 invalido');
    }

    // 8MB limit
    if (buffer.length > 8 * 1024 * 1024) {
      throw new BadRequestException('La imagen excede 8MB');
    }

    if (!fs.existsSync(ATTENDANCE_DIR)) {
      fs.mkdirSync(ATTENDANCE_DIR, { recursive: true });
    }

    const safeEmployeeId = dto.employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeEmployeeId}_${Date.now()}.${ext}`;
    const fullPath = path.join(ATTENDANCE_DIR, filename);
    fs.writeFileSync(fullPath, buffer);

    return { url: `${PUBLIC_BASE_URL}/uploads/attendance/${filename}` };
  }

  async update(id: string, updateAttendanceDto: UpdateAttendanceDto) {
    const record = await this.attendanceModel
      .findOneAndUpdate({ _id: id }, updateAttendanceDto, { new: true })
      .lean()
      .exec();

    if (!record) {
      throw new NotFoundException(
        `Registro de asistencia con id ${id} no encontrado`,
      );
    }

    return { ...record, id: record._id };
  }
}

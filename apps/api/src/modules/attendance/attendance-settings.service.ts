import { Injectable, Logger } from '@nestjs/common';
import { ConfigsService } from '../configs/configs.service';
import {
  AjustesAsistencia,
  ID_CONFIG_ASISTENCIA,
  normalizarAjustesAsistencia,
} from './attendance-settings';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';

export interface AjustesAsistenciaVigentes extends AjustesAsistencia {
  /**
   * false mientras nadie haya guardado ajustes: se sirven los defaults y NO se
   * marca a nadie como tarde (con 9:00 por defecto, casi todo el personal del
   * restaurante saldria "tarde" el primer dia).
   */
  configured: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
}

@Injectable()
export class AttendanceSettingsService {
  private readonly logger = new Logger(AttendanceSettingsService.name);

  // Se lee en cada fichaje y cambia casi nunca (la caché de 60 s la pone ConfigsService).
  constructor(private readonly configs: ConfigsService) {}

  async obtener(): Promise<AjustesAsistenciaVigentes> {
    // Sin config no se cae el fichaje: se usan los defaults del APK.
    return this.configs.obtenerCrudo(ID_CONFIG_ASISTENCIA, (doc) => ({
      ...normalizarAjustesAsistencia(doc),
      configured: doc !== null,
      updatedAt: doc?.updatedAt instanceof Date ? doc.updatedAt : null,
      updatedBy: typeof doc?.updatedBy === 'string' ? doc.updatedBy : null,
    }));
  }

  /** Mezcla lo recibido sobre lo vigente: se puede mandar solo un campo. */
  async actualizar(
    cambios: UpdateAttendanceSettingsDto,
    actor: string | null,
  ): Promise<AjustesAsistenciaVigentes> {
    const vigentes = await this.obtener();
    const nuevos = normalizarAjustesAsistencia({
      geofence: { ...vigentes.geofence, ...cambios.geofence },
      standardCheckInHour:
        cambios.standardCheckInHour ?? vigentes.standardCheckInHour,
      lateGraceMinutes: cambios.lateGraceMinutes ?? vigentes.lateGraceMinutes,
    });

    await this.configs.actualizarCrudo(
      ID_CONFIG_ASISTENCIA,
      {},
      { $set: { ...nuevos, updatedAt: new Date(), updatedBy: actor } },
      true,
    );
    this.logger.log(
      `configs/${ID_CONFIG_ASISTENCIA} actualizado por ${actor ?? 'desconocido'}: ${JSON.stringify(nuevos)}`,
    );

    return this.obtener();
  }
}

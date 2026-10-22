import { Injectable, Logger } from '@nestjs/common';
import { ConfigsService } from '../configs/configs.service';
import { inicioDeSemana, socioDe, TurnosSocios } from './turnos-socios.helper';

export interface SemanaDeTurno {
  desde: Date;
  /** desde + 7 dias (exclusivo). */
  hasta: Date;
  socio: string;
  estimado: boolean;
}

// Anclado en lo que confirmo el dueño: la semana del martes 25 de agosto
// la administro Jonathan, y el ciclo es Daisy -> Orlando -> Jonathan.
const POR_DEFECTO: TurnosSocios = {
  ciclo: ['Daisy', 'Orlando', 'Jonathan'],
  ancla: '2026-05-05T10:00:00.000Z',
  anclaIndice: 1,
  excepciones: {},
};

/**
 * Lee `configs/turnos_socios`. Vive en Mongo y no en el codigo porque los
 * socios se cambian semanas entre ellos: si estuviera quemado, cada
 * intercambio necesitaria un despliegue.
 */
@Injectable()
export class TurnosSociosService {
  private readonly logger = new Logger(TurnosSociosService.name);

  constructor(private readonly configs: ConfigsService) {}

  async leerTurnos(): Promise<TurnosSocios> {
    return this.configs.obtenerCrudo('turnos_socios', (doc) => {
      if (!doc) return POR_DEFECTO;
      return {
        ciclo: Array.isArray(doc.ciclo)
          ? (doc.ciclo as string[])
          : POR_DEFECTO.ciclo,
        ancla: typeof doc.ancla === 'string' ? doc.ancla : POR_DEFECTO.ancla,
        anclaIndice:
          typeof doc.anclaIndice === 'number'
            ? doc.anclaIndice
            : POR_DEFECTO.anclaIndice,
        excepciones: (doc.excepciones as Record<string, string>) ?? {},
      };
    });
  }

  async semanaDe(date: Date): Promise<SemanaDeTurno> {
    const turnos = await this.leerTurnos();
    const desde = inicioDeSemana(date, turnos.ancla);
    const { socio, estimado } = socioDe(desde, turnos);
    return {
      desde,
      hasta: new Date(desde.getTime() + 7 * 86400000),
      socio,
      estimado,
    };
  }

  invalidar(): void {
    this.configs.invalidar('turnos_socios');
  }
}

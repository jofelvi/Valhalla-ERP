import { Injectable } from '@nestjs/common';
import { CostPropagationService } from './cost-propagation.service';
import { AlertaMargen, ordenarAlertas } from './margin-alerts.util';

/**
 * ORQUESTADOR DE ALERTAS DE MARGEN.
 *
 * Interfaz limpia hacia los controladores y servicios que necesitan alertas.
 * La lógica de propagación de costo y evaluación de margen vive en
 * CostPropagationService; aquí solo exponemos y ordenamos los resultados.
 */
@Injectable()
export class MarginAlertsService {
  constructor(private readonly costPropagation: CostPropagationService) {}

  /**
   * Alertas abiertas (productos en riesgo) ordenadas por gravedad.
   *
   * Devuelve los márgenes NEGATIVO, NULO y BAJO que están activos (sin fecha
   * de resolución). Ordenadas de lo más grave a lo menos.
   *
   * @returns Alertas abiertas ordenadas
   */
  async listarAbiertas(): Promise<AlertaMargen[]> {
    const crudas = await this.costPropagation.listarAbiertas();
    return ordenarAlertas(crudas);
  }

  /**
   * Cuenta de alertas abiertas por nivel de severidad.
   *
   * @returns { negativo, nulo, bajo }
   */
  async contarPorNivel(): Promise<{
    negativo: number;
    nulo: number;
    bajo: number;
  }> {
    const alertas = await this.listarAbiertas();
    return {
      negativo: alertas.filter((a) => a.nivel === 'NEGATIVO').length,
      nulo: alertas.filter((a) => a.nivel === 'NULO').length,
      bajo: alertas.filter((a) => a.nivel === 'BAJO').length,
    };
  }

  /**
   * Las más graves (NEGATIVO + NULO): se pierde o se vende al costo.
   *
   * @returns Alertas graves
   */
  async listarGraves(): Promise<AlertaMargen[]> {
    const alertas = await this.listarAbiertas();
    return alertas.filter((a) => a.nivel === 'NEGATIVO' || a.nivel === 'NULO');
  }
}

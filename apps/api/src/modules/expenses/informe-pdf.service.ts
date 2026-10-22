import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { OperacionConfig } from '@odin6/types';
import { InformeSemanal } from './expenses-report.helper';
import { ConfigsService } from '../configs/configs.service';
import { fechaCalendario } from '../../common/operacion/operacion.util';
import { formatearInformeHtml } from './informe-html.helper';

/**
 * El informe de la semana, en PDF.
 *
 * Usa el chromium de Playwright que ya vive en el VPS para los scrapers del
 * banco (`banvenez-session`, `subasta-watcher`): imprimir una pagina que ya
 * sabemos maquetar sale mas barato que aprender a dibujar un PDF a mano, y no
 * agrega una sola dependencia.
 *
 * El navegador se abre y se cierra por informe. Es una vez por semana: no vale
 * la pena mantener un proceso de chromium vivo los otros 7 dias.
 */
@Injectable()
export class InformePdfService {
  private readonly log = new Logger(InformePdfService.name);

  constructor(private readonly configs: ConfigsService) {}

  async generar(inf: InformeSemanal): Promise<Buffer> {
    const html = formatearInformeHtml(
      inf,
      await this.configs.obtener('operacion'),
    );
    const navegador = await chromium.launch({ args: ['--no-sandbox'] });
    try {
      const pagina = await navegador.newPage();
      await pagina.setContent(html, { waitUntil: 'load' });
      const pdf = await pagina.pdf({ format: 'A4', printBackground: true });
      this.log.log(`informe en PDF: ${(pdf.length / 1024).toFixed(0)} KB`);
      return pdf;
    } finally {
      await navegador.close();
    }
  }

  /** `informe-2026-09-15.pdf`: ordena solo en la carpeta de quien lo archive. */
  nombreArchivo(inf: InformeSemanal, op: OperacionConfig): string {
    return `informe-${fechaCalendario(inf.semana.desde, op)}.pdf`;
  }
}

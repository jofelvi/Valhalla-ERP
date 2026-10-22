import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigsService } from '../configs/configs.service';
import { Page, Response } from 'playwright';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  BanvenezSessionService,
  jsClickByText,
  MENU_LINKS,
} from '../banvenez/banvenez-session.service';
import { SmsService } from '../sms/sms.service';
import { EmailService } from '../sms/email.service';
import {
  clasificarSubasta,
  EstadoSubasta,
  SubastaScreen,
} from './subasta-status';

/**
 * Vigila la Subasta electronica de divisas del BDV durante una franja horaria
 * y avisa por SMS y correo en cuanto deja de estar cerrada.
 *
 * Por que un solo login y muchas comprobaciones: entrar cuesta ~40s y abrir
 * sesion 18 veces en media hora es justo lo que hace que un banco marque la
 * cuenta. Se entra una vez y se vuelve a pulsar el menu cada intervalo, que es
 * ademas lo que hace una persona.
 */
export interface WatchOptions {
  /** Momento en que se deja de vigilar. */
  until: Date;
  /** Espera entre comprobaciones. */
  intervalMs: number;
  /** Veces que se puede volver a entrar si el banco tumba la sesion. */
  maxSessions: number;
  /** Carpeta donde guardar HTML/screenshot cuando el estado no es CERRADA. */
  artifactsDir?: string;
  /** false abre un navegador visible (modo local). */
  headless?: boolean;
  /**
   * true deja la ventana abierta y la sesion viva al terminar, para poder
   * comprar en el acto cuando la subasta abra.
   */
  keepBrowserOpen?: boolean;
}

export interface WatchResult {
  estado: EstadoSubasta;
  checks: number;
  sessions: number;
  notified: boolean;
}

interface CheckResult {
  estado: EstadoSubasta;
  screen: SubastaScreen;
}

/** Endpoint que la propia app consulta para saber si hay subasta. */
const ENDPOINT_ESTADO = 'validar-subasta';

@Injectable()
export class SubastaWatcherService {
  private readonly logger = new Logger(SubastaWatcherService.name);

  constructor(
    private readonly session: BanvenezSessionService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Una comprobacion sobre una sesion ya abierta: pulsa Divisas > Subasta
   * electronica y lee la pantalla. No navega a ningun sitio (el portal se queda
   * donde esta cuando la subasta esta cerrada), asi que no hay riesgo de tocar
   * nada por error.
   */
  async checkOnce(page: Page): Promise<CheckResult> {
    await this.abrirMenuDivisas(page);

    // Escuchar ANTES de pulsar. Al abrir el menu la app consulta su propio
    // endpoint de estado y contesta en ~200ms, mucho antes de que Angular pinte
    // el aviso. Esperar esa respuesta en vez de un tiempo fijo es lo que baja
    // la comprobacion de ~5s a ~1s: con una ventana que abre por segundos, cada
    // segundo de espera a ciegas se paga en oportunidades perdidas.
    const esperaEstado = page
      .waitForResponse((r) => r.url().includes(ENDPOINT_ESTADO), {
        timeout: 8000,
      })
      .catch(() => null);

    const item = await jsClickByText(page, ['Subasta electr'], MENU_LINKS);
    if (!item)
      throw new Error(
        'No se encontro "Subasta electronica" en el menu Divisas',
      );

    const respCifrado = await this.leerCifrado(await esperaEstado);

    // Esperar A QUE APAREZCA el aviso de cerrado, no un tiempo fijo. Esto es
    // critico: su ausencia se interpreta como "entro", asi que un margen corto
    // de mas daria un falso positivo y el vigilante dejaria de vigilar creyendo
    // que ya esta dentro. Se espera hasta que salga; si no sale en 3,5s es que
    // de verdad no va a salir.
    await page
      .waitForFunction(
        () => {
          const s = document.querySelector(
            'simple-snack-bar, mat-snack-bar-container',
          );
          return (
            !!s && (s.textContent ?? '').toLowerCase().includes('cambiaria')
          );
        },
        { timeout: 3500 },
      )
      .catch(() => undefined);

    const screen = await page.evaluate((): SubastaScreen => {
      const snack = document.querySelector<HTMLElement>(
        'simple-snack-bar, mat-snack-bar-container',
      );
      const campos = Array.from(
        document.querySelectorAll<HTMLElement>(
          'input, mat-select, select, textarea',
        ),
      ).filter((el) => !!(el.offsetWidth || el.offsetHeight));

      return {
        url: window.location.href,
        snackbarText: snack?.textContent?.trim() ?? '',
        bodyText: document.body?.innerText ?? '',
        inputCount: campos.length,
      };
    });

    screen.respCifrado = respCifrado;

    // Material encola los snack-bars: si no se cierra el actual, el de la
    // siguiente vuelta puede no llegar a pintarse y leeriamos una pantalla
    // vacia como DESCONOCIDA.
    await this.dismissSnackbar(page);

    return { estado: clasificarSubasta(screen, this.baseline), screen };
  }

  /**
   * La linea base es el texto cifrado que devuelve el endpoint con la subasta
   * CERRADA. Sin ella configurada la senal se ignora, para no avisar por ruido
   * mientras no este confirmado que ese valor es estable entre sesiones.
   */
  private get baseline(): string {
    return this.config.get<string>('DIVISAS_SUBASTA_BASELINE') ?? '';
  }

  private async leerCifrado(respuesta: Response | null): Promise<string> {
    if (!respuesta) return '';
    try {
      const cuerpo = (await respuesta.json()) as { resp?: unknown };
      return typeof cuerpo.resp === 'string' ? cuerpo.resp : '';
    } catch {
      return '';
    }
  }

  /**
   * Abre el desplegable de Divisas y NO se fia de que se haya abierto.
   *
   * Pulsar "Subasta electronica" con la subasta cerrada no navega a ningun
   * sitio, asi que el desplegable se queda abierto. En la vuelta siguiente el
   * clic sobre "Divisas" lo CIERRA en vez de abrirlo y el item desaparece del
   * DOM (Material solo pinta el contenido del menu mientras esta abierto). Se
   * veia como "No se encontro Subasta electronica" en la 2a comprobacion de
   * cada sesion.
   */
  private async abrirMenuDivisas(page: Page): Promise<void> {
    // Lo primero es mirar, no pulsar: el desplegable se queda abierto de la
    // vuelta anterior y un clic a ciegas lo CERRARIA. Escape no lo cierra
    // (no es un overlay de Material, es un desplegable propio del portal).
    if (await this.itemSubastaVisible(page, 500)) return;

    for (let intento = 1; intento <= 2; intento++) {
      const menu = await jsClickByText(page, ['Divisas'], MENU_LINKS);
      if (!menu) throw new Error('No se encontro el menu "Divisas"');

      if (await this.itemSubastaVisible(page, 4000)) return;
      this.logger.warn(
        `El menu Divisas no abrio al intento ${intento}; reintentando`,
      );
    }

    throw new Error('El menu Divisas no llego a abrirse');
  }

  /**
   * Que el item exista es la prueba de que el desplegable esta abierto: el
   * portal solo pinta el contenido del menu mientras lo esta.
   */
  private async itemSubastaVisible(
    page: Page,
    timeout: number,
  ): Promise<boolean> {
    return page
      .waitForFunction(
        () =>
          Array.from(
            document.querySelectorAll('button, a, [role="menuitem"]'),
          ).some((el) =>
            el.textContent?.toLowerCase().includes('subasta electr'),
          ),
        { timeout },
      )
      .then(() => true)
      .catch(() => false);
  }

  private async dismissSnackbar(page: Page): Promise<void> {
    await page
      .evaluate(() => {
        document
          .querySelector<HTMLButtonElement>('simple-snack-bar button')
          ?.click();
      })
      .catch(() => undefined);
    await page.waitForTimeout(500);
  }

  /**
   * Vigila hasta que la subasta abra o se acabe la franja. Reabre sesion si el
   * banco la tumba, pero solo mientras quede tiempo y sesiones disponibles.
   */
  async watch(options: WatchOptions): Promise<WatchResult> {
    const avisados = new Set<EstadoSubasta>();
    let checks = 0;
    let sessions = 0;
    let ultimoEstado: EstadoSubasta = 'DESCONOCIDA';

    while (
      Date.now() < options.until.getTime() &&
      sessions < options.maxSessions
    ) {
      sessions++;
      this.logger.log(
        `Abriendo sesion ${sessions}/${options.maxSessions} en el banco`,
      );

      try {
        const abrio = await this.session.withSession(
          async (page) => {
            let fallosSeguidos = 0;

            while (Date.now() < options.until.getTime()) {
              checks++;

              // Un ciclo malo no puede costar una sesion: entrar de nuevo son
              // ~40s y solo hay presupuesto para unos pocos logins. Se insiste
              // sobre la sesion viva y solo se rinde tras varios fallos
              // seguidos, que ya sugieren que la sesion esta muerta.
              let resultado: CheckResult;
              try {
                resultado = await this.checkOnce(page);
                fallosSeguidos = 0;
              } catch (err) {
                fallosSeguidos++;
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(
                  `Comprobacion ${checks} fallo (${fallosSeguidos} seguidas): ${msg}`,
                );
                if (fallosSeguidos >= 3) throw err;

                const espera = options.until.getTime() - Date.now();
                if (espera <= 0) break;
                await page.waitForTimeout(Math.min(options.intervalMs, espera));
                continue;
              }

              const { estado, screen } = resultado;
              ultimoEstado = estado;
              this.logger.log(
                `Comprobacion ${checks}: ${estado} (cifrado: ${screen.respCifrado ? screen.respCifrado.slice(0, 24) + '...' : 'no leido'})`,
              );

              if (estado !== 'CERRADA') {
                await this.guardarEvidencia(
                  page,
                  screen,
                  estado,
                  options.artifactsDir,
                );
                if (!avisados.has(estado)) {
                  avisados.add(estado);
                  await this.avisar(estado, screen);
                }
                // Solo ABIERTA termina el trabajo. Con DESCONOCIDA se sigue
                // vigilando: puede ser un render a medias y la subasta abrir
                // de verdad un minuto despues.
                if (estado === 'ABIERTA') return true;
              }

              const restante = options.until.getTime() - Date.now();
              if (restante <= 0) break;
              await page.waitForTimeout(Math.min(options.intervalMs, restante));
            }
            return false;
          },
          {
            blockAssets: false,
            maxNavAttempts: 3,
            headless: options.headless,
            closeOnFinish: !options.keepBrowserOpen,
          },
        );

        if (abrio) {
          return { estado: 'ABIERTA', checks, sessions, notified: true };
        }
        // La franja se acabo con la sesion todavia viva.
        break;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Sesion ${sessions} terminada con error: ${msg}`);
        if (Date.now() >= options.until.getTime()) break;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    return {
      estado: ultimoEstado,
      checks,
      sessions,
      notified: avisados.size > 0,
    };
  }

  /** Deja el HTML y el screenshot en disco para poder mirar que paso. */
  private async guardarEvidencia(
    page: Page,
    screen: SubastaScreen,
    estado: EstadoSubasta,
    dir?: string,
  ): Promise<void> {
    if (!dir) return;
    try {
      await fs.mkdir(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const base = join(dir, `${stamp}-${estado}`);
      await fs.writeFile(`${base}.html`, await page.content(), 'utf8');
      await fs.writeFile(`${base}.txt`, screen.bodyText, 'utf8');
      await page.screenshot({ path: `${base}.png`, fullPage: true });
      this.logger.log(`Evidencia guardada en ${base}.*`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo guardar evidencia: ${msg}`);
    }
  }

  private get phone(): string {
    return this.config.get<string>('DIVISAS_NOTIFY_PHONE') ?? '';
  }

  private get emailTo(): string {
    return this.config.get<string>('DIVISAS_NOTIFY_EMAIL') ?? '';
  }

  private async avisar(
    estado: EstadoSubasta,
    screen: SubastaScreen,
  ): Promise<void> {
    const { timezone: zona, locale } = await this.configs.obtener('operacion');
    const hora = new Date().toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zona,
    });

    // Un SMS son 160 caracteres: el texto va al grano porque lo que importa es
    // que llegue completo en un solo mensaje.
    const texto =
      estado === 'ABIERTA'
        ? `BDV ${hora}: la SUBASTA de divisas esta ABIERTA. Entra ya: Divisas > Subasta electronica en el portal del banco`
        : `BDV ${hora}: la pantalla de subasta cambio y no la reconozco. Revisa a mano por si abrio.`;

    const asunto =
      estado === 'ABIERTA'
        ? 'BDV: subasta de divisas ABIERTA'
        : 'BDV: estado de la subasta DESCONOCIDO';

    const html = `
      <h2>${asunto}</h2>
      <p><strong>Hora:</strong> ${hora} (hora de la operacion)</p>
      <p><strong>Estado:</strong> ${estado}</p>
      <p><strong>URL:</strong> ${screen.url}</p>
      <p><strong>Mensaje en pantalla:</strong> ${screen.snackbarText || '(ninguno)'}</p>
      <p><strong>Campos visibles:</strong> ${screen.inputCount}</p>
      <p><a href="${this.config.get<string>('BANK_PORTAL_URL') ?? ''}">Abrir el portal del banco</a></p>
    `;

    const [smsResult, emailResult] = await Promise.all([
      this.sms.send(this.phone, texto),
      this.email.send(this.emailTo, asunto, html),
    ]);

    this.logger.log(
      `Aviso ${estado} — sms: ${smsResult.sent ? 'enviado' : smsResult.reason}, correo: ${emailResult.sent ? 'enviado' : emailResult.reason}`,
    );
  }

  /**
   * Resumen al cerrar la franja. Se manda siempre, incluso si no abrio: un bot
   * que solo habla cuando pasa algo es indistinguible de un bot muerto.
   */
  async enviarResumen(result: WatchResult): Promise<void> {
    const { timezone: zona, locale } = await this.configs.obtener('operacion');
    const fecha = new Date().toLocaleDateString(locale, {
      timeZone: zona,
    });
    const abrio = result.estado === 'ABIERTA';
    const asunto = abrio
      ? `BDV ${fecha}: la subasta ABRIO`
      : `BDV ${fecha}: la subasta no abrio en la franja`;

    await this.email.send(
      this.emailTo,
      asunto,
      `
        <h2>${asunto}</h2>
        <ul>
          <li><strong>Estado final:</strong> ${result.estado}</li>
          <li><strong>Comprobaciones:</strong> ${result.checks}</li>
          <li><strong>Sesiones abiertas:</strong> ${result.sessions}</li>
        </ul>
      `,
    );
  }
}

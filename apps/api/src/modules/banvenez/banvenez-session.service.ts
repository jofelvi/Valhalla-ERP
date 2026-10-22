import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigsService } from '../configs/configs.service';
import { chromium, Browser, Page } from 'playwright';

/**
 * Sesion de BDVenlinea: abrir navegador, entrar y salir.
 *
 * Se extrajo de BanvenesScrapeService cuando el vigilante de la subasta de
 * divisas necesito el mismo login. Vive aparte para que el dia que el banco
 * cambie el formulario haya un solo sitio que tocar.
 *
 * Sobre el reintento de navegacion: en los logs de PM2 entre el 20/07 y el
 * 13/08 hubo 68 timeouts de page.goto contra 18 logins exitosos (~80% de
 * fallos). El portal entra en mal estado por rachas de una o dos horas y se
 * recupera solo; curl responde 200 en el mismo momento en que el navegador
 * cuelga. No esta en nuestra mano arreglarlo, asi que se reintenta la
 * NAVEGACION con un navegador nuevo. Nunca se reintentan las credenciales por
 * su cuenta: si se llego al formulario el fallo ya no es de red, y machacar el
 * login bloquearia la cuenta.
 */
export interface SessionOptions {
  /**
   * Descarta imagenes, css y fuentes: mas rapido para raspar datos, pero deja
   * los screenshots en blanco. El vigilante de subasta los quiere.
   */
  blockAssets?: boolean;
  /** Intentos de carga del portal antes de rendirse. */
  maxNavAttempts?: number;
  /**
   * false abre un navegador VISIBLE. Para correr el vigilante en la PC de uno
   * y poder mirar la pantalla del banco mientras vigila.
   */
  headless?: boolean;
  /**
   * false deja el navegador ABIERTO al terminar, sin cerrar sesion. Es lo que
   * hace util el modo local: cuando la subasta abre, la ventana se queda ahi
   * con la sesion viva para poder comprar en el acto.
   */
  closeOnFinish?: boolean;
}

const DEFAULT_TIMEOUT = 45_000;

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--no-first-run',
  '--no-zygote',
  '--disable-background-networking',
  '--mute-audio',
  // Anti-deteccion headless (Radware/F5 delante del portal)
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--window-size=1280,800',
  '--lang=es-VE,es',
];

/**
 * El portal no expone routerlink ni aria-label utiles: solo queda el texto.
 *
 * El selector importa y no es un detalle. El portal pinta DOS menus con las
 * mismas etiquetas: el desplegable de arriba son <a>, y hay otro juego de
 * <button> (el lateral). Pulsar uno u otro lleva a sitios distintos: el de
 * Movimientos en linea solo aparece por la via de los <button>. Por eso el
 * valor por defecto es 'button' — es el que lleva anos funcionando para pago
 * movil — y quien necesite los <a> los pide explicitamente.
 */
export const MENU_LINKS = 'button, a, [role="menuitem"]';

export async function jsClickByText(
  page: Page,
  texts: string[],
  selector = 'button',
): Promise<string | null> {
  return page.evaluate(
    ({ txts, sel }: { txts: string[]; sel: string }) => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(sel));
      const hit = nodes.find((el) =>
        txts.some((t) =>
          el.textContent?.toLowerCase().includes(t.toLowerCase()),
        ),
      );
      if (hit) {
        hit.click();
        return hit.textContent?.trim() ?? null;
      }
      return null;
    },
    { txts: texts, sel: selector },
  );
}

@Injectable()
export class BanvenezSessionService {
  private readonly logger = new Logger(BanvenezSessionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly configs: ConfigsService,
  ) {}

  /** Portal del banco: viene de BANK_PORTAL_URL. Sin variable no hay sesión que abrir. */
  private urlDelPortal(): string {
    const url = this.configService.get<string>('BANK_PORTAL_URL')?.trim() ?? '';
    if (!url)
      throw new Error(
        'Falta BANK_PORTAL_URL: el portal del banco no esta configurado',
      );
    return url;
  }

  private get credentials(): { username: string; password: string } | null {
    const username = this.configService.get<string>('BANK_USERNAME');
    const password = this.configService.get<string>('BANK_PASSWORD');
    if (!username || !password) return null;
    return { username, password };
  }

  /**
   * Entra al banco, ejecuta el trabajo y sale siempre (aunque el trabajo falle).
   * Lanza si no hay credenciales o si el portal no carga tras los reintentos.
   */
  async withSession<T>(
    work: (page: Page) => Promise<T>,
    options: SessionOptions = {},
  ): Promise<T> {
    const creds = this.credentials;
    if (!creds) {
      throw new Error('BANK_USERNAME o BANK_PASSWORD no configurados');
    }

    const maxAttempts = options.maxNavAttempts ?? 3;

    const cerrarAlTerminar = options.closeOnFinish !== false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const browser = await chromium.launch({
        headless: options.headless !== false,
        args: LAUNCH_ARGS,
      });
      let reachedPortal = false;

      try {
        const page = await this.newPage(browser, options);
        await page.goto(this.urlDelPortal(), { waitUntil: 'domcontentloaded' });
        // A partir de aqui un fallo ya no es de red: no se reintenta.
        reachedPortal = true;

        await this.login(page, creds.username, creds.password);
        const resultado = await work(page);

        // Solo el camino de exito respeta closeOnFinish: en modo local el
        // navegador se queda abierto a proposito, porque es la ventana en la
        // que el usuario va a comprar.
        if (cerrarAlTerminar) {
          await this.logout(page).catch(() => undefined);
          await browser.close().catch(() => undefined);
        }
        return resultado;
      } catch (error) {
        // Ante un error SIEMPRE se cierra, aunque sea modo local: si no, cada
        // reintento dejaria una ventana huerfana abierta.
        await browser.close().catch(() => undefined);

        const msg = error instanceof Error ? error.message : String(error);
        if (reachedPortal || attempt === maxAttempts) throw error;
        this.logger.warn(
          `El portal no cargo (intento ${attempt}/${maxAttempts}): ${msg}. Reintentando con navegador nuevo.`,
        );
        await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
      }
    }

    // Inalcanzable: el ultimo intento relanza. Esta por exhaustividad del tipo.
    throw new Error('No se pudo abrir el portal del banco');
  }

  private async newPage(
    browser: Browser,
    options: SessionOptions,
  ): Promise<Page> {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      locale: (await this.configs.obtener('operacion')).locale,
      timezoneId: (await this.configs.obtener('operacion')).timezone,
      viewport: { width: 1280, height: 800 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    if (options.blockAssets) {
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
          void route.abort();
        } else {
          void route.continue();
        }
      });
    }

    return page;
  }

  /** Si quedo una sesion abierta, el banco pinta un "Aceptar" que hay que pulsar. */
  private async clickAceptar(page: Page): Promise<boolean> {
    return page.evaluate((): boolean => {
      const aceptar = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button'),
      ).find((b) => b.textContent?.includes('Aceptar'));
      if (aceptar) {
        aceptar.click();
        return true;
      }
      return false;
    });
  }

  private async fillCredentials(
    page: Page,
    username: string,
    password: string,
  ): Promise<void> {
    await page.waitForSelector('input[formcontrolname="username"]', {
      state: 'visible',
    });
    await page.fill('input[formcontrolname="username"]', username);
    await page.evaluate(() => {
      document
        .querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.click();
    });
    await page.waitForSelector('mat-dialog-container', { state: 'visible' });
    await page.waitForSelector('input[formcontrolname="password"]', {
      state: 'visible',
    });
    await page.fill('input[formcontrolname="password"]', password);
    await page.waitForFunction(() =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('button[type="submit"]'),
      ).some((btn) => btn.textContent?.includes('Continuar') && !btn.disabled),
    );
    await page.evaluate(() => {
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('button[type="submit"]'),
      )
        .find((b) => b.textContent?.includes('Continuar') && !b.disabled)
        ?.click();
    });
    await page.waitForSelector('mat-dialog-container', { state: 'hidden' });
    await page.waitForTimeout(1500);
  }

  /** Asume que la pagina del portal ya cargo. */
  private async login(
    page: Page,
    username: string,
    password: string,
  ): Promise<void> {
    await page.waitForTimeout(2000);

    if (await this.clickAceptar(page)) {
      this.logger.warn('Sesion activa detectada antes del login — cerrandola');
      await page.waitForTimeout(2000);
    }

    await this.fillCredentials(page, username, password);

    // El banco puede devolver al login si habia una sesion activa que desplazo.
    if (await this.clickAceptar(page)) {
      this.logger.warn(
        'Sesion activa desplazada post-login — reintentando credenciales',
      );
      await page.waitForTimeout(2500);

      const onLoginPage = await page.evaluate(
        () => !!document.querySelector('input[formcontrolname="username"]'),
      );

      if (onLoginPage) {
        await this.fillCredentials(page, username, password);
        if (await this.clickAceptar(page)) {
          await page.waitForTimeout(1500);
        }
      }
    }

    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('button')).some((b) =>
          b.textContent?.includes('Consultas'),
        ),
      { timeout: 30_000 },
    );

    this.logger.log('Login en Banvenez completado');
  }

  private async logout(page: Page): Promise<void> {
    await jsClickByText(page, ['Salir'], MENU_LINKS);
    await page.waitForTimeout(1000);
  }
}

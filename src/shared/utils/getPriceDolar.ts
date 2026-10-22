import { parseTasaBcvHtml } from './bcvHtmlParse';
import { esTasaConfiable } from './bcvRateGuard';
import type { Browser, ElementHandle, Page } from 'puppeteer';
import puppeteer from 'puppeteer';

type TextCleaner = (text: string) => string;

export const getPriceBcvFromAPI = async (): Promise<{
  rate: string;
  source: string;
}> => {
  const response = await fetch('https://bcv-api.rafnixg.dev/rates/', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `API respondió con status ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (!data.dollar || isNaN(parseFloat(data.dollar))) {
    throw new Error('Respuesta de API inválida o sin dato de dólar');
  }

  return { rate: String(data.dollar), source: 'bcv-api (rafnixg)' };
};

export const getPriceBcvFromScraper = async (): Promise<{
  rate: string;
  source: string;
}> => {
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ] as string[],
    });

    const page: Page = await browser.newPage();
    await page.setBypassCSP(true);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    );

    await page.goto(
      'https://www.bcv.org.ve/seccionportal/tipo-de-cambio-oficial-del-bcv',
      { waitUntil: 'domcontentloaded' as const, timeout: 30000 },
    );

    const selectors = [
      '#dolar .centrado strong',
      '#dolar strong',
      '.centrado strong',
      '#dolar',
    ];

    let element: ElementHandle<Element> | null = null;
    let usedSelector = '';

    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        element = await page.$(selector);
        if (element) {
          usedSelector = selector;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!element) {
      throw new Error(
        `Elemento de precio no encontrado (selector: ${usedSelector})`,
      );
    }

    const rawText: string | null = await element.evaluate(
      (el: Element) => el.textContent,
    );

    if (!rawText) {
      throw new Error('El elemento de precio no contiene texto');
    }

    const cleanPriceText: TextCleaner = (text: string): string =>
      text
        .replace(/\s+/g, ' ')
        .replace(/[^\d,]/g, '')
        .replace(',', '.')
        .trim();

    return { rate: cleanPriceText(rawText), source: 'bcv-scraper (puppeteer)' };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignorar */
      }
    }
  }
};

export const getPriceBcvFromDolarApi = async (): Promise<{
  rate: string;
  source: string;
}> => {
  const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `dolarapi respondio con status ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (!data.promedio || isNaN(parseFloat(String(data.promedio)))) {
    throw new Error('Respuesta de dolarapi invalida o sin dato de promedio');
  }

  return { rate: String(data.promedio), source: 'bcv-api (dolarapi)' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Fuentes de la tasa. El 19/08/2026 la caja cobró con una tasa inventada porque
// de las tres "fuentes" que había solo UNA respondía: rafnixg devolvía vacío y
// el scraper con Puppeteer no tiene Chrome en el servidor. Verificado el
// 20/08/2026 contra el VPS, estas tres responden de verdad.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BCV oficial. Es la autoridad: dolarapi puede ir un día por detrás (el
 * 20/08/2026 el BCV marcaba 777,4161 y dolarapi 775,3356).
 *
 * Su certificado TLS es inválido, y por eso antes se leía con un navegador
 * entero. Se relaja la verificación SOLO para este host: la tasa es pública y
 * la validamos después contra un rango plausible, así que un man-in-the-middle
 * no puede colar un número absurdo sin que el guardia lo rechace.
 */
export const getPriceBcvOficial = async (): Promise<{
  rate: string;
  source: string;
}> => {
  // Con `node:https` (incluido en Node) en vez de una dependencia nueva: es la
  // única forma de aceptar su certificado inválido SIN tocar la verificación
  // global de TLS del proceso, que afectaría a todas las demás llamadas.
  const https = await import('node:https');
  const html = await new Promise<string>((resolve, reject) => {
    const req = https.get(
      'https://www.bcv.org.ve/',
      { rejectUnauthorized: false, timeout: 12000 },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`BCV respondió ${res.statusCode}`));
          return;
        }
        let cuerpo = '';
        res.setEncoding('utf8');
        res.on('data', (trozo) => (cuerpo += trozo));
        res.on('end', () => resolve(cuerpo));
      },
    );
    req.on('timeout', () => req.destroy(new Error('BCV no respondió en 12s')));
    req.on('error', reject);
  });

  const tasa = parseTasaBcvHtml(html);
  if (tasa === null) {
    throw new Error('No se encontró la tasa en el HTML del BCV');
  }

  return { rate: String(tasa), source: 'bcv.org.ve (oficial)' };
};

/** Agregador genérico de tipos de cambio. Sin API key. */
export const getPriceBcvFromErApi = async (): Promise<{
  rate: string;
  source: string;
}> => {
  const response = await fetch('https://open.er-api.com/v6/latest/USD', {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`er-api respondió ${response.status}`);
  }

  const data = await response.json();
  const ves = data?.rates?.VES;

  if (!ves || isNaN(parseFloat(String(ves)))) {
    throw new Error('er-api sin tasa VES');
  }

  return { rate: String(ves), source: 'open.er-api.com' };
};

export const getPriceBcv = async (): Promise<{
  rate: string;
  source: string;
}> => {
  // Orden: la autoridad primero, después dos agregadores que respondieron en
  // la verificación del 20/08. El scraper con navegador queda de último porque
  // en el servidor no hay Chrome y solo sirve en una máquina de desarrollo.
  const fuentes = [
    getPriceBcvOficial,
    getPriceBcvFromDolarApi,
    getPriceBcvFromErApi,
    getPriceBcvFromAPI,
    getPriceBcvFromScraper,
  ];

  const fallos: string[] = [];
  for (const fuente of fuentes) {
    try {
      const resultado = await fuente();
      if (esTasaConfiable(parseFloat(resultado.rate), resultado.source)) {
        return resultado;
      }
      fallos.push(
        `${resultado.source}: valor no confiable (${resultado.rate})`,
      );
    } catch (error) {
      fallos.push(error instanceof Error ? error.message : String(error));
    }
  }

  // No hay tasa de relleno: fabricar una convierte un fallo de red en dinero
  // mal cobrado (19/08/2026, la caja mostró 50 con la tasa real en 775). Quien
  // llame decide qué hacer sin tasa; el único que puede decidir es una persona.
  throw new Error(
    `Sin tasa BCV, fallaron las ${fuentes.length} fuentes: ${fallos.join(' | ')}`,
  );
};

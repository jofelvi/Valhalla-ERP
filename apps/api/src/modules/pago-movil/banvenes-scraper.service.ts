import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import {
  BanvenezSessionService,
  jsClickByText,
} from '../banvenez/banvenez-session.service';

export interface BankVerificationResult {
  found: boolean;
  referenceNumber: string;
  amountBS: string;
  date: string;
  description: string;
  type: string;
  balance: string;
  amountMatches: boolean;
  errorMessage?: string;
}

interface EvalRowArgs {
  ref: string;
  // Últimos 8 dígitos de la referencia: el nº de operación del comprobante del
  // EMISOR casi nunca es igual a la referencia que registra el banco RECEPTOR,
  // pero los últimos dígitos sí coinciden (caso real 30/07: comprobante
  // 006837519339 vs banco 0677237519339 → sufijo común 37519339).
  suffix: string;
  expected: number;
}

interface EvalRowResult {
  found: boolean;
  referenceNumber: string;
  amountBS: string;
  date: string;
  description: string;
  type: string;
  balance: string;
  amountMatches: boolean;
}

@Injectable()
export class BanvenesScrapeService {
  private readonly logger = new Logger(BanvenesScrapeService.name);

  constructor(private readonly session: BanvenezSessionService) {}

  async verifyTransaction(
    referenceNumber: string,
    expectedAmountBS: number,
  ): Promise<BankVerificationResult> {
    try {
      return await this.session.withSession(
        async (page) => {
          await this.navigateToMovimientos(page);
          return this.searchAndVerify(page, referenceNumber, expectedAmountBS);
        },
        { blockAssets: true },
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error verificando referencia ${referenceNumber}: ${msg}`,
      );
      return this.emptyResult(referenceNumber, msg);
    }
  }

  private emptyResult(
    referenceNumber: string,
    errorMessage?: string,
  ): BankVerificationResult {
    return {
      found: false,
      referenceNumber,
      amountBS: '',
      date: '',
      description: '',
      type: '',
      balance: '',
      amountMatches: false,
      errorMessage,
    };
  }

  private async navigateToMovimientos(page: Page): Promise<void> {
    // Clic en menú "Consultas"
    await jsClickByText(page, ['Consultas']);
    await page.waitForTimeout(1000);

    // Clic en "Movimientos en línea" — búsqueda case-insensitive para cubrir variantes de tilde/mayúscula
    const clicked = await page.evaluate((): boolean => {
      const byAriaLabel = document.querySelector<HTMLButtonElement>(
        'button[aria-label*="movimientos"]',
      );
      if (byAriaLabel) {
        byAriaLabel.click();
        return true;
      }

      const byRouterLink = document.querySelector<HTMLButtonElement>(
        'button[routerlink="/main/movimientos-cuenta-enlinea"]',
      );
      if (byRouterLink) {
        byRouterLink.click();
        return true;
      }

      // Texto case-insensitive: cubre "Movimientos en línea", "Movimientos en Línea", etc.
      const byText = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button'),
      ).find((b) => b.textContent?.toLowerCase().includes('movimientos en l'));
      if (byText) {
        byText.click();
        return true;
      }

      return false;
    });

    if (!clicked) {
      throw new Error('No se encontró el botón "Movimientos en línea"');
    }

    // Seleccionar la cuenta receptora de Pago Móvil (terminada en 9486)
    await page.waitForTimeout(2000);
    await page.waitForSelector('mat-select', { state: 'visible' });

    // Usar Playwright locator API para interact correctamente con Angular Material
    const matSelect = page.locator('mat-select').first();
    await matSelect.click();
    await page.waitForTimeout(800);

    await page.waitForSelector('mat-option', { state: 'visible' });
    // Intentar seleccionar cuenta 9486; si no existe, usar la primera opción
    const opt9486 = page.locator('mat-option', { hasText: '9486' });
    const optCount = await opt9486.count();
    const allOpts = await page.locator('mat-option').allTextContents();
    this.logger.log(`Cuentas disponibles: ${JSON.stringify(allOpts)}`);
    if (optCount > 0) {
      await opt9486.first().click();
      this.logger.log('Cuenta 9486 seleccionada');
    } else {
      await page.locator('mat-option').first().click();
      this.logger.warn(
        'Cuenta 9486 no encontrada, seleccionando primera opción',
      );
    }
    await page.waitForTimeout(800);

    // Log estado del formulario antes de radio
    const formBefore = await page.evaluate(() => ({
      radios: Array.from(document.querySelectorAll('mat-radio-button')).map(
        (r) => ({
          text: r.textContent?.trim(),
          checked: r.classList.contains('mat-radio-checked'),
          inputChecked: (
            r.querySelector('input[type="radio"]') as HTMLInputElement
          )?.checked,
        }),
      ),
      desde: (
        document.querySelector('input[placeholder="Desde"]') as HTMLInputElement
      )?.value,
      hasta: (
        document.querySelector('input[placeholder="Hasta"]') as HTMLInputElement
      )?.value,
    }));
    this.logger.log(
      `Estado antes de radio click: ${JSON.stringify(formBefore)}`,
    );

    // Seleccionar "Últimos 7 días" con Playwright locator (dispara eventos Angular correctamente)
    const radio7dias = page.locator('mat-radio-button', { hasText: '7' });
    const radio7count = await radio7dias.count();
    if (radio7count > 0) {
      await radio7dias.first().click();
      await page.waitForTimeout(600);

      // Verificar que el radio quedó seleccionado
      const isSelected = await page.evaluate(() => {
        const radios = Array.from(
          document.querySelectorAll('mat-radio-button'),
        );
        const r7 = radios.find((r) => r.textContent?.includes('7'));
        return (
          r7?.classList.contains('mat-radio-checked') ||
          (r7?.querySelector('input[type="radio"]') as HTMLInputElement)
            ?.checked
        );
      });

      if (!isSelected) {
        // Fallback: click input interno y disparar evento change
        this.logger.warn(
          'Radio no seleccionado con locator, intentando click en input interno',
        );
        await page.evaluate(() => {
          const radios = Array.from(
            document.querySelectorAll<HTMLElement>('mat-radio-button'),
          );
          const r = radios.find((r) => r.textContent?.includes('7'));
          const input = r?.querySelector<HTMLInputElement>(
            'input[type="radio"]',
          );
          if (input) {
            input.click();
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        await page.waitForTimeout(600);
      }

      this.logger.log('Radio "Últimos 7 días" procesado');
    } else {
      this.logger.warn(
        'Radio "Últimos 7 días" no encontrado, usando período por defecto',
      );
    }

    // Log estado del formulario tras radio
    const formAfter = await page.evaluate(() => ({
      radios: Array.from(document.querySelectorAll('mat-radio-button')).map(
        (r) => ({
          text: r.textContent?.trim(),
          checked: r.classList.contains('mat-radio-checked'),
        }),
      ),
      desde: (
        document.querySelector('input[placeholder="Desde"]') as HTMLInputElement
      )?.value,
      hasta: (
        document.querySelector('input[placeholder="Hasta"]') as HTMLInputElement
      )?.value,
    }));
    this.logger.log(`Estado tras radio click: ${JSON.stringify(formAfter)}`);

    // Clic en "Procesar"
    await jsClickByText(page, ['Procesar']);

    // Esperar activamente hasta que la tabla cargue O aparezca el mensaje "NO HAY"
    await page.waitForFunction(
      () =>
        !!document.querySelector('input[placeholder="Buscar"]') ||
        document.body.innerText.includes('NO HAY'),
      { timeout: 30_000 },
    );
    this.logger.log('Navegación a Movimientos en línea completada');
  }

  private async searchAndVerify(
    page: Page,
    referenceNumber: string,
    expectedAmountBS: number,
  ): Promise<BankVerificationResult> {
    const searchSelector = 'input[placeholder="Buscar"]';

    // Si no hay transacciones el banco muestra "NO HAY" y el input de búsqueda no existe
    const searchVisible = await page.$(searchSelector);
    if (!searchVisible) {
      this.logger.warn(
        `Ref ${referenceNumber}: sin transacciones en los últimos 7 días (NO HAY)`,
      );

      return this.emptyResult(
        referenceNumber,
        'Sin transacciones en el período',
      );
    }

    // Buscar por el SUFIJO (últimos 8 dígitos): el filtro del banco es
    // "contiene", así que encuentra tanto la referencia exacta como la del
    // receptor cuando difiere del nº de operación del comprobante.
    const suffix = this.refSuffix(referenceNumber);
    await page.fill(searchSelector, suffix || referenceNumber);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const row = await page.evaluate(this.evalRowsFn(), {
      ref: referenceNumber,
      suffix,
      expected: expectedAmountBS,
    } satisfies EvalRowArgs);

    this.logRowResult(referenceNumber, row);
    return row;
  }

  /**
   * Verifica múltiples referencias en UNA sola sesión del browser.
   * Login una vez → navega a Movimientos una vez → busca cada ref (~2s c/u) → logout.
   * Mucho más eficiente que verifyTransaction() por cada ref (evita ~40s de login/navigate por ref).
   */
  async verifyBatch(
    entries: Array<{ referenceNumber: string; expectedAmountBS: number }>,
  ): Promise<Map<string, BankVerificationResult>> {
    const results = new Map<string, BankVerificationResult>();
    if (!entries.length) return results;

    try {
      await this.session.withSession(
        async (page) => {
          await this.navigateToMovimientos(page);

          for (const entry of entries) {
            try {
              const result = await this.searchOneRef(
                page,
                entry.referenceNumber,
                entry.expectedAmountBS,
              );
              results.set(entry.referenceNumber, result);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              this.logger.error(
                `verifyBatch: error en ref ${entry.referenceNumber}: ${msg}`,
              );
              results.set(
                entry.referenceNumber,
                this.emptyResult(entry.referenceNumber, msg),
              );
            }
          }
        },
        { blockAssets: true },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`verifyBatch fallo general: ${msg}`);
      for (const e of entries) {
        if (!results.has(e.referenceNumber)) {
          results.set(
            e.referenceNumber,
            this.emptyResult(e.referenceNumber, msg),
          );
        }
      }
    }

    return results;
  }

  // Busca UNA referencia sobre la página de Movimientos ya cargada.
  // No hace login/logout — reutiliza la sesión activa (para uso en verifyBatch).
  private async searchOneRef(
    page: Page,
    referenceNumber: string,
    expectedAmountBS: number,
  ): Promise<BankVerificationResult> {
    const searchSelector = 'input[placeholder="Buscar"]';

    const searchInput = await page.$(searchSelector);
    if (!searchInput) {
      return this.emptyResult(
        referenceNumber,
        'Sin transacciones en el período',
      );
    }

    // Limpiar búsqueda anterior antes de escribir la nueva ref
    await page.fill(searchSelector, '');
    await page.waitForTimeout(400);
    const suffix = this.refSuffix(referenceNumber);
    await page.fill(searchSelector, suffix || referenceNumber);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);

    const row = await page.evaluate(this.evalRowsFn(), {
      ref: referenceNumber,
      suffix,
      expected: expectedAmountBS,
    } satisfies EvalRowArgs);

    this.logRowResult(referenceNumber, row);

    return row;
  }

  // Últimos 8 dígitos de la referencia (o todos si tiene menos).
  private refSuffix(referenceNumber: string): string {
    const digits = referenceNumber.replace(/\D/g, '');
    return digits.length > 8 ? digits.slice(-8) : digits;
  }

  // Matching sobre las filas de movimientos del banco:
  // 1) referencia exacta → found (amountMatches según el monto), como siempre.
  // 2) fallback: la fila termina en el mismo sufijo de 8 dígitos Y el monto
  //    cuadra (±2 Bs) → found. Cubre el caso emisor≠receptor: el comprobante
  //    del cliente trae el nº de operación del banco EMISOR, que difiere de la
  //    referencia del banco RECEPTOR salvo en los últimos dígitos.
  private evalRowsFn(): (args: EvalRowArgs) => EvalRowResult {
    return (args: EvalRowArgs): EvalRowResult => {
      const rows = document.querySelectorAll('mat-row');
      const empty: EvalRowResult = {
        found: false,
        referenceNumber: args.ref,
        amountBS: '',
        date: '',
        description: '',
        type: '',
        balance: '',
        amountMatches: false,
      };
      if (rows.length === 0) return empty;

      let fuzzy: EvalRowResult | null = null;
      for (const matRow of rows) {
        const cells = matRow.querySelectorAll('mat-cell');
        if (cells.length < 6) continue;
        const fecha = cells[0]?.textContent?.trim() ?? '';
        const referencia = cells[1]?.textContent?.trim() ?? '';
        const descripcion = cells[2]?.textContent?.trim() ?? '';
        const tipo = cells[3]?.textContent?.trim() ?? '';
        const monto = cells[4]?.textContent?.trim() ?? '';
        const saldo = cells[5]?.textContent?.trim() ?? '';

        // Formato venezolano: "3.650,00" → 3650.00
        const parsed = parseFloat(monto.replace(/\./g, '').replace(',', '.'));
        const diff = Math.abs(parsed - args.expected);
        const result: EvalRowResult = {
          found: true,
          referenceNumber: referencia,
          amountBS: monto,
          date: fecha,
          description: descripcion,
          type: tipo,
          balance: saldo,
          amountMatches: diff < 2,
        };

        if (referencia.includes(args.ref)) return result;

        const refDigits = referencia.replace(/\D/g, '');
        if (
          !fuzzy &&
          args.suffix &&
          refDigits.endsWith(args.suffix) &&
          diff < 2
        ) {
          fuzzy = result;
        }
      }
      return fuzzy ?? empty;
    };
  }

  private logRowResult(referenceNumber: string, row: EvalRowResult): void {
    if (row.found) {
      const porSufijo = !row.referenceNumber.includes(referenceNumber);
      this.logger.log(
        `Ref ${referenceNumber}: ${
          row.amountMatches
            ? `VERIFICADA ✓${porSufijo ? ` (por sufijo+monto — ref del banco: ${row.referenceNumber})` : ''}`
            : `monto no coincide (banco: ${row.amountBS})`
        }`,
      );
    } else {
      this.logger.warn(`Ref ${referenceNumber} no encontrada en el banco`);
    }
  }
}

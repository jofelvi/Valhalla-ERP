import type { BankVerificationResult } from './banvenes-scraper.service';
import { PagoMovilService } from './pago-movil.service';

/**
 * Aviso al mesonero cuando el banco confirma un Pago Movil. Se prueba
 * `flushQueue` (privado, accedido por corchetes) con dependencias simuladas.
 */

const ORDER_ID = '65f1a2b3c4d5e6f7a8b9c0d1';
const SHORT_ID = 'A8B9C0D1';

interface PmDocMock {
  _id: string;
  orderId: string;
  referenceNumber: string;
  status: string;
  expectedAmountBS: number;
  expectedAmountUSD: number;
}

function pmDoc(ref: string, status: string, usd: number): PmDocMock {
  return {
    _id: `pm-${ref}`,
    orderId: ORDER_ID,
    referenceNumber: ref,
    status,
    expectedAmountBS: usd * 40,
    expectedAmountUSD: usd,
  };
}

interface OrderMock {
  _id: string;
  waiterId?: string;
  waiterShares?: Array<{ waiterId: string }>;
}

function build(opts: {
  order: OrderMock | null;
  scraper: Map<string, BankVerificationResult>;
  sendToUsers?: jest.Mock;
}) {
  const sendToUsers = opts.sendToUsers ?? jest.fn().mockResolvedValue(1);
  const pagoMovilModel = {
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
  };
  const orderModel = {
    findOne: jest.fn().mockImplementation(() => ({
      lean: () => ({ exec: () => Promise.resolve(opts.order) }),
    })),
  };
  const posGateway = { notifyOrderUpdated: jest.fn() };
  const scraper = {
    verifyBatch: jest.fn().mockResolvedValue(opts.scraper),
  };
  const configs = {
    obtener: jest.fn().mockResolvedValue({ bankReconciliation: true }),
  };
  const configService = { get: jest.fn().mockReturnValue('false') };
  const push = { sendToUsers };

  const service = new PagoMovilService(
    pagoMovilModel as never,
    orderModel as never,
    {} as never,
    {} as never,
    {} as never,
    scraper as never,
    posGateway as never,
    configService as never,
    configs as never,
    push as never,
  );
  return { service, sendToUsers, posGateway, pagoMovilModel };
}

/** Encola refs como lo hace reserveAndAutoVerify y deja correr el flush. */
async function encolarYProcesar(
  service: PagoMovilService,
  refs: PmDocMock[],
): Promise<void> {
  for (const pm of refs) {
    service['queue'].set(pm.referenceNumber, {
      orderId: pm.orderId,
      orderSnapshot: {} as never,
      pmDoc: pm as never,
    });
  }
  await service['flushQueue']();
  // El aviso es fire-and-forget: se deja correr la cola de microtareas.
  await new Promise((resolve) => setImmediate(resolve));
}

describe('PagoMovilService - aviso al mesonero', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('avisa una vez a mesonero y compartidos cuando todas las refs quedan verificadas', async () => {
    const scraper = new Map<string, BankVerificationResult>([
      ['111', { found: true, amountMatches: true } as BankVerificationResult],
      ['222', { found: true, amountMatches: true } as BankVerificationResult],
    ]);
    const { service, sendToUsers } = build({
      order: {
        _id: ORDER_ID,
        waiterId: 'mesonero-1',
        waiterShares: [{ waiterId: 'mesonero-2' }, { waiterId: 'mesonero-1' }],
      },
      scraper,
    });

    await encolarYProcesar(service, [
      pmDoc('111', 'pending', 10),
      pmDoc('222', 'pending', 2.5),
    ]);

    expect(sendToUsers).toHaveBeenCalledTimes(1);
    const [userIds, payload] = sendToUsers.mock.calls[0] as [
      string[],
      { title: string; body: string; data: Record<string, string> },
    ];
    expect(userIds.sort()).toEqual(['mesonero-1', 'mesonero-2']);
    expect(payload.title).toBe('Pago movil confirmado');
    expect(payload.body).toBe(
      `Orden #${SHORT_ID} · $12.50 verificado en el banco`,
    );
    expect(payload.data).toEqual({
      type: 'pago-movil-confirmed',
      orderId: ORDER_ID,
    });
  });

  it('no avisa cuando una referencia no se encuentra en el banco', async () => {
    const scraper = new Map<string, BankVerificationResult>([
      ['111', { found: true, amountMatches: true } as BankVerificationResult],
      ['222', { found: false, amountMatches: false } as BankVerificationResult],
    ]);
    const { service, sendToUsers, posGateway } = build({
      order: { _id: ORDER_ID, waiterId: 'mesonero-1' },
      scraper,
    });

    await encolarYProcesar(service, [
      pmDoc('111', 'pending', 10),
      pmDoc('222', 'pending', 2.5),
    ]);

    expect(sendToUsers).not.toHaveBeenCalled();
    // La verificacion sigue su curso normal: la orden se notifica por POS.
    expect(posGateway.notifyOrderUpdated).toHaveBeenCalledTimes(1);
  });

  it('no avisa de nuevo si las refs ya estaban verificadas antes del flush', async () => {
    const { service, sendToUsers } = build({
      order: { _id: ORDER_ID, waiterId: 'mesonero-1' },
      scraper: new Map(),
    });

    await encolarYProcesar(service, [
      pmDoc('111', 'verified', 10),
      pmDoc('222', 'verified', 2.5),
    ]);

    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('un fallo del push no rompe la verificacion ni la notificacion por POS', async () => {
    const scraper = new Map<string, BankVerificationResult>([
      ['111', { found: true, amountMatches: true } as BankVerificationResult],
    ]);
    const sendToUsers = jest.fn().mockRejectedValue(new Error('FCM caido'));
    const { service, pagoMovilModel, posGateway } = build({
      order: { _id: ORDER_ID, waiterId: 'mesonero-1' },
      scraper,
      sendToUsers,
    });

    await expect(
      encolarYProcesar(service, [pmDoc('111', 'pending', 10)]),
    ).resolves.toBeUndefined();

    expect(sendToUsers).toHaveBeenCalledTimes(1);
    expect(pagoMovilModel.findOneAndUpdate).toHaveBeenCalled();
    expect(posGateway.notifyOrderUpdated).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});

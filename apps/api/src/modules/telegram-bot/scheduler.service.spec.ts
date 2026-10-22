import { OPERACION_DEFAULT } from '@odin6/types';
import { SchedulerService } from './scheduler.service';

/** Coleccion en memoria: insertOne revienta con clave duplicada (E11000), como Mongo real. */
function fakeConnection() {
  const store = new Map<string, { _id: string; sentAt: Date }>();
  const insertOne = jest.fn(async (doc: { _id: string; sentAt: Date }) => {
    if (store.has(doc._id))
      throw Object.assign(new Error('E11000 duplicate key error'), {
        code: 11000,
      });
    store.set(doc._id, doc);
    return { acknowledged: true, insertedId: doc._id };
  });
  return { connection: { collection: () => ({ insertOne }) }, insertOne };
}

function servicio(
  connection: unknown,
  enviarHtml: jest.Mock,
  dailySummaryHourVe: number | null = 23,
  pdf: { enviarDocumento?: jest.Mock; generar?: jest.Mock } = {},
) {
  const enviarDocumento =
    pdf.enviarDocumento ?? jest.fn().mockResolvedValue(undefined);
  const generar =
    pdf.generar ?? jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake'));
  return new SchedulerService(
    connection as never,
    {
      leer: async () => ({
        allowed: [],
        groupChatId: 999,
        reportChatIds: [111],
        weeklyReportHourVe: 8,
        dailySummaryHourVe,
      }),
    } as never,
    { api: () => ({}) as never, enviarHtml, enviarDocumento } as never,
    { publicarTexto: jest.fn().mockResolvedValue(undefined) } as never,
    {
      semana: jest.fn().mockResolvedValue({ gastos: [] }),
      hoy: jest.fn().mockResolvedValue({ gastos: [] }),
      textoTelegram: jest.fn().mockReturnValue(['texto del informe']),
    } as never,
    { generar, nombreArchivo: () => 'informe-2026-09-01.pdf' } as never,
    {
      obtener: async (id: string) =>
        id === 'operacion' ? OPERACION_DEFAULT : { telegramBot: true },
    } as never,
  );
}

// lunes 7 sep 2026 08:10 VE = 12:10Z, misma hora usada en scheduler.helper.spec.ts
const now = new Date('2026-09-07T12:10:00.000Z');

describe('SchedulerService.tick', () => {
  it('un mismo informe semanal no se manda dos veces aunque el tick corra otra vez a la misma hora', async () => {
    const { connection } = fakeConnection();
    const enviarHtml = jest.fn().mockResolvedValue(undefined);
    const service = servicio(connection, enviarHtml);

    await service.tick(now);
    await service.tick(now);

    expect(enviarHtml).toHaveBeenCalledTimes(1);
    expect(enviarHtml).toHaveBeenCalledWith(111, 'texto del informe');
  });

  it('el informe semanal lleva el PDF adjunto, despues del texto', async () => {
    const { connection } = fakeConnection();
    const enviarHtml = jest.fn().mockResolvedValue(undefined);
    const enviarDocumento = jest.fn().mockResolvedValue(undefined);
    const service = servicio(connection, enviarHtml, 23, { enviarDocumento });

    await service.tick(now);

    expect(enviarDocumento).toHaveBeenCalledTimes(1);
    expect(enviarDocumento).toHaveBeenCalledWith(
      111,
      expect.any(Buffer),
      'informe-2026-09-01.pdf',
    );
    expect(enviarHtml.mock.invocationCallOrder[0]).toBeLessThan(
      enviarDocumento.mock.invocationCallOrder[0],
    );
  });

  it('si chromium revienta el informe de texto sale igual: el PDF es un extra', async () => {
    const { connection } = fakeConnection();
    const enviarHtml = jest.fn().mockResolvedValue(undefined);
    const enviarDocumento = jest.fn().mockResolvedValue(undefined);
    const generar = jest
      .fn()
      .mockRejectedValue(new Error('chromium no arranco'));
    const service = servicio(connection, enviarHtml, 23, {
      enviarDocumento,
      generar,
    });

    await expect(service.tick(now)).resolves.toBeUndefined();

    expect(enviarHtml).toHaveBeenCalledWith(111, 'texto del informe');
    expect(enviarDocumento).not.toHaveBeenCalled();
  });

  it('si el adjunto no se puede enviar, el informe igual queda marcado como enviado', async () => {
    const { connection } = fakeConnection();
    const enviarHtml = jest.fn().mockResolvedValue(undefined);
    const enviarDocumento = jest
      .fn()
      .mockRejectedValue(new Error('Telegram dijo que no'));
    const service = servicio(connection, enviarHtml, 23, { enviarDocumento });

    await expect(service.tick(now)).resolves.toBeUndefined();
    await service.tick(now);

    expect(enviarHtml).toHaveBeenCalledTimes(1);
  });

  it('clave duplicada (E11000) al reservar se toma como "ya enviado": no manda nada y no revienta', async () => {
    const insertOne = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('E11000 duplicate key error'), { code: 11000 }),
      );
    const enviarHtml = jest.fn().mockResolvedValue(undefined);
    const service = servicio({ collection: () => ({ insertOne }) }, enviarHtml);

    await expect(service.tick(now)).resolves.toBeUndefined();
    expect(enviarHtml).not.toHaveBeenCalled();
  });

  it('un error real al reservar (no duplicado) no se confunde con "ya enviado": no manda, tick no revienta, y el siguiente tick reintenta solo', async () => {
    const insertOne = jest
      .fn()
      .mockRejectedValueOnce(new Error('conexion perdida'))
      .mockResolvedValueOnce({
        acknowledged: true,
        insertedId: 'weekly:2026-09-07',
      });
    const enviarHtml = jest.fn().mockResolvedValue(undefined);
    const service = servicio({ collection: () => ({ insertOne }) }, enviarHtml);

    // Primer tick: el insert de la marca falla por un error generico (no E11000).
    // tick() no debe relanzar -- el catch por informe lo absorbe -- pero tampoco
    // debe mandar nada, porque no quedo marca escrita.
    await expect(service.tick(now)).resolves.toBeUndefined();
    expect(enviarHtml).not.toHaveBeenCalled();

    // Segundo tick: el insert ahora si resuelve (sin marca previa, no hubo duplicado real).
    await service.tick(now);
    expect(enviarHtml).toHaveBeenCalledTimes(1);
  });
});

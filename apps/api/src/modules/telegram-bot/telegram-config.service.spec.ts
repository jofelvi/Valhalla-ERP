import { TelegramConfigService } from './telegram-config.service';
import { ConfigsService } from '../configs/configs.service';

function conDoc(doc: Record<string, unknown> | null, falla = false) {
  const findOne = falla
    ? jest.fn().mockRejectedValue(new Error('mongo caido'))
    : jest.fn().mockResolvedValue(doc);
  const connection = { collection: () => ({ findOne }) };
  return new TelegramConfigService(new ConfigsService(connection as never));
}

describe('TelegramConfigService', () => {
  it('sin documento: nadie autorizado, sin grupo, horas por defecto', async () => {
    const cfg = await conDoc(null).leer();
    expect(cfg).toEqual({
      allowed: [],
      groupChatId: null,
      reportChatIds: [],
      weeklyReportHourVe: 8,
      weeklyReportMinuteVe: 0,
      dailySummaryHourVe: 23,
    });
  });

  it('lee el documento y deriva reportChatIds del grupo si no vienen', async () => {
    const cfg = await conDoc({
      allowed: [
        { telegramId: 7, socio: 'Jonathan', userId: 'u1' },
        { telegramId: 'x', socio: 'malo' },
      ],
      groupChatId: -100,
      dailySummaryHourVe: null,
    }).leer();
    expect(cfg.allowed).toEqual([
      { telegramId: 7, socio: 'Jonathan', userId: 'u1' },
    ]);
    expect(cfg.reportChatIds).toEqual([-100]);
    expect(cfg.dailySummaryHourVe).toBeNull();
  });

  it('si Mongo falla devuelve defaults y no lanza', async () => {
    await expect(conDoc(null, true).leer()).resolves.toEqual(
      expect.objectContaining({ allowed: [] }),
    );
  });

  it('socioDe encuentra por telegramId y devuelve null si no esta', async () => {
    const s = conDoc({ allowed: [{ telegramId: 7, socio: 'Jonathan' }] });
    expect(await s.socioDe(7)).toEqual({
      telegramId: 7,
      socio: 'Jonathan',
      userId: undefined,
    });
    expect(await s.socioDe(8)).toBeNull();
  });
});

import { ExchangeService } from './exchange.service';

const respuestaDe = (promedio: unknown) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ promedio }),
  }) as unknown as Response;

describe('ExchangeService.getBcvRate', () => {
  const fetchOriginal = global.fetch;
  let fetchFalso: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.parse('2026-09-27T12:00:00Z') });
    fetchFalso = jest.fn();
    global.fetch = fetchFalso as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = fetchOriginal;
  });

  it('dentro de 10 minutos no vuelve a salir a la fuente', async () => {
    fetchFalso.mockResolvedValue(respuestaDe(170.5));
    const s = new ExchangeService();

    await s.getBcvRate();
    jest.advanceTimersByTime(9 * 60 * 1000);
    const r = await s.getBcvRate();

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(r.rate).toBe(170.5);
  });

  it('vencida, vuelve a pedirla', async () => {
    fetchFalso
      .mockResolvedValueOnce(respuestaDe(170.5))
      .mockResolvedValueOnce(respuestaDe(171));
    const s = new ExchangeService();

    await s.getBcvRate();
    jest.advanceTimersByTime(11 * 60 * 1000);
    const r = await s.getBcvRate();

    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(r.rate).toBe(171);
  });

  it('si la fuente falla sigue con la ultima tasa real, no con 50', async () => {
    fetchFalso
      .mockResolvedValueOnce(respuestaDe(170.5))
      .mockRejectedValueOnce(new Error('timeout'));
    const s = new ExchangeService();

    await s.getBcvRate();
    jest.advanceTimersByTime(11 * 60 * 1000);
    const r = await s.getBcvRate();

    expect(r).toMatchObject({ rate: 170.5, source: 'dolarapi.com' });
  });

  it('una tasa absurda de la fuente cuenta como falla', async () => {
    fetchFalso
      .mockResolvedValueOnce(respuestaDe(170.5))
      .mockResolvedValueOnce(respuestaDe(null));
    const s = new ExchangeService();

    await s.getBcvRate();
    jest.advanceTimersByTime(11 * 60 * 1000);

    expect((await s.getBcvRate()).rate).toBe(170.5);
  });

  it('sin ninguna tasa buena desde que arranco, usa el respaldo', async () => {
    fetchFalso.mockRejectedValue(new Error('sin red'));

    const r = await new ExchangeService().getBcvRate();

    expect(r).toMatchObject({ rate: 50, source: 'fallback' });
  });
});

import { DeepseekService } from './deepseek.service';

describe('DeepseekService', () => {
  let service: DeepseekService;
  const originalFetch = global.fetch;
  const originalEnv = process.env.DEEPSEEK_API_KEY;

  beforeEach(() => {
    service = new DeepseekService();
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    if (originalEnv) {
      process.env.DEEPSEEK_API_KEY = originalEnv;
    }
    global.fetch = originalFetch;
  });

  it('complete: sin DEEPSEEK_API_KEY devuelve error sin llamar fetch', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const mockFetch = jest.fn();
    global.fetch = mockFetch as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({
      text: null,
      error: 'DEEPSEEK_API_KEY no configurada',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('complete: respuesta 200 con choices[0].message.content retorna text', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Generated text response',
            },
          },
        ],
      }),
    } as unknown as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({ text: 'Generated text response' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
      }),
    );
  });

  it('complete: status != 200 retorna error', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const mockResponse = {
      ok: false,
      status: 401,
    } as unknown as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({
      text: null,
      error: 'DeepSeek respondió 401',
    });
  });

  it('complete: fetch throw retorna error con mensaje', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const fetchError = new Error('Network error');
    global.fetch = jest.fn().mockRejectedValue(fetchError) as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({
      text: null,
      error: 'Network error',
    });
  });

  it('complete: respuesta sin choices retorna error', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({
      text: null,
      error: 'Respuesta sin contenido',
    });
  });

  it('complete: timeout con AbortError retorna mensaje en español', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    let capturedSignal: AbortSignal | undefined;

    const abortError = new Error('Timeout aborted');
    abortError.name = 'AbortError';

    global.fetch = jest
      .fn()
      .mockImplementation((_url: string, options: Record<string, unknown>) => {
        capturedSignal = options.signal as AbortSignal;
        return Promise.reject(abortError);
      }) as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({
      text: null,
      error: 'Timeout de DeepSeek (30s)',
    });
    expect(capturedSignal).toBeDefined();
  });

  it('complete: payload contiene systemPrompt y userPrompt correctamente', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
      }),
    } as unknown as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as jest.Mock;

    await service.complete('system prompt', 'user prompt');

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body as string);

    expect(body.messages).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]);
    expect(body.model).toBe('deepseek-chat');
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(1200);
  });

  it('complete: non-Error exception retorna error como string', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    global.fetch = jest.fn().mockRejectedValue('Unknown error') as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({
      text: null,
      error: 'Unknown error',
    });
  });

  it('complete: respuesta con choices pero sin message retorna error', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{}],
      }),
    } as unknown as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({
      text: null,
      error: 'Respuesta sin contenido',
    });
  });

  it('complete: respuesta con message pero sin content retorna error', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: {} }],
      }),
    } as unknown as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({
      text: null,
      error: 'Respuesta sin contenido',
    });
  });

  it('complete: res.json() rechaza retorna error con mensaje', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const mockResponse = {
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('JSON inválido')),
    } as unknown as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as jest.Mock;

    const result = await service.complete('system prompt', 'user prompt');

    expect(result).toEqual({
      text: null,
      error: 'JSON inválido',
    });
  });
});

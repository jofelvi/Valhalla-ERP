import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);

  async complete(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ text: string | null; error?: string }> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { text: null, error: 'DEEPSEEK_API_KEY no configurada' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1200,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        return { text: null, error: `DeepSeek respondió ${res.status}` };
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content ?? null;

      return text ? { text } : { text: null, error: 'Respuesta sin contenido' };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.warn('DeepSeek timeout (30s)');
        return { text: null, error: 'Timeout de DeepSeek (30s)' };
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`DeepSeek falló: ${msg}`);
      return { text: null, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  }
}

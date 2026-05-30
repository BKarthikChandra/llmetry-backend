import OpenAI from 'openai';
import {
  ILlmProvider,
  LlmChatResult,
  LlmMessage,
} from './llm-provider.interface';

export class OpenAiProvider implements ILlmProvider {
  async chat(
    messages: LlmMessage[],
    model: string,
    apiKey: string,
  ): Promise<LlmChatResult> {
    const start = Date.now();
    try {
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;

      return {
        text: response.choices[0]?.message?.content ?? '',
        inputTokens,
        outputTokens,
        totalTokens: response.usage?.total_tokens ?? inputTokens + outputTokens,
        latencyMs: Date.now() - start,
        status: 'success',
        errorMessage: null,
      };
    } catch (err) {
      return {
        text: '',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - start,
        status: 'error',
        errorMessage: (err as Error).message,
      };
    }
  }

  async summarize(
    prompt: string,
    model: string,
    apiKey: string,
  ): Promise<string> {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  }
}

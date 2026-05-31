import OpenAI from 'openai';
import {
  ILlmProvider,
  LlmChatResult,
  LlmMessage,
} from './llm-provider.interface';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

export class DeepSeekProvider implements ILlmProvider {
  async chat(
    messages: LlmMessage[],
    model: string,
    apiKey: string,
  ): Promise<LlmChatResult> {
    const start = Date.now();
    try {
      const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
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

  async chatStream(
    messages: LlmMessage[],
    model: string,
    apiKey: string,
    onChunk: (chunk: string) => void,
  ): Promise<LlmChatResult> {
    const start = Date.now();
    try {
      const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
      const stream = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        stream_options: { include_usage: true },
      });
      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let totalTokens = 0;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
          totalTokens = chunk.usage.total_tokens ?? 0;
        }
      }
      return {
        text: fullText,
        inputTokens,
        outputTokens,
        totalTokens: totalTokens || inputTokens + outputTokens,
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
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  }
}

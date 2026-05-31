import { GoogleGenAI } from '@google/genai';
import {
  ILlmProvider,
  LlmChatResult,
  LlmMessage,
} from './llm-provider.interface';

export class GeminiProvider implements ILlmProvider {
  async chat(
    messages: LlmMessage[],
    model: string,
    apiKey: string,
  ): Promise<LlmChatResult> {
    const start = Date.now();
    try {
      const ai = new GoogleGenAI({ apiKey });
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const result = await ai.models.generateContent({
        model: `models/${model}`,
        contents,
      });
      return {
        text: result.text ?? '',
        inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: result.usageMetadata?.totalTokenCount ?? 0,
        latencyMs: Date.now() - start,
        status: 'success',
        errorMessage: null,
      };
    } catch (err) {
      const raw = (err as Error).message;
      let errorMessage = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error?.message) errorMessage = parsed.error.message;
      } catch {
        /* not JSON — use raw */
      }
      return {
        text: '',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - start,
        status: 'error',
        errorMessage,
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
      const ai = new GoogleGenAI({ apiKey });
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const stream = await ai.models.generateContentStream({
        model: `models/${model}`,
        contents,
      });
      let fullText = '';
      let lastChunk: Record<string, any> | null = null;
      for await (const chunk of stream) {
        lastChunk = chunk;
        const delta: string = (chunk as any).text ?? '';
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
      }
      return {
        text: fullText,
        inputTokens: lastChunk?.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: lastChunk?.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: lastChunk?.usageMetadata?.totalTokenCount ?? 0,
        latencyMs: Date.now() - start,
        status: 'success',
        errorMessage: null,
      };
    } catch (err) {
      const raw = (err as Error).message;
      let errorMessage = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error?.message) errorMessage = parsed.error.message;
      } catch {
        /* not JSON — use raw */
      }
      return {
        text: '',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - start,
        status: 'error',
        errorMessage,
      };
    }
  }

  async summarize(
    prompt: string,
    model: string,
    apiKey: string,
  ): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: `models/${model}`,
      contents: prompt,
    });
    return result.text?.trim() ?? '';
  }
}

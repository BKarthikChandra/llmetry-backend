import Anthropic from '@anthropic-ai/sdk';
import {
  ILlmProvider,
  LlmChatResult,
  LlmMessage,
} from './llm-provider.interface';

export class ClaudeProvider implements ILlmProvider {
  async chat(
    messages: LlmMessage[],
    model: string,
    apiKey: string,
  ): Promise<LlmChatResult> {
    const start = Date.now();
    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

      return {
        text: textBlock?.text ?? '',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
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
      const client = new Anthropic({ apiKey });
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      let fullText = '';
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const delta = event.delta.text;
          fullText += delta;
          onChunk(delta);
        }
      }
      const finalMessage = await stream.finalMessage();
      const inputTokens = finalMessage.usage.input_tokens;
      const outputTokens = finalMessage.usage.output_tokens;
      return {
        text: fullText,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
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
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.text.trim() ?? '';
  }
}

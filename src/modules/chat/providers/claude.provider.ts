import { ILlmProvider, LlmChatResult, LlmMessage } from './llm-provider.interface';

export class ClaudeProvider implements ILlmProvider {
    async chat(_messages: LlmMessage[], _model: string, _apiKey: string): Promise<LlmChatResult> {
        return { text: '', inputTokens: 0, outputTokens: 0, totalTokens: 0, latencyMs: 0, status: 'error', errorMessage: "Provider 'claude' is not yet supported" };
    }

    async summarize(_prompt: string, _model: string, _apiKey: string): Promise<string> {
        throw new Error("Provider 'claude' is not yet supported");
    }
}

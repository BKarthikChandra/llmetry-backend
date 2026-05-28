export interface LlmMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface LlmChatResult {
    text: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
    status: 'success' | 'error';
    errorMessage: string | null;
}

export interface ILlmProvider {
    chat(messages: LlmMessage[], model: string, apiKey: string): Promise<LlmChatResult>;
    summarize(prompt: string, model: string, apiKey: string): Promise<string>;
}

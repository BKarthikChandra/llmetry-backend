import { ILlmProvider } from './llm-provider.interface';
import { GeminiProvider } from './gemini.provider';
import { OpenAiProvider } from './openai.provider';
import { ClaudeProvider } from './claude.provider';
import { DeepSeekProvider } from './deepseek.provider';

const registry: Record<string, ILlmProvider> = {
  gemini: new GeminiProvider(),
  openai: new OpenAiProvider(),
  claude: new ClaudeProvider(),
  deepseek: new DeepSeekProvider(),
};

export function getProvider(name: string): ILlmProvider {
  const provider = registry[name];
  if (!provider) throw new Error(`Unknown provider: '${name}'`);
  return provider;
}

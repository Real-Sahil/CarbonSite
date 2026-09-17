// LLM client — NVIDIA NIM only.

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export type LlmResult = { text: string; tokens: number; provider: string };
export type LlmOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  reasoningEffort?: 'low' | 'medium' | 'max';
};

const NIM_API_KEY = process.env.NVIDIA_API_KEY ?? process.env.NVIDIA_NIM_API_KEY ?? '';
const NIM_API_BASE = process.env.NVIDIA_NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const NIM_DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';

async function callNvidiaNim(messages: ChatMessage[], options: LlmOptions): Promise<LlmResult> {
  if (!NIM_API_KEY) throw new Error('NVIDIA_API_KEY not set');

  const response = await fetch(`${NIM_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NIM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model ?? NIM_DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 800,
      temperature: options.temperature ?? 0.3,
      top_p: 0.9,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NVIDIA NIM ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  const tokens = data.usage?.completion_tokens ?? 0;
  return { text: text.trim(), tokens, provider: 'nvidia_nim' };
}

export class LlmClient {
  async chat(messages: ChatMessage[], options: LlmOptions = {}): Promise<LlmResult> {
    return callNvidiaNim(messages, options);
  }

  async complete(prompt: string, options: LlmOptions = {}): Promise<LlmResult> {
    const messages: ChatMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return this.chat(messages, options);
  }

  isConfigured(): boolean {
    return !!NIM_API_KEY;
  }
}

export const llmClient = new LlmClient();

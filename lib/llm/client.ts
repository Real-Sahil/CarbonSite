// Multi-provider LLM client.
// Primary: HuggingFace Inference API (free, 30k requests/month, no self-hosting)
// Fallback: NVIDIA NIM (existing integration, kept as fallback)

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export type LlmResult = { text: string; tokens: number; provider: string };
export type LlmOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
};

const HF_API_KEY = process.env.HUGGINGFACE_TOKEN ?? '';
const HF_API_BASE = 'https://api-inference.huggingface.co/v1';
// Use a freely available instruction-tuned model on HF
const HF_DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY ?? '';
const NIM_API_BASE = process.env.NVIDIA_NIM_BASE_URL ?? 'http://localhost:8000';
const NIM_DEFAULT_MODEL = 'mistral-7b-instruct';

async function callHuggingFace(messages: ChatMessage[], options: LlmOptions): Promise<LlmResult> {
  if (!HF_API_KEY) throw new Error('HUGGINGFACE_TOKEN not set');

  const response = await fetch(`${HF_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model ?? HF_DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 200,
      temperature: options.temperature ?? 0.3,
      top_p: 0.9,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HuggingFace API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  const tokens = data.usage?.completion_tokens ?? 0;
  return { text: text.trim(), tokens, provider: 'huggingface' };
}

async function callNvidiaNim(messages: ChatMessage[], options: LlmOptions): Promise<LlmResult> {
  if (!NIM_API_KEY) throw new Error('NVIDIA_NIM_API_KEY not set');

  const response = await fetch(`${NIM_API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NIM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model ?? NIM_DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 200,
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
  // Try HuggingFace first; fall back to NVIDIA NIM if HF is unconfigured or fails.
  async chat(messages: ChatMessage[], options: LlmOptions = {}): Promise<LlmResult> {
    if (HF_API_KEY) {
      try {
        return await callHuggingFace(messages, options);
      } catch (err) {
        console.warn(
          '[llm] HuggingFace failed, falling back to NVIDIA NIM:',
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (NIM_API_KEY) {
      return callNvidiaNim(messages, options);
    }

    throw new Error(
      'No LLM provider configured. Set HUGGINGFACE_TOKEN or NVIDIA_NIM_API_KEY.',
    );
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
    return !!(HF_API_KEY || NIM_API_KEY);
  }
}

export const llmClient = new LlmClient();

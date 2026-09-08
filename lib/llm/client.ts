// Multi-provider LLM client.
// Priority: Anthropic Claude (if ANTHROPIC_API_KEY set) → NVIDIA NIM → HuggingFace

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export type LlmResult = { text: string; tokens: number; provider: string };
export type LlmOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
};

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1';
// Haiku: fast, cheap, good enough for structured report narratives
const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const HF_API_KEY = process.env.HUGGINGFACE_TOKEN ?? '';
const HF_API_BASE = 'https://api-inference.huggingface.co/v1';
const HF_DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY ?? '';
const NIM_API_BASE = process.env.NVIDIA_NIM_BASE_URL ?? 'http://localhost:8000';
const NIM_DEFAULT_MODEL = 'mistral-7b-instruct';

async function callAnthropic(messages: ChatMessage[], options: LlmOptions): Promise<LlmResult> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');

  // Anthropic Messages API separates the system prompt from the message array.
  const system = options.systemPrompt ?? messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: options.model ?? ANTHROPIC_DEFAULT_MODEL,
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.3,
    messages: userMessages,
  };
  if (system) body.system = system;

  const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { output_tokens?: number };
  };

  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  if (!text) throw new Error('Anthropic API returned empty content');

  const tokens = data.usage?.output_tokens ?? 0;
  return { text: text.trim(), tokens, provider: 'anthropic' };
}

async function callHuggingFace(messages: ChatMessage[], options: LlmOptions): Promise<LlmResult> {
  if (!HF_API_KEY) {
    const msg = 'HUGGINGFACE_TOKEN is not set. Set HUGGINGFACE_TOKEN in your .env file. Get it from: https://huggingface.co/settings/tokens';
    console.error(`[llm] ${msg}`);
    throw new Error(msg);
  }

  try {
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
      const errorMsg = `HuggingFace API error ${response.status}: ${body.slice(0, 200)}`;
      console.error(`[llm] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { completion_tokens?: number };
    };

    if (!data.choices || data.choices.length === 0) {
      throw new Error('HuggingFace API returned empty choices');
    }

    const text = data.choices[0]?.message?.content ?? '';
    if (!text) {
      throw new Error('HuggingFace API returned empty message content');
    }

    const tokens = data.usage?.completion_tokens ?? 0;
    return { text: text.trim(), tokens, provider: 'huggingface' };
  } catch (err) {
    console.error('[llm] HuggingFace call failed:', err instanceof Error ? err.message : String(err));
    throw err;
  }
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
  // Try Anthropic first, then NVIDIA NIM, then HuggingFace.
  async chat(messages: ChatMessage[], options: LlmOptions = {}): Promise<LlmResult> {
    if (ANTHROPIC_API_KEY) {
      try {
        return await callAnthropic(messages, options);
      } catch (err) {
        console.warn(
          '[llm] Anthropic failed, falling back to next provider:',
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (NIM_API_KEY) {
      try {
        return await callNvidiaNim(messages, options);
      } catch (err) {
        console.warn(
          '[llm] NVIDIA NIM failed, falling back to HuggingFace:',
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (HF_API_KEY) {
      return callHuggingFace(messages, options);
    }

    throw new Error(
      'No LLM provider configured. Set ANTHROPIC_API_KEY, NVIDIA_NIM_API_KEY, or HUGGINGFACE_TOKEN.',
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
    return !!(ANTHROPIC_API_KEY || HF_API_KEY || NIM_API_KEY);
  }
}

export const llmClient = new LlmClient();

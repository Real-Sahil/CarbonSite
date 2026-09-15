// Multi-provider LLM client.
// Priority: Anthropic Claude → NVIDIA NIM (Kimi) → HuggingFace

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export type LlmResult = { text: string; tokens: number; provider: string };
export type LlmOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  // Controls Kimi reasoning depth. 'low' (~3-8s) fits in a Vercel 60s budget;
  // 'max' (~30-60s) is only safe in a long-running worker process.
  reasoningEffort?: 'low' | 'medium' | 'max';
};


const HF_API_KEY = process.env.HUGGINGFACE_TOKEN ?? '';
const HF_API_BASE = 'https://api-inference.huggingface.co/v1';
const HF_DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

// Accept either name; NVIDIA_API_KEY is the standard key name in the Vercel dashboard.
const NIM_API_KEY = process.env.NVIDIA_API_KEY ?? process.env.NVIDIA_NIM_API_KEY ?? '';
// Default to NVIDIA's cloud inference endpoint when not self-hosting.
const NIM_API_BASE = process.env.NVIDIA_NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const NIM_DEFAULT_MODEL = 'meta/llama-3.1-8b-instruct';

// Kimi (moonshotai/kimi-k3) via NVIDIA NIM endpoint. Uses same API key as NIM.
const KIMI_API_KEY = NIM_API_KEY;
const KIMI_API_BASE = NIM_API_BASE;
const KIMI_DEFAULT_MODEL = 'moonshotai/kimi-k3';

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

  const response = await fetch(`${NIM_API_BASE}/chat/completions`, {
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

async function callKimi(messages: ChatMessage[], options: LlmOptions): Promise<LlmResult> {
  if (!KIMI_API_KEY) throw new Error('NVIDIA_API_KEY not set for Kimi');

  const response = await fetch(`${KIMI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KIMI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model ?? KIMI_DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.3,
      reasoning_effort: options.reasoningEffort ?? 'low',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Kimi API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  const tokens = data.usage?.completion_tokens ?? 0;
  return { text: text.trim(), tokens, provider: 'kimi' };
}

export class LlmClient {
  // Try Kimi first, then NVIDIA NIM, then HuggingFace.
  async chat(messages: ChatMessage[], options: LlmOptions = {}): Promise<LlmResult> {
    if (KIMI_API_KEY) {
      try {
        return await callKimi(messages, options);
      } catch (err) {
        console.warn(
          '[llm] Kimi failed, falling back to NIM or next provider:',
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (NIM_API_KEY && options.model !== KIMI_DEFAULT_MODEL) {
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
      'No LLM provider configured. Set NVIDIA_API_KEY or HUGGINGFACE_TOKEN.',
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
    return !!(KIMI_API_KEY || NIM_API_KEY || HF_API_KEY);
  }
}

export const llmClient = new LlmClient();

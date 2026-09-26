// LLM client: Groq first, Mistral as fallback, both through their
// OpenAI-compatible chat endpoints.
//
// Chosen for what happens to customer data on the free tiers:
// - Groq never trains on inputs or outputs (contractual on every tier);
//   turn on Zero Data Retention in its console so nothing is logged.
// - Mistral's free Experiment plan trains on inputs unless the workspace
//   opts out in its Privacy settings; do that before setting the key.
// NVIDIA's hosted NIM trial is not used: its terms exclude production use.
//
// Callers must check the organisation has turned AI assistance on
// (aiAssistEnabled() in ./org-consent) and must never take figures from
// the model: see ./grounding for the check on generated text.

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export type LlmResult = { text: string; tokens: number; provider: string };
export type LlmOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  reasoningEffort?: 'low' | 'medium' | 'max';
  /** Per-provider timeout; the next provider is tried when it expires. */
  timeoutMs?: number;
};

type Provider = { name: string; baseUrl: string; key: () => string; model: string };

const PROVIDERS: Provider[] = [
  {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    key: () => process.env.GROQ_API_KEY ?? '',
    model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  },
  {
    name: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    key: () => process.env.MISTRAL_API_KEY ?? '',
    model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
  },
];

const DEFAULT_TIMEOUT_MS = 15_000;

export function configuredProviders(): string[] {
  return PROVIDERS.filter((p) => p.key()).map((p) => p.name);
}

async function callProvider(p: Provider, messages: ChatMessage[], options: LlmOptions): Promise<LlmResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // A caller's model name is provider-specific; only the default is portable.
        model: p.model,
        messages,
        max_tokens: options.maxTokens ?? 800,
        temperature: options.temperature ?? 0.3,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${p.name} ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { completion_tokens?: number };
    };
    return {
      text: (data.choices?.[0]?.message?.content ?? '').trim(),
      tokens: data.usage?.completion_tokens ?? 0,
      provider: p.name,
    };
  } finally {
    clearTimeout(timer);
  }
}

export class LlmClient {
  /** Tries each configured provider in turn; throws only when all fail. */
  async chat(messages: ChatMessage[], options: LlmOptions = {}): Promise<LlmResult> {
    const providers = PROVIDERS.filter((p) => p.key());
    if (providers.length === 0) throw new Error('No LLM provider configured (set GROQ_API_KEY or MISTRAL_API_KEY)');
    const errors: string[] = [];
    for (const p of providers) {
      try {
        return await callProvider(p, messages, options);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    throw new Error(`All LLM providers failed: ${errors.join(' | ')}`);
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
    return configuredProviders().length > 0;
  }
}

export const llmClient = new LlmClient();

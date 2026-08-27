import axios, { AxiosInstance } from 'axios';

export class NvidiaClient {
  private client: AxiosInstance;
  private apiKey: string;
  private apiBase: string;

  constructor() {
    this.apiKey = process.env.NVIDIA_NIM_API_KEY || '';
    this.apiBase = process.env.NVIDIA_NIM_BASE_URL || 'http://localhost:8000';

    if (!this.apiKey) {
      throw new Error('NVIDIA_NIM_API_KEY environment variable is required');
    }

    this.client = axios.create({
      baseURL: this.apiBase,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async complete(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    } = {},
  ): Promise<{ text: string; tokens: number }> {
    const {
      model = 'mistral-7b-instruct',
      maxTokens = 200,
      temperature = 0.3,
    } = options;

    try {
      const response = await this.client.post('/v1/completions', {
        model,
        prompt,
        max_tokens: maxTokens,
        temperature,
        top_p: 0.9,
      });

      const text = response.data.choices?.[0]?.text || '';
      const tokens = response.data.usage?.completion_tokens || 0;

      return { text: text.trim(), tokens };
    } catch (error) {
      console.error('NVIDIA NIM API error:', error);
      throw new Error(`NVIDIA NIM API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    } = {},
  ): Promise<{ text: string; tokens: number }> {
    const {
      model = 'mistral-7b-instruct',
      maxTokens = 200,
      temperature = 0.3,
    } = options;

    try {
      const response = await this.client.post('/v1/chat/completions', {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        top_p: 0.9,
      });

      const text = response.data.choices?.[0]?.message?.content || '';
      const tokens = response.data.usage?.completion_tokens || 0;

      return { text: text.trim(), tokens };
    } catch (error) {
      console.error('NVIDIA NIM API error:', error);
      throw new Error(
        `NVIDIA NIM API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/models');
      return response.status === 200 && Array.isArray(response.data.data);
    } catch {
      return false;
    }
  }
}

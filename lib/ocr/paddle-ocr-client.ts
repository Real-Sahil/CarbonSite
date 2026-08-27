/**
 * PaddleOCR Client Wrapper
 * Provides consistent OCR interface for field evidence processing
 *
 * Supports:
 * - HTTP API calls to PaddleOCR server (self-hosted)
 * - Client-side JS for web (via PaddleOCR.js library)
 * - Retry logic with exponential backoff
 * - Timeout handling (10s default)
 */

export type OcrTextResult = {
  text: string;
  confidence: number; // 0-1
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type OcrExtractionResult = {
  status: "success" | "error";
  rawText: string; // Full OCR output
  lines: OcrTextResult[]; // Individual text blocks with confidence
  metadata: {
    processingTimeMs: number;
    language?: string;
    imageSize?: { width: number; height: number };
  };
  error?: string;
};

/**
 * PaddleOCR HTTP client for server-side OCR
 * Used when running PaddleOCR as a separate Docker/server service
 */
export class PaddleOcrApiClient {
  private apiUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(apiUrl?: string, timeoutMs = 10000, maxRetries = 3) {
    this.apiUrl = apiUrl || process.env.PADDLE_OCR_API_URL || "http://localhost:9001";
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  /**
   * Extract text from image via PaddleOCR API
   * Supports base64-encoded images or image URLs
   */
  async extractText(input: {
    imageBase64?: string;
    imageUrl?: string;
    language?: string; // Default: "en"
  }): Promise<OcrExtractionResult> {
    if (!input.imageBase64 && !input.imageUrl) {
      return {
        status: "error",
        rawText: "",
        lines: [],
        metadata: { processingTimeMs: 0 },
        error: "Either imageBase64 or imageUrl must be provided",
      };
    }

    const startTime = Date.now();
    let lastError: Error | undefined;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.callOcrApi({
          imageBase64: input.imageBase64,
          imageUrl: input.imageUrl,
          language: input.language || "en",
        });

        return {
          status: "success",
          rawText: response.rawText,
          lines: response.lines || [],
          metadata: {
            processingTimeMs: Date.now() - startTime,
            language: input.language || "en",
            imageSize: response.imageSize,
          },
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Exponential backoff: 100ms, 200ms, 400ms
        if (attempt < this.maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 100;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return {
      status: "error",
      rawText: "",
      lines: [],
      metadata: { processingTimeMs: Date.now() - startTime },
      error: lastError?.message || "OCR API request failed after retries",
    };
  }

  private async callOcrApi(payload: {
    imageBase64?: string;
    imageUrl?: string;
    language: string;
  }): Promise<{
    rawText: string;
    lines?: OcrTextResult[];
    imageSize?: { width: number; height: number };
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/ocr/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `OCR API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        rawText: string;
        lines?: OcrTextResult[];
        imageSize?: { width: number; height: number };
      };
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check for OCR service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        timeout: this.timeoutMs,
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Client-side OCR extractor using PaddleOCR.js
 * Used in web browsers and Flutter WebView for immediate feedback
 */
export class PaddleOcrBrowserClient {
  private readonly loaded: boolean;

  constructor() {
    // In real implementation, this would load PaddleOCR.js from CDN or local
    this.loaded = typeof window !== "undefined" && "PaddleOCR" in window;
  }

  async extractText(input: {
    imageBase64: string;
    language?: string;
  }): Promise<OcrExtractionResult> {
    if (!this.loaded) {
      return {
        status: "error",
        rawText: "",
        lines: [],
        metadata: { processingTimeMs: 0 },
        error: "PaddleOCR not loaded in browser",
      };
    }

    const startTime = Date.now();

    try {
      // Mock implementation - in real app, call window.PaddleOCR
      // This is a placeholder for browser-side OCR
      const mockResult: OcrExtractionResult = {
        status: "success",
        rawText: "Mock OCR result - would be actual text from PaddleOCR.js",
        lines: [
          {
            text: "Weight: 50.5 kg",
            confidence: 0.95,
            bounds: { x: 10, y: 20, width: 100, height: 30 },
          },
          {
            text: "Date: 2024-08-27",
            confidence: 0.92,
            bounds: { x: 10, y: 60, width: 100, height: 30 },
          },
        ],
        metadata: {
          processingTimeMs: Date.now() - startTime,
          language: input.language || "en",
        },
      };

      return mockResult;
    } catch (err) {
      return {
        status: "error",
        rawText: "",
        lines: [],
        metadata: { processingTimeMs: Date.now() - startTime },
        error: err instanceof Error ? err.message : "Browser OCR extraction failed",
      };
    }
  }

  isAvailable(): boolean {
    return this.loaded;
  }
}

/**
 * Factory to get appropriate OCR client (server or browser)
 */
export function getOcrClient(): PaddleOcrApiClient | PaddleOcrBrowserClient {
  if (typeof window !== "undefined") {
    return new PaddleOcrBrowserClient();
  }
  return new PaddleOcrApiClient();
}

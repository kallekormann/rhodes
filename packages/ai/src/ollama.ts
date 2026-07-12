import { OLLAMA_EMBED_MODEL } from "@rhodes/shared/constants";

const EMBED_TIMEOUT_MS = 90_000;
const GENERATE_TIMEOUT_MS = 120_000;

export interface OllamaTagsResponse {
  models: Array<{ name: string; size?: number }>;
}

type OllamaEmbedResponse = {
  embeddings?: number[][];
  embedding?: number[];
};

type OllamaGenerateResponse = {
  response?: string;
};

type OllamaStreamChunk = {
  response?: string;
  done?: boolean;
};

export class OllamaClient {
  constructor(private readonly host: string) {}

  private async fetchWithTimeout(
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.host}${path}`, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async listModels(): Promise<OllamaTagsResponse> {
    const response = await this.fetchWithTimeout("/api/tags", {}, 10_000);
    if (!response.ok) {
      throw new Error(`Ollama listModels failed: ${response.status}`);
    }
    return response.json() as Promise<OllamaTagsResponse>;
  }

  async embed(
    text: string,
    model = OLLAMA_EMBED_MODEL,
  ): Promise<number[]> {
    const [vector] = await this.embedBatch([text], model);
    if (!vector) {
      throw new Error("Ollama embed returned no vector");
    }
    return vector;
  }

  async embedBatch(
    texts: string[],
    model = OLLAMA_EMBED_MODEL,
  ): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.fetchWithTimeout(
      "/api/embed",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: texts }),
      },
      EMBED_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Ollama embed failed: ${response.status}`);
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    if (Array.isArray(data.embeddings)) {
      return data.embeddings;
    }
    if (Array.isArray(data.embedding)) {
      return [data.embedding];
    }

    throw new Error("Ollama embed response missing embeddings");
  }

  async generate(
    prompt: string,
    model: string,
    options?: { temperature?: number },
  ): Promise<string> {
    const response = await this.fetchWithTimeout(
      "/api/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.2,
          },
        }),
      },
      GENERATE_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Ollama generate failed: ${response.status}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    return (data.response ?? "").trim();
  }

  async *streamGenerate(
    prompt: string,
    model: string,
    options?: { temperature?: number },
  ): AsyncGenerator<string> {
    const response = await this.fetchWithTimeout(
      "/api/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.2,
          },
        }),
      },
      GENERATE_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Ollama streamGenerate failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Ollama streamGenerate missing response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const chunk = JSON.parse(trimmed) as OllamaStreamChunk;
        if (chunk.response) {
          yield chunk.response;
        }
      }
    }
  }
}

export function createOllamaClient(host = process.env.OLLAMA_HOST ?? "http://localhost:11434") {
  return new OllamaClient(host.replace(/\/$/, ""));
}

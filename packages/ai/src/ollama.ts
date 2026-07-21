import {
  resolveOllamaEmbedModel,
  resolveOllamaEmbedTimeoutMs,
  resolveOllamaGenerateTimeoutMs,
} from "@rhodes/shared/constants";

const EMBED_TIMEOUT_MS = resolveOllamaEmbedTimeoutMs();
const GENERATE_TIMEOUT_MS = resolveOllamaGenerateTimeoutMs();

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
    externalSignal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onExternalAbort);

    try {
      if (externalSignal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const response = await fetch(`${this.host}${path}`, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (externalSignal?.aborted) {
          throw new Error("Ollama request aborted");
        }
        throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
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
    model = resolveOllamaEmbedModel(),
  ): Promise<number[]> {
    const [vector] = await this.embedBatch([text], model);
    if (!vector) {
      throw new Error("Ollama embed returned no vector");
    }
    return vector;
  }

  async embedBatch(
    texts: string[],
    model = resolveOllamaEmbedModel(),
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
    options?: { temperature?: number; numPredict?: number; timeoutMs?: number },
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
            ...(options?.numPredict != null ? { num_predict: options.numPredict } : {}),
          },
        }),
      },
      options?.timeoutMs ?? GENERATE_TIMEOUT_MS,
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
    options?: {
      temperature?: number;
      signal?: AbortSignal;
      /** Max wait for headers / next body chunk (default: GENERATE_TIMEOUT_MS). */
      idleTimeoutMs?: number;
    },
  ): AsyncGenerator<string> {
    const idleTimeoutMs = options?.idleTimeoutMs ?? GENERATE_TIMEOUT_MS;
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    options?.signal?.addEventListener("abort", onExternalAbort);

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
    };

    try {
      if (options?.signal?.aborted) {
        throw new Error("Ollama request aborted");
      }

      armIdle();
      const response = await fetch(`${this.host}/api/generate`, {
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
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama streamGenerate failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Ollama streamGenerate missing response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          armIdle();
          let readResult: ReadableStreamReadResult<Uint8Array<ArrayBuffer>>;
          try {
            readResult = (await reader.read()) as ReadableStreamReadResult<
              Uint8Array<ArrayBuffer>
            >;
          } catch (error) {
            if (controller.signal.aborted) {
              if (options?.signal?.aborted) {
                throw new Error("Ollama request aborted");
              }
              throw new Error(
                `Ollama stream idle timeout after ${idleTimeoutMs}ms`,
              );
            }
            throw error;
          }

          const { done, value } = readResult;
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
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (options?.signal?.aborted) {
          throw new Error("Ollama request aborted");
        }
        throw new Error(`Ollama stream idle timeout after ${idleTimeoutMs}ms`);
      }
      throw error;
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
      options?.signal?.removeEventListener("abort", onExternalAbort);
    }
  }
}

export function createOllamaClient(host = process.env.OLLAMA_HOST ?? "http://localhost:11434") {
  return new OllamaClient(host.replace(/\/$/, ""));
}

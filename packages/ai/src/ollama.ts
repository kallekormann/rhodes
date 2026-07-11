import { OLLAMA_EMBED_MODEL } from "@rhodes/shared/constants";

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

export class OllamaClient {
  constructor(private readonly host: string) {}

  async listModels(): Promise<OllamaTagsResponse> {
    const response = await fetch(`${this.host}/api/tags`);
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

    const response = await fetch(`${this.host}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: texts }),
    });

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
    const response = await fetch(`${this.host}/api/generate`, {
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
    });

    if (!response.ok) {
      throw new Error(`Ollama generate failed: ${response.status}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    return (data.response ?? "").trim();
  }
}

export function createOllamaClient(host = process.env.OLLAMA_HOST ?? "http://localhost:11434") {
  return new OllamaClient(host.replace(/\/$/, ""));
}

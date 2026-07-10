export interface OllamaTagsResponse {
  models: Array<{ name: string; size?: number }>;
}

export class OllamaClient {
  constructor(private readonly host: string) {}

  async listModels(): Promise<OllamaTagsResponse> {
    const response = await fetch(`${this.host}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama listModels failed: ${response.status}`);
    }
    return response.json() as Promise<OllamaTagsResponse>;
  }

  async embed(_text: string): Promise<number[]> {
    throw new Error("Ollama embed not implemented until Phase 07");
  }
}

export function createOllamaClient(host = process.env.OLLAMA_HOST ?? "http://localhost:11434") {
  return new OllamaClient(host.replace(/\/$/, ""));
}

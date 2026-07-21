export const APP_BASE_PATH = "/app" as const;

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;

export const EMBEDDING_DIMENSIONS = 768 as const;

export const EMBEDDING_MODEL = "nomic-embed-text-v1" as const;

/** Catalog defaults — override per usage via env (see resolveOllama* helpers). */
export const OLLAMA_EMBED_MODEL = "nomic-embed-text" as const;
export const OLLAMA_FAST_MODEL = "llama3.2:3b-instruct-q4_K_M" as const;
export const OLLAMA_CHAT_MODEL = "llama3.2:3b-instruct-q4_K_M" as const;
export const OLLAMA_SUMMARY_MODEL = "llama3.2:3b-instruct-q4_K_M" as const;

function env(): Record<string, string | undefined> | undefined {
  if (typeof globalThis === "undefined" || !("process" in globalThis)) {
    return undefined;
  }
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
}

function readEnv(key: string): string | undefined {
  const raw = env()?.[key]?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

function readEnvModel(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readEnv(key);
    if (value) return value;
  }
  return undefined;
}

function readEnvMs(key: string, fallback: number): number {
  const raw = readEnv(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function readEnvFlag(key: string, fallback = false): boolean {
  const raw = readEnv(key)?.toLowerCase();
  if (raw == null) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Shared default for generate helpers when a usage-specific model is unset.
 * Prefer OLLAMA_DEFAULT_GENERATE_MODEL; OLLAMA_FAST_MODEL still accepted.
 */
function resolveGenerateDefault(): string {
  return (
    readEnvModel("OLLAMA_DEFAULT_GENERATE_MODEL", "OLLAMA_FAST_MODEL") ??
    OLLAMA_FAST_MODEL
  );
}

/** Embeddings for library indexing, Insights, and Ask retrieval. */
export function resolveOllamaEmbedModel(): string {
  return readEnvModel("OLLAMA_EMBED_MODEL") ?? OLLAMA_EMBED_MODEL;
}

export function resolveOllamaEmbedTimeoutMs(): number {
  return readEnvMs("OLLAMA_EMBED_TIMEOUT_MS", 90_000);
}

/** Ask panel answer stream (primary). Alias: OLLAMA_CHAT_MODEL. */
export function resolveOllamaAskModel(): string {
  return (
    readEnvModel("OLLAMA_ASK_MODEL", "OLLAMA_CHAT_MODEL") ??
    OLLAMA_CHAT_MODEL
  );
}

/** Used if Ask primary model is missing (404). Falls back to OLLAMA_DEFAULT_GENERATE_MODEL. */
export function resolveOllamaAskFallbackModel(): string {
  return (
    readEnvModel("OLLAMA_ASK_FALLBACK_MODEL") ??
    resolveGenerateDefault()
  );
}

/**
 * When true, Ask runs LLM rerank before answering (slower on CPU).
 * Prefer OLLAMA_ASK_LLM_RERANK; ASK_LLM_RERANK still accepted.
 */
export function askLlmRerankEnabled(): boolean {
  if (readEnv("OLLAMA_ASK_LLM_RERANK") != null) {
    return readEnvFlag("OLLAMA_ASK_LLM_RERANK", false);
  }
  return readEnvFlag("ASK_LLM_RERANK", false);
}

/** LLM keep/skip rerank during Ask (only if OLLAMA_ASK_LLM_RERANK=1). */
export function resolveOllamaRerankModel(): string {
  return readEnvModel("OLLAMA_RERANK_MODEL") ?? resolveGenerateDefault();
}

/** Rhodes writing-helper suggestions in the editor. */
export function resolveOllamaWritingCoachModel(): string {
  return readEnvModel("OLLAMA_WRITING_COACH_MODEL") ?? resolveGenerateDefault();
}

/** Insights “Why relevant?” explanations. */
export function resolveOllamaWhyRelevantModel(): string {
  return readEnvModel("OLLAMA_WHY_RELEVANT_MODEL") ?? resolveGenerateDefault();
}

/** Library file summaries after ingest. */
export function resolveOllamaSummaryModel(): string {
  return (
    readEnvModel("OLLAMA_SUMMARY_MODEL") ??
    OLLAMA_SUMMARY_MODEL
  );
}

export function resolveOllamaSummaryTimeoutMs(): number {
  return readEnvMs("OLLAMA_SUMMARY_TIMEOUT_MS", 180_000);
}

/** Document metadata auto-fill extraction. */
export function resolveOllamaMetadataModel(): string {
  return readEnvModel("OLLAMA_METADATA_MODEL") ?? resolveGenerateDefault();
}

/** Timeout for non-embed generate / stream calls. */
export function resolveOllamaGenerateTimeoutMs(): number {
  return readEnvMs("OLLAMA_GENERATE_TIMEOUT_MS", 120_000);
}

/** @deprecated Prefer resolveOllamaAskModel — kept for older imports. */
export function resolveOllamaChatModel(): string {
  return resolveOllamaAskModel();
}

/** @deprecated Prefer usage-specific resolvers — kept for older imports. */
export function resolveOllamaFastModel(): string {
  return resolveGenerateDefault();
}

export const LIBRARY_BUCKET = "library-files" as const;

export const LIBRARY_INGEST_QUEUE = "library-ingest" as const;
export const LIBRARY_EMBED_QUEUE = "library-embed" as const;
export const LIBRARY_SUMMARIZE_QUEUE = "library-summarize" as const;

/** Future: split Tika extraction from chunking so JVM-heavy work scales independently. */
export const LIBRARY_EXTRACT_QUEUE = "library-extract" as const;
export const DOCUMENT_EMBED_QUEUE = "document-embed" as const;
export const LLM_QUEUE = "llm" as const;

export const CONTENT_REEMBED_THRESHOLD = 0.15 as const;

export const LIBRARY_CHUNK_CHARS = 2000 as const;
export const LIBRARY_CHUNK_OVERLAP_CHARS = 256 as const;
/** Soft ceiling per library file after packing; grow chunk size before truncating. */
export const LIBRARY_MAX_CHUNKS_PER_FILE = 400 as const;
export const LIBRARY_SUMMARY_EXCERPT_CHARS = 2000 as const;
/** Absolute safety ceiling; tier max-file limits are usually lower. */
export const LIBRARY_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

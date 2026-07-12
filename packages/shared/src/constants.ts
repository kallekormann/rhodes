export const APP_BASE_PATH = "/app" as const;

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;

export const EMBEDDING_DIMENSIONS = 768 as const;

export const EMBEDDING_MODEL = "nomic-embed-text-v1" as const;

export const OLLAMA_EMBED_MODEL = "nomic-embed-text" as const;

export const OLLAMA_SUMMARY_MODEL = "llama3.2:3b-instruct-q4_K_M" as const;

export const OLLAMA_FAST_MODEL = "llama3.2:3b-instruct-q4_K_M" as const;

export const OLLAMA_CHAT_MODEL = "llama3.1:8b-instruct-q4_K_M" as const;

export const LIBRARY_BUCKET = "library-files" as const;

export const LIBRARY_INGEST_QUEUE = "library-ingest" as const;
export const LIBRARY_EMBED_QUEUE = "library-embed" as const;
export const LIBRARY_SUMMARIZE_QUEUE = "library-summarize" as const;
export const DOCUMENT_EMBED_QUEUE = "document-embed" as const;
export const LLM_QUEUE = "llm" as const;

export const CONTENT_REEMBED_THRESHOLD = 0.15 as const;

export const LIBRARY_CHUNK_CHARS = 2000 as const;
export const LIBRARY_CHUNK_OVERLAP_CHARS = 256 as const;
export const LIBRARY_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

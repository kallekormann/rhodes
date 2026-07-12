import { createClient } from "@/lib/supabase/server";

export type LibrarySourceRow = {
  id: string;
  workspace_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
};

export async function resolveLibrarySourceById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<LibrarySourceRow | null> {
  const { data: direct, error: directError } = await supabase
    .from("library_sources")
    .select("id, workspace_id, file_name, file_path, file_type")
    .eq("id", id)
    .maybeSingle();

  if (directError) {
    throw new Error(directError.message);
  }

  if (direct) return direct;

  const { data: chunk, error: chunkError } = await supabase
    .from("library_source_chunks")
    .select("source_id")
    .eq("id", id)
    .maybeSingle();

  if (chunkError) {
    throw new Error(chunkError.message);
  }

  if (!chunk?.source_id) return null;

  const { data: viaChunk, error: viaChunkError } = await supabase
    .from("library_sources")
    .select("id, workspace_id, file_name, file_path, file_type")
    .eq("id", chunk.source_id)
    .maybeSingle();

  if (viaChunkError) {
    throw new Error(viaChunkError.message);
  }

  return viaChunk;
}

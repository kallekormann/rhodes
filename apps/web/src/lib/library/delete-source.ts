import { createAdminClient } from "@rhodes/db";
import { createAdminObjectStorage } from "@rhodes/db/object-storage";
import { LIBRARY_BUCKET } from "@rhodes/shared/constants";
import { cancelLibrarySourceJobs } from "@/lib/library/queue";

export async function removeLibrarySource(input: {
  sourceId: string;
  filePath: string;
}) {
  await cancelLibrarySourceJobs(input.sourceId);

  const storage = createAdminObjectStorage();
  const admin = createAdminClient();

  const { error: deleteRowError } = await admin
    .from("library_sources")
    .delete()
    .eq("id", input.sourceId);

  if (deleteRowError) {
    throw new Error(deleteRowError.message);
  }

  try {
    await storage.remove(LIBRARY_BUCKET, [input.filePath]);
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error instanceof Error ? error : new Error("Storage delete failed");
    }
  }
}

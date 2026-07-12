import { createAdminClient } from "@rhodes/db";
import { LIBRARY_BUCKET } from "@rhodes/shared/constants";
import { deleteLocalLibraryFile } from "@/lib/library/local-storage";
import { cancelLibrarySourceJobs } from "@/lib/library/queue";

export async function removeLibrarySource(input: {
  sourceId: string;
  filePath: string;
}) {
  await cancelLibrarySourceJobs(input.sourceId);

  const admin = createAdminClient();

  const { error: deleteRowError } = await admin
    .from("library_sources")
    .delete()
    .eq("id", input.sourceId);

  if (deleteRowError) {
    throw new Error(deleteRowError.message);
  }

  const { error: storageError } = await admin.storage
    .from(LIBRARY_BUCKET)
    .remove([input.filePath]);

  if (storageError && process.env.NODE_ENV === "production") {
    throw new Error(storageError.message);
  }

  await deleteLocalLibraryFile(input.filePath);
}

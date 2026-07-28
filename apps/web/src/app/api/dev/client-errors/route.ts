import { getClientErrorLogPath } from "@/lib/dev/client-error-log-path";
import type { ClientErrorEntry } from "@/lib/dev/client-error-log-types";
import {
  appendClientErrorToFile,
  clearClientErrorFile,
  readClientErrorsFromFile,
} from "@/lib/dev/client-error-log-server";

function devOnly(): Response | null {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  return null;
}

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  const rows = await readClientErrorsFromFile();
  return Response.json({
    path: getClientErrorLogPath(),
    rows,
  });
}

export async function POST(request: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  let entry: ClientErrorEntry;
  try {
    entry = (await request.json()) as ClientErrorEntry;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!entry?.message || !entry?.at) {
    return new Response("Missing required fields", { status: 400 });
  }

  await appendClientErrorToFile(entry);
  return Response.json({ ok: true, path: getClientErrorLogPath() });
}

export async function DELETE() {
  const blocked = devOnly();
  if (blocked) return blocked;

  await clearClientErrorFile();
  return Response.json({ ok: true });
}

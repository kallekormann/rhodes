import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ClientErrorEntry } from "@/lib/dev/client-error-log-types";
import { getClientErrorLogPath } from "@/lib/dev/client-error-log-path";

const MAX_FILE_LINES = 500;

export async function appendClientErrorToFile(
  entry: ClientErrorEntry,
): Promise<void> {
  const logPath = getClientErrorLogPath();
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function readClientErrorsFromFile(): Promise<ClientErrorEntry[]> {
  const logPath = getClientErrorLogPath();
  try {
    const raw = await readFile(logPath, "utf8");
    const rows = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ClientErrorEntry);
    return rows.slice(-MAX_FILE_LINES);
  } catch {
    return [];
  }
}

export async function clearClientErrorFile(): Promise<void> {
  const logPath = getClientErrorLogPath();
  try {
    await writeFile(logPath, "", "utf8");
  } catch {
    /* file may not exist */
  }
}

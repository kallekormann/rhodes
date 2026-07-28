import path from "node:path";

/** Repo-relative log file: rhodes-app/logs/client-errors.log */
export function getClientErrorLogPath(): string {
  return path.join(process.cwd(), "../../logs/client-errors.log");
}

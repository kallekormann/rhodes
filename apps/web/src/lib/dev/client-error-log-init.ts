/**
 * TEMP (TD-004): Side-effect import — installs window error hooks before React mounts.
 */
import { installDebugBannerConsoleHelpers } from "@/lib/dev/debug-banner";
import { installClientErrorLog } from "@/lib/dev/client-error-log";

if (typeof window !== "undefined") {
  installClientErrorLog();
  installDebugBannerConsoleHelpers();
}

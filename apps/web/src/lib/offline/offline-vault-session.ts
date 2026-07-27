/**
 * Unlock / lock Ask + docs vaults together at session boundaries.
 * Docs unlock must succeed even if Ask unlock fails.
 */

import { lockVault, unlockVault } from "@/lib/offline/ask-vault";
import {
  ensureDocsVaultUnlocked,
  lockDocsVault,
  unlockDocsVault,
} from "@/lib/offline/docs-vault";

export { ensureDocsVaultUnlocked };

export async function unlockOfflineVaults(userId: string): Promise<void> {
  const results = await Promise.allSettled([
    unlockVault(userId),
    unlockDocsVault(userId),
  ]);

  const askResult = results[0];
  const docsResult = results[1];

  if (askResult.status === "rejected") {
    console.error("[offline-vault] Ask vault unlock failed", askResult.reason);
  }
  if (docsResult.status === "rejected") {
    console.error("[offline-vault] Docs vault unlock failed", docsResult.reason);
    throw docsResult.reason instanceof Error
      ? docsResult.reason
      : new Error("Docs vault unlock failed");
  }
}

export function lockOfflineVaults(): void {
  lockVault();
  lockDocsVault();
}

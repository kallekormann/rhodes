/**
 * Unlock / lock Ask + docs vaults together at session boundaries.
 */

import { lockVault, unlockVault } from "@/lib/offline/ask-vault";
import { lockDocsVault, unlockDocsVault } from "@/lib/offline/docs-vault";

export async function unlockOfflineVaults(userId: string): Promise<void> {
  await Promise.all([unlockVault(userId), unlockDocsVault(userId)]);
}

export function lockOfflineVaults(): void {
  lockVault();
  lockDocsVault();
}

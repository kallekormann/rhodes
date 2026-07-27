"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { signOutAction } from "@/lib/auth/actions";
import { lockOfflineVaults } from "@/lib/offline/offline-vault-session";
import { clearSyncedOfflineCache } from "@/lib/offline/db";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="ghost"
      size="small"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        localStorage.removeItem("rhodes:active_workspace");

        // Drop in-memory vault DEKs; keep encrypted local data on device.
        lockOfflineVaults();

        try {
          await clearSyncedOfflineCache();
        } catch {
          // Private mode / blocked IndexedDB — continue sign-out.
        }

        try {
          const supabase = createClient();
          await supabase.auth.signOut({ scope: "global" });
        } catch {
          // Server action still clears HTTP-only session cookies.
        }

        await signOutAction();
      }}
    >
      Sign out
    </Button>
  );
}

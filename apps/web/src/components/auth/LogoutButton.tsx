"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { signOutAction } from "@/lib/auth/actions";
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

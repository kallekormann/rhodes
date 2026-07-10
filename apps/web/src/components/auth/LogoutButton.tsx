"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function logout() {
  await fetch("/app/api/auth/logout", { method: "POST" });
  if (typeof window !== "undefined") {
    localStorage.removeItem("rhodes:active_workspace");
  }
}

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className="app-logout"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await logout();
        router.push("/auth/login");
        router.refresh();
      }}
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}

"use client";

import { useLayoutEffect, useState } from "react";
import { markClientHydrated } from "@/lib/client-hydration";

/** False on SSR and the first client render so markup matches the server. */
export function useClientHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    markClientHydrated();
    setHydrated(true);
  }, []);

  return hydrated;
}

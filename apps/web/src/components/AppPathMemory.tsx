"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { rememberLastAppPath } from "@/lib/settings-return";

/** Remember the latest in-app route for Settings "Back". No useSearchParams — avoids Suspense hydration drift. */
export function AppPathMemory() {
  const pathname = usePathname();

  useEffect(() => {
    const search = window.location.search;
    rememberLastAppPath(search ? `${pathname}${search}` : pathname);
  }, [pathname]);

  return null;
}

"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { rememberLastAppPath } from "@/lib/settings-return";

/** Isolated so AppProvider does not call useSearchParams (needs Suspense). */
export function AppPathMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const search = searchParams.toString();
    rememberLastAppPath(search ? `${pathname}?${search}` : pathname);
  }, [pathname, searchParams]);

  return null;
}

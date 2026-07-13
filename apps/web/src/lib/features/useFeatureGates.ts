"use client";

import { useMemo } from "react";
import type { Scope } from "@/data/scopes";
import { buildFeatureGates } from "@/lib/features/gates";

export function useFeatureGates(activeScope: Scope) {
  return useMemo(() => {
    const teamRole = activeScope.type === "team" ? activeScope.role : undefined;
    return buildFeatureGates({ teamRole });
  }, [activeScope.role, activeScope.type]);
}

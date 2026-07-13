import { Suspense } from "react";
import { SettingsView } from "@/views/SettingsView";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsView />
    </Suspense>
  );
}

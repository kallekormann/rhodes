import { parseSettingsMode } from "@/lib/settings-url";
import { SettingsView } from "@/views/SettingsView";

type SettingsPageProps = {
  searchParams: Promise<{ mode?: string; section?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;

  return (
    <SettingsView
      initialMode={parseSettingsMode(params.mode)}
      initialSection={params.section ?? null}
    />
  );
}
